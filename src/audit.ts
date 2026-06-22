// Reserve-auditor agent.
//
//   npm run audit
//
// Enumerates every CoinPassport minted under the package (via PassportMinted
// events), reads each on-chain, computes the reserve totals DETERMINISTICALLY
// (the model never touches the numbers), asks local Ollama to write a plain
// summary from those exact figures, then stores the whole attestation on Walrus
// as the agent's verifiable memory. Appends the memory pointer to a local index
// so the agent remembers its own audit history.

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { walrusClient, loadKeypair, requirePackageId, FULLNODE, WALRUS_EPOCHS, RETIRED_PASSPORTS } from './client';
import { sha256Hex, nextLink, publicChain, PUBLIC_CHAIN, type ChainEntry } from './chain';

const OLLAMA = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const MODEL = process.env.OLLAMA_MODEL ?? 'qwen3:30b';
const MEMORY_INDEX = resolve('data/reserve-memory.json');
const OZ = 31103; // mg of silver per troy oz

async function rpc(method: string, params: unknown[]): Promise<any> {
  const res = await fetch(FULLNODE, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`${method}: ${JSON.stringify(j.error)}`);
  return j.result;
}

async function listPassportIds(pkg: string): Promise<string[]> {
  const ids: string[] = [];
  let cursor: unknown = null;
  do {
    const page = await rpc('suix_queryEvents', [
      { MoveEventType: `${pkg}::passport::PassportMinted` }, cursor, 50, false,
    ]);
    for (const e of page.data) ids.push(e.parsedJson.passport_id);
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  return ids;
}

async function readPassport(id: string) {
  const r = await rpc('sui_getObject', [id, { showContent: true }]);
  const f = r.data?.content?.fields;
  if (!f) return null;
  return {
    id,
    sequence: Number(f.sequence),
    product: f.product as string,
    unit: f.unit as string,
    quantity: Number(f.quantity),
    purity: Number(f.purity),
    silver_mg: Number(f.silver_content_mg),
  };
}

async function ollamaSummary(report: unknown): Promise<string> {
  const system =
    'You are a precise reserve auditor. Write a short, factual reserve attestation ' +
    'summary from the EXACT figures in the JSON. Never invent or change a number. ' +
    'Be concise and professional (one short paragraph). State plainly that this ' +
    'attests custody that was recorded on-chain, not independently verified physical reality.';
  const payload = {
    model: MODEL,
    think: false,
    stream: false,
    keep_alive: '30m', // keep the model resident so re-runs don't reload 18GB
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: JSON.stringify(report, null, 2) },
    ],
  };
  // The first hit may land while the model is loading into VRAM; retry once.
  let lastErr: unknown;
  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const res = await fetch(`${OLLAMA}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const j = await res.json();
      let content: string = j.message?.content ?? '';
      // qwen3 is a thinking model; reasoning can leak into content. Drop
      // everything up to and including the last </think> if present.
      const close = content.lastIndexOf('</think>');
      if (close !== -1) content = content.slice(close + '</think>'.length);
      if (content.trim()) return content.trim();
      lastErr = new Error('empty response');
    } catch (e) {
      lastErr = e;
    }
    if (attempt === 1) await new Promise((r) => setTimeout(r, 45000)); // let the model finish loading
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

async function main() {
  const pkg = requirePackageId();
  console.log(`Auditing reserves under ${pkg}\n`);

  const ids = (await listPassportIds(pkg)).filter((id) => !RETIRED_PASSPORTS.has(id));
  const units = (await Promise.all(ids.map(readPassport))).filter(Boolean) as NonNullable<Awaited<ReturnType<typeof readPassport>>>[];

  const totalSilverMg = units.reduce((s, u) => s + u.silver_mg, 0);
  const totalCoins = units.reduce((s, u) => s + u.quantity, 0);
  const byProduct: Record<string, { units: number; coins: number; silver_oz: number }> = {};
  for (const u of units) {
    const k = u.product;
    byProduct[k] ??= { units: 0, coins: 0, silver_oz: 0 };
    byProduct[k].units += 1;
    byProduct[k].coins += u.quantity;
    byProduct[k].silver_oz = +(byProduct[k].silver_oz + u.silver_mg / OZ).toFixed(4);
  }

  const report = {
    generatedAt: new Date().toISOString(),
    package: pkg,
    network: 'testnet',
    totals: {
      passports: units.length,
      coins: totalCoins,
      silver_oz: +(totalSilverMg / OZ).toFixed(4),
      silver_mg: totalSilverMg,
    },
    byProduct,
    passports: units.map((u) => ({ id: u.id, seq: u.sequence, product: u.product, unit: u.unit, qty: u.quantity, silver_oz: +(u.silver_mg / OZ).toFixed(4) })),
  };

  console.log('Reserve tally (computed on-chain, not by the model):');
  console.log(`  passports: ${report.totals.passports}`);
  console.log(`  coins:     ${report.totals.coins}`);
  console.log(`  silver:    ${report.totals.silver_oz} troy oz\n`);

  let prose = '';
  if (process.env.SKIP_OLLAMA) {
    console.log('SKIP_OLLAMA set — deterministic checkpoint, no LLM prose.\n');
    prose = 'Deterministic reserve checkpoint. Figures are computed directly from the on-chain CoinPassport objects; this attestation is hash-linked to the previous one for tamper-evidence. It attests custody recorded on-chain, not independently verified physical reality.';
  } else {
    process.stdout.write(`Asking ${MODEL} to write the summary… `);
    try { prose = await ollamaSummary(report); console.log('done.\n'); }
    catch (e: any) { console.log(`Ollama unavailable (${e.message}); storing figures without prose.\n`); }
  }

  const index: ChainEntry[] = existsSync(MEMORY_INDEX) ? JSON.parse(readFileSync(MEMORY_INDEX, 'utf8')) : [];
  const link = nextLink(index);

  const memory = { ...report, summary: prose, chain: link };
  const bytes = new TextEncoder().encode(JSON.stringify(memory, null, 2));
  const hash = sha256Hex(bytes);

  process.stdout.write('Storing attestation on Walrus (agent memory)… ');
  const epochTries = [Number(process.env.WALRUS_CHAIN_EPOCHS ?? 30), 10, WALRUS_EPOCHS];
  let blobId = '';
  for (const ep of epochTries) {
    try {
      const res = await walrusClient.walrus.writeBlob({ blob: bytes, deletable: false, epochs: ep, signer: loadKeypair() });
      blobId = res.blobId;
      console.log(`done (epochs=${ep}).\n`);
      break;
    } catch (e: any) {
      console.log(`epochs=${ep} failed (${e.message}); retrying smaller…`);
    }
  }
  if (!blobId) throw new Error('Walrus writeBlob failed for all epoch options.');

  index.push({ at: report.generatedAt, blobId, silver_oz: report.totals.silver_oz, passports: report.totals.passports, height: link.height, hash, prevBlobId: link.prevBlobId, prevHash: link.prevHash });
  writeFileSync(MEMORY_INDEX, JSON.stringify(index, null, 2));
  writeFileSync(PUBLIC_CHAIN, JSON.stringify(publicChain(index), null, 2));

  if (prose) console.log('--- Reserve summary ---\n' + prose + '\n');
  console.log(`Attestation stored on Walrus: ${blobId}`);
  console.log(`  read it: https://aggregator.walrus-testnet.walrus.space/v1/blobs/${blobId}`);
  console.log(`Agent memory index now holds ${index.length} audit(s).`);
  console.log(`Chain height ${link.height} · hash ${hash.slice(0, 16)}… · prev ${link.prevBlobId ? link.prevBlobId.slice(0, 10) + '…' : '(genesis)'}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
