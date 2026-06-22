// Walrus blob-lifecycle manager.
//
//   npm run renew                 # report durability health of every proof blob
//   npm run renew --reseal-certs  # renew redemption certificates by re-sealing them durable
//
// Proof blobs (reserve attestations + redemption certificates) are written with
// long storage epochs, but Walrus storage still lapses eventually. This tool
// reports each blob's live availability and can re-seal standalone certificates
// with fresh durability. Chain-linked attestations are intentionally NOT re-sealed
// (a new blobId would fork the hash-linked chain); their tip durability is renewed
// by the next `npm run audit`, which appends a fresh durable attestation.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { walrusClient, loadKeypair } from './client';

const AGG = process.env.WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';
const MEMORY = resolve('data/reserve-memory.json');
const REDEMPTIONS = resolve('data/redemptions.json');
const PUBLIC_REDEMPTIONS = resolve('verify/redemptions.json');
const RENEWALS = resolve('data/renewals.json');
const DURABLE = Number(process.env.WALRUS_CHAIN_EPOCHS ?? 30);

type Item = { role: string; blobId: string; at?: string; chained: boolean };

async function isLive(blobId: string): Promise<boolean> {
  try { const r = await fetch(AGG + blobId, { method: 'GET' }); return r.ok; }
  catch { return false; }
}

function load(): Item[] {
  const items: Item[] = [];
  if (existsSync(MEMORY)) {
    for (const c of JSON.parse(readFileSync(MEMORY, 'utf8')))
      items.push({ role: `attestation ${c.height != null ? 'h' + c.height : 'pre-chain'}`, blobId: c.blobId, at: c.at, chained: true });
  }
  if (existsSync(REDEMPTIONS)) {
    for (const r of JSON.parse(readFileSync(REDEMPTIONS, 'utf8')))
      items.push({ role: `redemption seq${r.sequence}`, blobId: r.certBlobId, at: r.at, chained: false });
  }
  return items;
}

async function report() {
  const items = load();
  console.log(`Checking durability of ${items.length} proof blob(s) on Walrus\u2026\n`);
  let live = 0, gone = 0;
  for (const it of items) {
    const ok = await isLive(it.blobId);
    ok ? live++ : gone++;
    console.log(`  ${ok ? 'LIVE' : 'GONE'}  ${it.role.padEnd(18)} ${it.blobId.slice(0, 14)}\u2026  ${it.chained ? '(chain-linked)' : '(standalone)'}`);
  }
  console.log(`\n${live} live \u00b7 ${gone} gone (lapsed/superseded).`);
  console.log('Chain-linked attestations renew via the next `npm run audit` (fresh durable tip).');
  console.log('Standalone certificates can be re-sealed now: npm run renew --reseal-certs');
}

async function resealCerts() {
  if (!existsSync(REDEMPTIONS)) { console.log('No redemptions to renew.'); return; }
  const reds = JSON.parse(readFileSync(REDEMPTIONS, 'utf8'));
  const renewals = existsSync(RENEWALS) ? JSON.parse(readFileSync(RENEWALS, 'utf8')) : [];
  const keypair = loadKeypair();
  let changed = false;
  for (const r of reds) {
    if (!(await isLive(r.certBlobId))) { console.log(`  seq${r.sequence}: source blob gone \u2014 cannot re-seal (bytes lost).`); continue; }
    process.stdout.write(`  seq${r.sequence}: re-sealing durable (epochs=${DURABLE})\u2026 `);
    const bytes = new Uint8Array(await (await fetch(AGG + r.certBlobId)).arrayBuffer());
    const res = await walrusClient.walrus.writeBlob({ blob: bytes, deletable: false, epochs: DURABLE, signer: keypair });
    renewals.push({ at: new Date().toISOString(), role: `redemption seq${r.sequence}`, oldBlobId: r.certBlobId, newBlobId: res.blobId, epochs: DURABLE });
    console.log(`done \u2192 ${res.blobId.slice(0, 14)}\u2026`);
    r.certBlobId = res.blobId; changed = true;
  }
  if (changed) {
    writeFileSync(REDEMPTIONS, JSON.stringify(reds, null, 2));
    writeFileSync(PUBLIC_REDEMPTIONS, JSON.stringify({ aggregator: AGG, updatedAt: new Date().toISOString(), length: reds.length, redemptions: reds }, null, 2));
    writeFileSync(RENEWALS, JSON.stringify(renewals, null, 2));
    console.log('\nUpdated redemptions index + renewals log.');
  } else { console.log('\nNothing re-sealed.'); }
}

async function main() {
  if (process.argv.includes('--reseal-certs')) await resealCerts();
  else await report();
}
main().catch((e) => { console.error(e); process.exit(1); });
