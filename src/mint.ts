// Step 2 of the loop: mint the on-chain passport (v2 core API).
//
// Usage:  npm run mint data/coin-001.json

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { Transaction } from '@mysten/sui/transactions';
import { SUI_CLOCK_OBJECT_ID } from '@mysten/sui/utils';
import { sui, loadKeypair, requirePackageId } from './client';

async function main() {
  const metaPath = process.argv[2];
  if (!metaPath) throw new Error('Usage: npm run mint <coin-meta.json>');

  const meta = JSON.parse(readFileSync(resolve(metaPath), 'utf8'));
  if (!meta.photoBlobId) throw new Error('No photoBlobId — run the upload step first.');

  const pkg = requirePackageId();
  const registry = process.env.REGISTRY_ID;
  if (!registry) throw new Error('REGISTRY_ID missing in .env');
  const keypair = loadKeypair();

  const tx = new Transaction();
  tx.moveCall({
    target: `${pkg}::passport::mint`,
    arguments: [
      tx.object(registry),
      tx.pure.u64(BigInt(meta.sequence)),
      tx.pure.string(meta.product),
      tx.pure.u16(meta.year),
      tx.pure.string(meta.mintMark ?? ''),
      tx.pure.string(meta.unit ?? 'coin'),
      tx.pure.u64(BigInt(meta.quantity ?? 1)),
      tx.pure.u64(BigInt(meta.weightMg)),
      tx.pure.u16(meta.purity),
      tx.pure.string(meta.photoBlobId),
      tx.pure.string(meta.evidenceBlobId ?? ''),
      tx.object(SUI_CLOCK_OBJECT_ID),
    ],
  });

  const result = await sui.core.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    include: { effects: true },
  });

  if (result.$kind === 'FailedTransaction') {
    throw new Error(`Transaction failed: ${JSON.stringify(result.FailedTransaction.status)}`);
  }

  const tx_ = result.Transaction;
  const created = tx_.effects?.changedObjects.filter((c) => c.idOperation === 'Created') ?? [];
  const passportId = created[0]?.objectId;

  console.log(`\nDigest:      ${tx_.digest}`);
  console.log(`Passport ID: ${passportId ?? '(inspect effects.changedObjects)'}`);

  if (passportId) {
    meta.passportId = passportId;
    writeFileSync(resolve(metaPath), JSON.stringify(meta, null, 2));
    console.log(`\nVerify with: npm run verify ${passportId}`);
    console.log(`Explorer:    https://suiscan.xyz/testnet/object/${passportId}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
