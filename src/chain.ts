// Hash-linked Proof-of-Reserve chain helpers.
//
// Each reserve attestation is stored on Walrus and linked to the previous one
// by (prevBlobId, prevHash), forming an append-only, tamper-evident chain.
// `hash` is the sha256 of the EXACT bytes stored on Walrus for that
// attestation. Anyone can re-fetch each blob from the public aggregator,
// recompute the hash, and confirm the links — no trust in our server required.

import { createHash } from 'node:crypto';
import { resolve } from 'node:path';

export const AGGREGATOR =
  process.env.WALRUS_AGGREGATOR ??
  'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';

export const MEMORY_INDEX = resolve('data/reserve-memory.json');
export const PUBLIC_CHAIN = resolve('verify/reserve-chain.json');

export type ChainEntry = {
  at: string;
  blobId: string;
  silver_oz: number;
  passports: number;
  // Chain fields (present once the entry is part of the verifiable chain):
  height?: number;
  hash?: string | null;
  prevBlobId?: string | null;
  prevHash?: string | null;
  alive?: boolean;   // blob still retrievable from Walrus at backfill time
  legacy?: boolean;  // pre-chain history (written before chaining; may expire)
};

export function sha256Hex(bytes: Uint8Array): string {
  return createHash('sha256').update(bytes).digest('hex');
}

export async function fetchBlobBytes(blobId: string): Promise<Uint8Array | null> {
  try {
    const r = await fetch(AGGREGATOR + blobId);
    if (!r.ok) return null;
    return new Uint8Array(await r.arrayBuffer());
  } catch {
    return null;
  }
}

// The last entry that is part of the verifiable chain (has a height + hash).
export function lastChainEntry(index: ChainEntry[]): ChainEntry | null {
  for (let i = index.length - 1; i >= 0; i--) {
    if (typeof index[i].height === 'number' && index[i].hash) return index[i];
  }
  return null;
}

// Link fields for the NEXT attestation appended to the chain.
export function nextLink(index: ChainEntry[]): { height: number; prevBlobId: string | null; prevHash: string | null } {
  const last = lastChainEntry(index);
  if (!last) return { height: 0, prevBlobId: null, prevHash: null };
  return { height: (last.height as number) + 1, prevBlobId: last.blobId, prevHash: last.hash as string };
}

// Browser-fetchable copy of just the verifiable chain (written to verify/).
export function publicChain(index: ChainEntry[]) {
  const chain = index
    .filter((e) => typeof e.height === 'number' && e.hash)
    .sort((a, b) => (a.height as number) - (b.height as number))
    .map((e) => ({
      height: e.height, at: e.at, blobId: e.blobId, hash: e.hash,
      prevBlobId: e.prevBlobId ?? null, prevHash: e.prevHash ?? null,
      silver_oz: e.silver_oz, passports: e.passports,
    }));
  const legacy = index
    .filter((e) => e.legacy)
    .map((e) => ({ at: e.at, blobId: e.blobId, silver_oz: e.silver_oz, passports: e.passports, alive: !!e.alive }));
  return { aggregator: AGGREGATOR, updatedAt: new Date().toISOString(), length: chain.length, chain, legacy };
}
