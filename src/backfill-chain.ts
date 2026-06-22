// One-time: tag the pre-chain attestation history.
//
//   npm run backfill-chain
//
// The 8 attestations written before the hash-chain feature used short storage
// epochs; most have already expired on Walrus. Rather than anchor the durable
// chain on soon-to-expire blobs, tag every existing entry as `legacy`
// (pre-chain history) and record whether each blob is still retrievable. The
// durable verifiable chain then begins at the next `npm run audit` (genesis),
// which stores with long epochs.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { MEMORY_INDEX, PUBLIC_CHAIN, fetchBlobBytes, publicChain, type ChainEntry } from './chain';

async function main() {
  if (!existsSync(MEMORY_INDEX)) { console.log('No reserve-memory.json yet; nothing to backfill.'); return; }
  const index: ChainEntry[] = JSON.parse(readFileSync(MEMORY_INDEX, 'utf8'));

  let alive = 0;
  for (const e of index) {
    if (typeof e.height === 'number' && e.hash) continue; // already a chain entry
    const bytes = await fetchBlobBytes(e.blobId);
    e.legacy = true;
    e.alive = !!bytes;
    if (bytes) alive++;
    console.log(`${e.at}  ${e.alive ? 'ALIVE  ' : 'expired'}  ${e.blobId.slice(0, 14)}…  ${e.passports}p / ${e.silver_oz}oz`);
  }

  writeFileSync(MEMORY_INDEX, JSON.stringify(index, null, 2));
  writeFileSync(PUBLIC_CHAIN, JSON.stringify(publicChain(index), null, 2));
  console.log(`\nTagged ${index.length} pre-chain attestation(s); ${alive} still retrievable on Walrus.`);
  console.log('Durable verifiable chain begins at the next `npm run audit` (genesis).');
}

main().catch((e) => { console.error(e); process.exit(1); });
