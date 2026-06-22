import { Transaction } from '@mysten/sui/transactions';
import { sui, loadKeypair, requirePackageId, FULLNODE } from './client';

async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(FULLNODE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function main() {
  const who = process.argv[2];
  if (!who || !who.startsWith('0x')) throw new Error('Usage: npx tsx src/verify-seller.ts <0xADDRESS>');
  const pkg = requirePackageId();
  const registry = process.env.REGISTRY_ID;
  if (!registry) throw new Error('REGISTRY_ID missing in .env');
  const keypair = loadKeypair();
  const operator = keypair.getPublicKey().toSuiAddress();

  const owned = await rpc('suix_getOwnedObjects', [operator, { filter: { StructType: `${pkg}::passport::AdminCap` }, options: { showType: true } }, null, 50]);
  const adminCap = owned?.data?.[0]?.data?.objectId;
  if (!adminCap) throw new Error(`No AdminCap owned by operator ${operator}`);
  console.log(`Operator:   ${operator}`);
  console.log(`AdminCap:   ${adminCap}`);
  console.log(`Registry:   ${registry}`);
  console.log(`Verifying:  ${who}\n`);

  const tx = new Transaction();
  tx.moveCall({ target: `${pkg}::passport::add_verifier`, arguments: [tx.object(adminCap), tx.object(registry), tx.pure.address(who)] });
  const result = await sui.core.signAndExecuteTransaction({ transaction: tx, signer: keypair, include: { effects: true } });
  if (result.$kind === 'FailedTransaction') throw new Error(`Failed: ${JSON.stringify(result.FailedTransaction.status)}`);
  const digest = result.Transaction.digest;
  console.log(`Digest:     ${digest}`);
  console.log(`Explorer:   https://suiscan.xyz/testnet/tx/${digest}\n`);

  try {
    const reg = await rpc('sui_getObject', [registry, { showContent: true }]);
    const tableId = reg?.data?.content?.fields?.verifiers?.fields?.id?.id;
    const field = tableId ? await rpc('suix_getDynamicFieldObject', [tableId, { type: 'address', value: who }]) : null;
    console.log(`is_verified(${who.slice(0, 12)}...): ${field?.data ? 'TRUE - this wallet can now mint' : 'pending (re-check shortly)'}`);
  } catch (e: any) { console.log(`Added (tx ok). Confirm read skipped: ${e.message}`); }
}

main().catch((e) => { console.error(e); process.exit(1); });