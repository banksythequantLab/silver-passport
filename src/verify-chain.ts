// Independently verify the Proof-of-Reserve chain.
//
//   npm run verify-chain
//
// For every chain entry: re-fetch its attestation blob from the PUBLIC Walrus
// aggregator, recompute sha256, and confirm it equals the recorded hash and
// that prevBlobId/prevHash link to the previous entry. No trust in our server.

import { readFileSync, existsSync } from 'node:fs';
import { MEMORY_INDEX, fetchBlobBytes, sha256Hex, type ChainEntry } from './chain';

async function main() {
  if (!existsSync(MEMORY_INDEX)) { console.log('No reserve-memory.json.'); process.exit(1); }
  const index: ChainEntry[] = JSON.parse(readFileSync(MEMORY_INDEX, 'utf8'));
  const chain = index
    .filter((e) => typeof e.height === 'number' && e.hash)
    .sort((a, b) => (a.height as number) - (b.height as number));

  if (!chain.length) { console.log('Chain is empty (run `npm run audit` to create genesis).'); return; }

  let ok = true;
  let prev: ChainEntry | null = null;
  for (const e of chain) {
    const bytes = await fetchBlobBytes(e.blobId);
    const problems: string[] = [];
    if (!bytes) {
      problems.push('blob not retrievable from Walrus');
    } else {
      const h = sha256Hex(bytes);
      if (h !== e.hash) problems.push(`hash mismatch (got ${h.slice(0, 12)}…)`);
      try {
        const j: any = JSON.parse(new TextDecoder().decode(bytes));
        if (j && j.chain) {
          if ((j.chain.prevBlobId ?? null) !== (e.prevBlobId ?? null)) problems.push('embedded prevBlobId != recorded');
          if ((j.chain.prevHash ?? null) !== (e.prevHash ?? null)) problems.push('embedded prevHash != recorded');
          if (j.chain.height !== e.height) problems.push('embedded height != recorded');
        }
      } catch { /* not JSON */ }
    }
    if (!prev) {
      if (e.prevBlobId || e.prevHash) problems.push('genesis must have null prev');
    } else {
      if (e.prevBlobId !== prev.blobId) problems.push('prevBlobId != previous blobId');
      if (e.prevHash !== prev.hash) problems.push('prevHash != previous hash');
    }
    if (problems.length) ok = false;
    console.log(`height ${e.height}  ${problems.length ? 'FAIL' : 'OK  '}  ${e.blobId.slice(0, 12)}…  ${e.passports}p / ${e.silver_oz}oz${problems.length ? '  -> ' + problems.join('; ') : ''}`);
    prev = e;
  }

  console.log(`\n${ok ? 'CHAIN INTACT' : 'CHAIN BROKEN'} — ${chain.length} link(s) verified against Walrus.`);
  if (!ok) process.exit(2);
}

main().catch((e) => { console.error(e); process.exit(1); });
