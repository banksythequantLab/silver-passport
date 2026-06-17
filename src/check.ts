// Smoke test - prove the reserve is real, straight from chain + Walrus. No browser, no server.
//   npm run check
import 'dotenv/config';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { FULLNODE, requirePackageId, RETIRED_PASSPORTS } from './client';

const OZ = 31103;
const AGG = 'https://aggregator.walrus-testnet.walrus.space/v1/blobs/';

async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(FULLNODE, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || method);
  return j.result;
}

let pass = 0, fail = 0;
function check(label: string, cond: boolean, detail = '') {
  console.log(`  [${cond ? 'ok' : '!!'}] ${label}${detail ? ' - ' + detail : ''}`);
  if (cond) pass++; else fail++;
}

async function main() {
  const pkg = requirePackageId();
  console.log(`\nSilver Passport smoke test\n  package ${pkg}\n`);

  const ids: string[] = [];
  let cursor: unknown = null;
  do {
    const page = await rpc('suix_queryEvents', [{ MoveEventType: `${pkg}::passport::PassportMinted` }, cursor, 50, false]);
    for (const e of page.data) { const pid = e.parsedJson.passport_id; if (!RETIRED_PASSPORTS.has(pid)) ids.push(pid); }
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  check('passports enumerated from chain', ids.length > 0, ids.length + ' active');

  let mg = 0, coins = 0;
  for (const id of ids) {
    const r = await rpc('sui_getObject', [id, { showContent: true }]);
    const f = r.data?.content?.fields;
    if (f) { mg += Number(f.silver_content_mg); coins += Number(f.quantity); }
  }
  const oz = +(mg / OZ).toFixed(4);
  check('on-chain silver computed', oz > 0, oz + ' troy oz across ' + coins + ' coins');

  const memPath = resolve('data/reserve-memory.json');
  const idx = existsSync(memPath) ? JSON.parse(readFileSync(memPath, 'utf8')) : [];
  const latest = idx[idx.length - 1];
  check('agent has audit memory', !!latest, latest ? idx.length + ' attestation(s)' : 'run npm run audit');
  if (latest) {
    let att: any = null;
    try { att = await (await fetch(AGG + latest.blobId)).json(); } catch {}
    check('latest attestation resolves on Walrus', !!att, latest.blobId);
    if (att && att.totals) check('attestation matches live chain', Math.abs(att.totals.silver_oz - oz) < 0.001 && att.totals.passports === ids.length, 'attested ' + att.totals.silver_oz + ' oz / ' + att.totals.passports + ' passports');
  }

  console.log(`\n  ${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
}
main().catch((e) => { console.error('  [!!] error:', e.message); process.exit(1); });