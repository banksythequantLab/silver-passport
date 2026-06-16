// List a passport for sale in a Kiosk, under the royalty policy.
//
//   npm run list <passportId> [priceMist]
//
// Places the passport into a Kiosk and lists it. Because a TransferPolicy with
// a royalty rule exists for CoinPassport (see `npm run policy`), any buyer must
// pay the listed price PLUS the 1% marketplace cut to the storage fund — the
// chain will not settle the purchase otherwise.

import 'dotenv/config';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk, KioskTransaction } from '@mysten/kiosk';
import { loadKeypair, requirePackageId, NETWORK } from './client';

async function main() {
  const pkg = requirePackageId();
  const passportId = process.argv[2];
  const priceMist = process.argv[3] ?? '100000000'; // default 0.1 SUI
  if (!passportId) throw new Error('Usage: npm run list <passportId> [priceMist]');

  const keypair = loadKeypair();
  const me = keypair.toSuiAddress();
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK }).$extend(kiosk());
  const itemType = `${pkg}::passport::CoinPassport`;

  const { kioskOwnerCaps } = await client.kiosk.getOwnedKiosks({ address: me });
  const tx = new Transaction();
  const ktx = new KioskTransaction({ transaction: tx, kioskClient: client.kiosk });
  const fresh = kioskOwnerCaps.length === 0;
  if (fresh) ktx.create();
  else ktx.setCap(kioskOwnerCaps[0]);

  ktx.placeAndList({ itemType, item: passportId, price: priceMist });
  if (fresh) ktx.shareAndTransferCap(me);
  ktx.finalize();

  const res = await client.signAndExecuteTransaction({
    transaction: tx,
    signer: keypair,
    options: { showObjectChanges: true },
  });

  console.log(`Listed ${passportId.slice(0, 10)}… for ${Number(priceMist) / 1e9} SUI`);
  console.log(`Digest: ${res.digest}`);
  console.log('A buyer pays the price + 1% royalty to the storage fund; the policy enforces it on-chain.');
}

main().catch((e) => { console.error(e); process.exit(1); });
