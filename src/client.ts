// Shared setup: testnet Sui client (v2 SDK), Walrus-extended client, keypair.
//
// Env (.env):
//   SUI_NETWORK=testnet
//   SUI_FULLNODE_URL=https://fullnode.testnet.sui.io:443
//   SUI_SECRET_KEY=suiprivkey1...   (export via `sui keytool export` — NEVER commit)
//   PACKAGE_ID=0x...                (filled in after you publish the Move package)
//   WALRUS_EPOCHS=5

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { SuiGrpcClient } from '@mysten/sui/grpc';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { decodeSuiPrivateKey } from '@mysten/sui/cryptography';
import { walrus } from '@mysten/walrus';

export const NETWORK = (process.env.SUI_NETWORK ?? 'testnet') as 'testnet' | 'mainnet' | 'devnet';
const DEFAULT_URL: Record<string, string> = {
  testnet: 'https://fullnode.testnet.sui.io:443',
  mainnet: 'https://fullnode.mainnet.sui.io:443',
  devnet: 'https://fullnode.devnet.sui.io:443',
};
export const FULLNODE = process.env.SUI_FULLNODE_URL ?? DEFAULT_URL[NETWORK];
export const PACKAGE_ID = process.env.PACKAGE_ID ?? '';
export const WALRUS_EPOCHS = Number(process.env.WALRUS_EPOCHS ?? 5);

// Superseded passports: minted under this package but excluded from the reserve
// tally and the dashboard. The contract has no burn, so when a passport is
// re-minted with corrected evidence (e.g. a real batch photo replacing a
// placeholder), the old object is retired here so its silver is not
// double-counted. This is disclosed, not hidden — the objects still exist
// on-chain; we simply don't count them as live reserve.
export const RETIRED_PASSPORTS = new Set<string>([
  '0x0c5c023c95e0bf025e2592512a00781fdcf32890c430931a615b660b39cd3167', // nickels 4-roll, placeholder photo -> re-minted 0xcfce05d3...
  '0xf6a5bffd80b4bd6e37fa94a4abfe42f5261a26227e70ae641e3510020c7baf19', // dimes 2-roll, placeholder photo -> re-minted as 3-roll 0x135a0c44...
]);

// Coins of OTHER metals minted under the same (metal-agnostic) contract. The
// on-chain field is named silver_content_mg, so these are excluded from the SILVER
// reserve tally to keep the silver figures honest; they still appear in holdings
// views (portfolio) as a multi-metal showcase.
export const GOLD_PASSPORTS = new Set<string>([
  '0xb67eb4f3852725ff22e617b2489e5ffd6653251dc0dbe0de42ef97baeb0081bc', // Gold Buffalo Round (1 oz .999)
]);

// Plain client — minting + reading objects via the unified `.core` API.
export const sui = new SuiGrpcClient({ network: NETWORK, baseUrl: FULLNODE });

// Walrus-extended client — blob writes/reads. Documented `.$extend(walrus())`.
export const walrusClient = new SuiGrpcClient({ network: NETWORK, baseUrl: FULLNODE }).$extend(walrus());

// Load the signing keypair. Prefers SUI_SECRET_KEY in .env if set; otherwise
// reads directly from the Sui CLI keystore (the secret stays where the CLI put
// it — no copy into .env). Each keystore entry is base64 of [flag || privkey];
// flag 0x00 = ed25519.
export function loadKeypair(): Ed25519Keypair {
  const sk = process.env.SUI_SECRET_KEY?.trim();
  if (sk) {
    const { secretKey } = decodeSuiPrivateKey(sk);
    return Ed25519Keypair.fromSecretKey(secretKey);
  }
  const ksPath = process.env.SUI_KEYSTORE ?? join(homedir(), '.sui', 'sui_config', 'sui.keystore');
  let entries: string[];
  try {
    entries = JSON.parse(readFileSync(ksPath, 'utf8'));
  } catch {
    throw new Error(`No SUI_SECRET_KEY in .env and could not read Sui keystore at ${ksPath}.`);
  }
  if (!entries.length) throw new Error(`Sui keystore at ${ksPath} has no keys.`);

  // Order-independent selection: if PRIMARY_ADDRESS is set (a public address,
  // not a secret), pick that wallet from the keystore. This keeps minting and
  // auditing on the vault wallet even if other addresses were added later.
  const want = process.env.PRIMARY_ADDRESS?.trim();
  if (want) {
    for (const e of entries) {
      const b = Buffer.from(e, 'base64');
      if (b.length === 33 && b[0] === 0x00) {
        const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(b.subarray(1, 33)));
        if (kp.toSuiAddress() === want) return kp;
      }
    }
    throw new Error(`PRIMARY_ADDRESS ${want} not found among ed25519 keys in ${ksPath}.`);
  }

  const raw = Buffer.from(entries[0], 'base64');
  if (raw.length !== 33 || raw[0] !== 0x00) {
    throw new Error(`Keystore key 0 is not ed25519 (set SUI_SECRET_KEY in .env to override).`);
  }
  return Ed25519Keypair.fromSecretKey(new Uint8Array(raw.subarray(1, 33)));
}

export function requirePackageId(): string {
  if (!PACKAGE_ID) {
    throw new Error('PACKAGE_ID missing in .env — publish the Move package first, then paste its package ID.');
  }
  return PACKAGE_ID;
}
