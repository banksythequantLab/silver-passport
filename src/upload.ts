// Step 1 of the loop: upload coin evidence to Walrus.
//
// Usage:  npm run upload data/coin-001.json
//
// Reads a coin metadata JSON that points at a local photo (and optional
// evidence doc), uploads them to Walrus, and writes the returned blob IDs
// back into the same JSON so the mint step can use them.

import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { walrusClient, loadKeypair, WALRUS_EPOCHS } from './client';

type CoinMeta = {
  sequence: number;
  product: string;
  year: number;
  mintMark: string;
  weightMg: number;
  purity: number;
  photoPath: string;        // local path to the coin photo
  evidencePath?: string;    // optional local path to COA / docs
  photoBlobId?: string;     // filled in by this script
  evidenceBlobId?: string;  // filled in by this script
};

async function writeFile(path: string): Promise<string> {
  const bytes = new Uint8Array(readFileSync(resolve(path)));
  const keypair = loadKeypair();
  const { blobId } = await walrusClient.walrus.writeBlob({
    blob: bytes,
    deletable: false,
    epochs: WALRUS_EPOCHS,
    signer: keypair,
  });
  return blobId;
}

async function main() {
  const metaPath = process.argv[2];
  if (!metaPath) throw new Error('Usage: npm run upload <coin-meta.json>');

  const meta: CoinMeta = JSON.parse(readFileSync(resolve(metaPath), 'utf8'));

  console.log(`Uploading photo: ${meta.photoPath}`);
  meta.photoBlobId = await writeFile(meta.photoPath);
  console.log(`  photo blobId: ${meta.photoBlobId}`);

  if (meta.evidencePath) {
    console.log(`Uploading evidence: ${meta.evidencePath}`);
    meta.evidenceBlobId = await writeFile(meta.evidencePath);
    console.log(`  evidence blobId: ${meta.evidenceBlobId}`);
  }

  writeFileSync(resolve(metaPath), JSON.stringify(meta, null, 2));
  console.log(`Updated ${metaPath} with blob IDs. Next: npm run mint ${metaPath}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
