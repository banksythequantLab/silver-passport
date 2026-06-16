// Create a TransferPolicy for CoinPassport with a royalty rule.
//
//   npm run policy
//
// One-time setup. Every on-chain sale of a passport must then pay the royalty
// (the marketplace cut) to the policy owner — the storage fund. Requires
// PUBLISHER_ID in .env (from the v3 publish).

import 'dotenv/config';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk, TransferPolicyTransaction, percentageToBasisPoints } from '@mysten/kiosk';
import { loadKeypair, requirePackageId, NETWORK } from './client';

const ROYALTY_PCT = Number(process.env.ROYALTY_PCT ?? 1); // marketplace cut, %

async function main() {
  const pkg = requirePackageId();
  const publisher = process.env.PUBLISHER_ID;
  if (!publisher) throw new Error('PUBLISHER_ID missing in .env (from the v3 publish).');

  const keypair = loadKeypair();
  const me = keypair.toSuiAddress();
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK }).$extend(kiosk());
  const type = `${pkg}::passport::CoinPassport`;

  const tx = new Transaction();
  const tpTx = new TransferPolicyTransaction({ kioskClient: client.kiosk, transaction: tx });
  await tpTx.create({ type, publisher });
  tpTx.addRoyaltyRule(percentageToBasisPoints(ROYALTY_PCT), 0).shareAndTransferCap(me);

  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showObjectChanges: true },
  });

  console.log(`Transfer policy created with a ${ROYALTY_PCT}% royalty.`);
  console.log(`Digest: ${res.digest}\n`);
  for (const c of res.objectChanges ?? []) {
    if (c.type === 'created') console.log(`  created: ${c.objectType}\n           ${c.objectId}`);
  }
  console.log('\nFee model: this royalty is the MARKETPLACE cut. Storage and redemption');
  console.log('fees are separate sinks (annual demurrage + redemption-time fee), by design.');
}

main().catch((e) => { console.error(e); process.exit(1); });
