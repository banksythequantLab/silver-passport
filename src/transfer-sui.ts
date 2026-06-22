import { Transaction } from '@mysten/sui/transactions';
import { sui, loadKeypair } from './client';

async function main() {
  const to = process.argv[2];
  const amt = Number(process.argv[3] || '0.3');
  if (!to) throw new Error('usage: tsx src/transfer-sui.ts <toAddress> [amountSui]');
  const kp = loadKeypair();
  const from = kp.getPublicKey().toSuiAddress();
  const tx = new Transaction();
  const [coin] = tx.splitCoins(tx.gas, [BigInt(Math.round(amt * 1e9))]);
  tx.transferObjects([coin], to);
  const res = await sui.core.signAndExecuteTransaction({ transaction: tx, signer: kp, include: { effects: true } });
  if ((res as any).$kind === 'FailedTransaction') {
    throw new Error('FAILED ' + JSON.stringify((res as any).FailedTransaction?.status));
  }
  console.log('Sent ' + amt + ' SUI  ' + from + ' -> ' + to);
  console.log('Digest ' + (res as any).Transaction?.digest);
}
main().catch((e) => { console.error(e); process.exit(1); });
