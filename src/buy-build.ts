import 'dotenv/config';
import { Transaction } from '@mysten/sui/transactions';
import { SuiJsonRpcClient, getJsonRpcFullnodeUrl } from '@mysten/sui/jsonRpc';
import { kiosk, KioskTransaction } from '@mysten/kiosk';
import { requirePackageId, NETWORK } from './client';

async function main() {
  const buyer = process.argv[2];
  const itemId = process.argv[3];
  const sellerKiosk = process.argv[4];
  const price = process.argv[5] ?? '100000000';
  if (!buyer || !itemId || !sellerKiosk) throw new Error('usage: buy-build <buyer> <item> <sellerKiosk> [price]');
  const pkg = requirePackageId();
  const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl(NETWORK), network: NETWORK }).$extend(kiosk());
  const itemType = `${pkg}::passport::CoinPassport`;
  const { kioskOwnerCaps } = await client.kiosk.getOwnedKiosks({ address: buyer });
  const fresh = kioskOwnerCaps.length === 0;
  const tx = new Transaction();
  tx.setSender(buyer);
  const ktx = fresh
    ? new KioskTransaction({ transaction: tx, kioskClient: client.kiosk })
    : new KioskTransaction({ transaction: tx, kioskClient: client.kiosk, cap: kioskOwnerCaps[0] });
  if (fresh) ktx.create();
  await ktx.purchaseAndResolve({ itemType, itemId, price, sellerKiosk });
  if (fresh) ktx.shareAndTransferCap(buyer);
  ktx.finalize();

  const json = await tx.toJSON();
  console.log('toJSON OK - length', json.length, '| fresh-kiosk', fresh);
  try {
    const bytes = await tx.build({ client });
    const dr = await client.dryRunTransactionBlock({ transactionBlock: bytes });
    console.log('dryRun status:', dr.effects?.status?.status);
    for (const b of (dr.balanceChanges ?? [])) {
      const who = (b.owner && b.owner.AddressOwner) ? b.owner.AddressOwner : JSON.stringify(b.owner);
      console.log('  ', (Number(b.amount) / 1e9).toFixed(6).padStart(12), who);
    }
  } catch (e) { console.log('dryRun skipped:', e.message); }
}
main().catch((e) => { console.error(e); process.exit(1); });