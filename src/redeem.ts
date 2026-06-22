// Close the bailment: burn a CoinPassport on-chain and issue a redemption
// certificate stored on Walrus.
//
//   npm run redeem <passportId>
//
// Reads the passport's on-chain fields, calls passport::redeem (which deletes
// the object and emits Redeemed), then builds a redemption certificate, stores
// it on Walrus, and records it in data/redemptions.json + verify/redemptions.json.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { Transaction } from '@mysten/sui/transactions';
import { sui, walrusClient, loadKeypair, requirePackageId, FULLNODE, WALRUS_EPOCHS } from './client';

const OZ = 31103; // mg of silver per troy oz
const REDEMPTIONS = resolve('data/redemptions.json');
const PUBLIC_REDEMPTIONS = resolve('verify/redemptions.json');
const AGG = process.env.WALRUS_AGGREGATOR ?? 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(FULLNODE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await res.json();
  if (j.error) throw new Error(method + ': ' + JSON.stringify(j.error));
  return j.result;
}

async function main() {
  const passportId = process.argv[2];
  if (!passportId) throw new Error('Usage: npm run redeem <passportId>');
  const pkg = requirePackageId();
  const keypair = loadKeypair();
  const me = keypair.toSuiAddress();

  // 1. Read the passport on-chain for its canonical fields (before it is burned).
  const obj = await rpc('sui_getObject', [passportId, { showContent: true }]);
  const f = obj.data?.content?.fields;
  if (!f) throw new Error('Passport not found (or already redeemed): ' + passportId);
  const silver_mg = Number(f.silver_content_mg);
  const passport = {
    id: passportId, sequence: Number(f.sequence), product: f.product, year: Number(f.year),
    mintMark: f.mint_mark, unit: f.unit, quantity: Number(f.quantity), weightMg: Number(f.weight_mg),
    purity: Number(f.purity), silver_content_mg: silver_mg, silver_oz: +(silver_mg / OZ).toFixed(4),
    photoBlobId: f.photo_blob_id, evidenceBlobId: f.evidence_blob_id,
    attestor: f.attestor, attested_at_ms: Number(f.attested_at_ms),
  };
  console.log('Redeeming seq ' + passport.sequence + ' \u2014 ' + passport.product + ' (' + passport.silver_oz + ' oz)');

  // 2. Burn it on-chain.
  process.stdout.write('Burning the passport on-chain (passport::redeem)\u2026 ');
  const tx = new Transaction();
  tx.moveCall({ target: `${pkg}::passport::redeem`, arguments: [tx.object(passportId)] });
  const result = await sui.core.signAndExecuteTransaction({ transaction: tx, signer: keypair, include: { effects: true } });
  if (result.$kind === 'FailedTransaction') throw new Error('redeem failed: ' + JSON.stringify(result.FailedTransaction.status));
  const digest = result.Transaction.digest;
  console.log('done.');
  console.log('  digest: ' + digest);

  // 3. Build the redemption certificate.
  const redeemedAt = new Date().toISOString();
  const cert = {
    type: 'silver-passport-redemption-certificate', version: 1, network: 'testnet', package: pkg,
    passport,
    redemption: {
      by: me, at: redeemedAt, txDigest: digest,
      statement: 'This certifies that the bailment is closed: the CoinPassport above was burned on-chain (passport::redeem) and the corresponding physical bullion released to the holder.',
    },
    disclaimer: 'Custody, insurance, and shipment are the verified seller\u2019s (bailee\u2019s) off-chain obligations. On Sui testnet this demonstrates the redemption mechanism; it is not a legally operative release.',
  };
  const bytes = new TextEncoder().encode(JSON.stringify(cert, null, 2));

  // 4. Store the certificate on Walrus (durable epochs, with fallback).
  process.stdout.write('Storing the redemption certificate on Walrus\u2026 ');
  const epochTries = [Number(process.env.WALRUS_CHAIN_EPOCHS ?? 30), 10, WALRUS_EPOCHS];
  let certBlobId = '';
  for (const ep of epochTries) {
    try { const r = await walrusClient.walrus.writeBlob({ blob: bytes, deletable: false, epochs: ep, signer: keypair }); certBlobId = r.blobId; console.log('done (epochs=' + ep + ').'); break; }
    catch (e: any) { console.log('epochs=' + ep + ' failed (' + e.message + '); retrying smaller\u2026'); }
  }
  if (!certBlobId) throw new Error('Walrus writeBlob failed for the certificate.');

  // 5. Record it (local canonical + public browser copy).
  const index = existsSync(REDEMPTIONS) ? JSON.parse(readFileSync(REDEMPTIONS, 'utf8')) : [];
  index.push({ at: redeemedAt, txDigest: digest, passportId, sequence: passport.sequence, product: passport.product, silver_oz: passport.silver_oz, certBlobId, by: me });
  writeFileSync(REDEMPTIONS, JSON.stringify(index, null, 2));
  writeFileSync(PUBLIC_REDEMPTIONS, JSON.stringify({ aggregator: AGG, updatedAt: redeemedAt, length: index.length, redemptions: index }, null, 2));

  console.log('\nRedemption certificate on Walrus: ' + certBlobId);
  console.log('  read it: ' + AGG + certBlobId);
  console.log('Redemptions index now holds ' + index.length + ' certificate(s).');
}

main().catch((e) => { console.error(e); process.exit(1); });
