// Step 3 of the loop: verify a passport independently (v2 core API).
//
// Usage:  npm run verify <passportId>
//
// Reads the on-chain object straight from a public node, decodes its BCS
// content, pulls the photo blob from Walrus, and writes verify/data.json for
// the static viewer. Trusts nothing local — re-fetches everything.

import { writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { bcs } from '@mysten/sui/bcs';
import { sui, walrusClient } from './client';

// Must match the field order/types of CoinPassport in passport.move.
const CoinPassport = bcs.struct('CoinPassport', {
  id: bcs.Address,
  sequence: bcs.u64(),
  product: bcs.string(),
  year: bcs.u16(),
  mint_mark: bcs.string(),
  unit: bcs.string(),
  quantity: bcs.u64(),
  weight_mg: bcs.u64(),
  purity: bcs.u16(),
  silver_content_mg: bcs.u64(),
  photo_blob_id: bcs.string(),
  evidence_blob_id: bcs.string(),
  attested_at_ms: bcs.u64(),
  attestor: bcs.Address,
});

async function main() {
  const id = process.argv[2];
  if (!id) throw new Error('Usage: npm run verify <passportId>');

  const { object } = await sui.core.getObject({ objectId: id, include: { content: true } });
  if (!object.content) throw new Error('Object has no content — wrong id or network?');

  const f = CoinPassport.parse(object.content);
  console.log('On-chain passport found:');
  console.log(`  type:     ${object.type}`);
  console.log(`  sequence: #${String(f.sequence).padStart(3, '0')}`);
  console.log(`  product:  ${f.product}${Number(f.year) ? ' (' + f.year + ')' : ''}`);
  console.log(`  unit:     ${f.unit} x${f.quantity}`);
  console.log(`  weight:   ${f.weight_mg} mg gross @ .${f.purity} fine`);
  console.log(`  silver:   ${f.silver_content_mg} mg (${(Number(f.silver_content_mg) / 31103).toFixed(4)} troy oz)`);
  console.log(`  attestor: ${f.attestor}`);
  console.log(`  photo:    walrus blobId ${f.photo_blob_id}`);

  const photo = await walrusClient.walrus.readBlob({ blobId: f.photo_blob_id });
  console.log(`\nWalrus photo blob resolved: ${photo.byteLength} bytes — evidence is live.`);

  const bundle = {
    passportId: id,
    type: object.type,
    network: 'testnet',
    fields: f,
    photoDataUri: `data:image/jpeg;base64,${Buffer.from(photo).toString('base64')}`,
    explorer: `https://suiscan.xyz/testnet/object/${id}`,
    verifiedAt: new Date().toISOString(),
  };
  writeFileSync(resolve('verify/data.json'), JSON.stringify(bundle, null, 2));
  console.log('\nWrote verify/data.json — serve verify/ and open it.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
