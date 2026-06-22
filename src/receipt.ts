// Per-coin bailment receipts.
//
//   npm run receipt            # seal a warehouse/bailment receipt on Walrus for each live coin
//   npm run receipt --force    # re-seal even if a receipt already exists
//
// For every live CoinPassport, builds a warehouse-receipt-style bailment document
// (bailee, bailor, goods, terms, modeled on UCC Art. 7) and stores it durably on
// Walrus. Idempotent: skips coins that already have a receipt, and persists the
// index after each write so the run is resumable.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { walrusClient, loadKeypair, requirePackageId, FULLNODE, RETIRED_PASSPORTS } from './client';

const OZ = 31103;
const OPERATOR = process.env.PRIMARY_ADDRESS ?? '';
const AGG = process.env.WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';
const DURABLE = Number(process.env.WALRUS_CHAIN_EPOCHS ?? 30);
const RECEIPTS = resolve('data/receipts.json');
const PUBLIC_RECEIPTS = resolve('verify/receipts.json');

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(FULLNODE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function listLive(pkg: string) {
  const ids: string[] = [];
  let cursor: unknown = null;
  do {
    const page = await rpc('suix_queryEvents', [{ MoveEventType: `${pkg}::passport::PassportMinted` }, cursor, 50, false]);
    for (const e of page.data) ids.push(e.parsedJson.passport_id);
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  const out: { id: string; owner: string; f: any }[] = [];
  for (const id of ids) {
    if (RETIRED_PASSPORTS.has(id)) continue;
    const r = await rpc('sui_getObject', [id, { showContent: true, showOwner: true }]);
    const f = r.data?.content?.fields;
    if (!f) continue; // redeemed / gone
    const ow = r.data.owner;
    const owner = ow?.AddressOwner ?? OPERATOR; // listed-in-kiosk -> custodied by operator
    out.push({ id, owner, f });
  }
  return out;
}

function buildReceipt(pkg: string, id: string, owner: string, f: any) {
  const silver_mg = Number(f.silver_content_mg);
  return {
    type: 'silver-passport-bailment-receipt', version: 1, network: 'testnet', package: pkg,
    receiptNo: 'SP-' + String(Number(f.sequence)).padStart(3, '0'),
    issuedAt: new Date().toISOString(),
    bailee: { role: 'Verified seller / warehouse (custodian)', address: OPERATOR },
    bailor: { role: 'CoinPassport holder', address: owner },
    goods: {
      passportId: id, sequence: Number(f.sequence), product: f.product, year: Number(f.year),
      mintMark: f.mint_mark, unit: f.unit, quantity: Number(f.quantity), weightMg: Number(f.weight_mg),
      purity: Number(f.purity), silver_content_mg: silver_mg, silver_oz: +(silver_mg / OZ).toFixed(4),
      photoBlobId: f.photo_blob_id,
    },
    terms: {
      nature: 'Bailment for safekeeping. The bailee holds the described bullion in custody for the holder of the CoinPassport.',
      delivery: 'The bullion is deliverable to the CoinPassport holder upon redemption (passport::redeem), which burns the passport on-chain and closes the bailment.',
      transfer: 'Title passes with the CoinPassport, traded through a Kiosk under the on-chain TransferPolicy (1% royalty).',
      negotiability: 'Modeled on a negotiable warehouse receipt (cf. UCC Article 7); this document evidences custody recorded on-chain.',
    },
    disclaimer: 'Sui testnet demonstration. Not a legally operative warehouse receipt; no physical bullion is actually bailed.',
  };
}

async function main() {
  const pkg = requirePackageId();
  const force = process.argv.includes('--force');
  const index: Record<string, any> = existsSync(RECEIPTS) ? JSON.parse(readFileSync(RECEIPTS, 'utf8')) : {};
  const keypair = loadKeypair();

  const live = await listLive(pkg);
  console.log(`${live.length} live passport(s).\n`);
  for (const { id, owner, f } of live) {
    if (index[id] && !force) { console.log(`  seq${f.sequence}: receipt exists (${index[id].receiptBlobId.slice(0, 12)}\u2026), skip`); continue; }
    const bytes = new TextEncoder().encode(JSON.stringify(buildReceipt(pkg, id, owner, f), null, 2));
    process.stdout.write(`  seq${String(Number(f.sequence)).padStart(3, '0')} ${f.product}: sealing receipt\u2026 `);
    const res = await walrusClient.walrus.writeBlob({ blob: bytes, deletable: false, epochs: DURABLE, signer: keypair });
    index[id] = {
      passportId: id, sequence: Number(f.sequence), product: f.product,
      silver_oz: +(Number(f.silver_content_mg) / OZ).toFixed(3),
      receiptNo: 'SP-' + String(Number(f.sequence)).padStart(3, '0'), receiptBlobId: res.blobId,
    };
    writeFileSync(RECEIPTS, JSON.stringify(index, null, 2)); // persist after each (resumable)
    console.log(`done \u2192 ${res.blobId.slice(0, 12)}\u2026`);
  }

  const arr = Object.values(index).sort((a: any, b: any) => a.sequence - b.sequence);
  writeFileSync(PUBLIC_RECEIPTS, JSON.stringify({ aggregator: AGG, updatedAt: new Date().toISOString(), length: arr.length, receipts: arr }, null, 2));
  console.log(`\n${arr.length} receipt(s) sealed. Public index \u2192 verify/receipts.json`);
}
main().catch((e) => { console.error(e); process.exit(1); });
