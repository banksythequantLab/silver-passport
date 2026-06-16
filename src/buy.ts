// Buy a listed passport from the seller's Kiosk — as a different wallet.
//
//   npm run buy <buyerAddress> <passportId> <sellerKioskId> [priceMist]
//
// Demonstrates the economic layer end to end: a real second wallet purchases a
// listed CoinPassport. Because a TransferPolicy with a 1% royalty rule guards
// the type, the chain will not settle unless the buyer also pays the royalty to
// the storage fund. The SDK's purchaseAndResolve splits the price and the
// royalty from the buyer's gas coin and resolves the policy automatically.

import 'dotenv/config';
import { readFileSync } from 'node:fs';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk, KioskTransaction } from '@mysten/kiosk';
import { Ed25519Keypair } from '@mysten/sui/keypairs/ed25519';
import { requirePackageId, NETWORK } from './client';

// Load a specific wallet's ed25519 key from the Sui CLI keystore by address.
function loadKeypairByAddress(addr: string): Ed25519Keypair {
  const ksPath = process.env.SUI_KEYSTORE ?? join(homedir(), '.sui', 'sui_config', 'sui.keystore');
  const entries: string[] = JSON.parse(readFileSync(ksPath, 'utf8'));
  for (const e of entries) {
    const raw = Buffer.from(e, 'base64');
    if (raw.length === 33 && raw[0] === 0x00) {
      const kp = Ed25519Keypair.fromSecretKey(new Uint8Array(raw.subarray(1, 33)));
      if (kp.toSuiAddress() === addr) return kp;
    }
  }
  throw new Error(`No ed25519 key for ${addr} found in keystore ${ksPath}`);
}

async function main() {
  const pkg = requirePackageId();
  const buyerAddr = process.argv[2] || process.env.BUYER_ADDRESS || '';
  const itemId = process.argv[3] || '';
  const sellerKiosk = process.argv[4] || '';
  const price = process.argv[5] ?? '100000000'; // 0.1 SUI default
  if (!buyerAddr || !itemId || !sellerKiosk) {
    throw new Error('Usage: npm run buy <buyerAddress> <passportId> <sellerKioskId> [priceMist]');
  }

  const keypair = loadKeypairByAddress(buyerAddr);
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK }).$extend(kiosk());
  const itemType = `${pkg}::passport::CoinPassport`;

  // The buyer needs a kiosk to receive the purchased item (no lock rule, so it
  // lands in the buyer's kiosk). Create one in the same tx if they have none.
  const { kioskOwnerCaps } = await client.kiosk.getOwnedKiosks({ address: buyerAddr });
  const fresh = kioskOwnerCaps.length === 0;
  const tx = new Transaction();
  const ktx = fresh
    ? new KioskTransaction({ transaction: tx, kioskClient: client.kiosk })
    : new KioskTransaction({ transaction: tx, kioskClient: client.kiosk, cap: kioskOwnerCaps[0] });
  if (fresh) ktx.create();

  await ktx.purchaseAndResolve({ itemType, itemId, price, sellerKiosk });

  if (fresh) ktx.shareAndTransferCap(buyerAddr);
  ktx.finalize();

  console.log(`Buyer   ${buyerAddr}`);
  console.log(`Item    ${itemId}`);
  console.log(`Price   ${Number(price) / 1e9} SUI  +  1% royalty enforced by policy\n`);

  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showObjectChanges: true, showBalanceChanges: true, showEffects: true },
  });

  console.log(`status:  ${res.effects?.status?.status}`);
  console.log(`digest:  ${res.digest}`);
  console.log(`explorer: https://suiscan.xyz/testnet/tx/${res.digest}\n`);
  if (res.balanceChanges?.length) {
    console.log('balance changes (SUI):');
    for (const b of res.balanceChanges) {
      const who = typeof b.owner === 'object' && 'AddressOwner' in b.owner ? b.owner.AddressOwner : JSON.stringify(b.owner);
      console.log(`  ${(Number(b.amount) / 1e9).toFixed(6).padStart(12)}  ${who}`);
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
