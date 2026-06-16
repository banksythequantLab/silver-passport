// Silver Passport agent server.
//
//   npm run serve
//
// Serves the verify/ pages and exposes a grounded reserve agent:
//   GET  /api/reserve  -> live reserve, enumerated from chain
//   POST /api/ask {question} -> a local LLM answers, grounded ONLY in that data
//
// The agent never sees a number it can invent: every figure is read from Sui
// and handed to the model as authoritative context. Powers the "Ask the Vault"
// page. The static pages still work from file:// without this server.

import 'dotenv/config';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { FULLNODE, requirePackageId } from './client';

const PORT = Number(process.env.PORT ?? 8899);
const OLLAMA = process.env.OLLAMA_URL ?? 'http://localhost:11434';
const CHAT_MODEL = process.env.CHAT_MODEL ?? 'mistral:7b';
const PKG = requirePackageId();
const WEB = resolve('verify');
const OZ = 31103;

async function rpc(method: string, params: unknown[]): Promise<any> {
  const r = await fetch(FULLNODE, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }) });
  const j = await r.json();
  if (j.error) throw new Error(j.error.message || method);
  return j.result;
}

let cache: { at: number; data: any } | null = null;

let spotCache: { silver_usd_per_oz: number; gold_usd_per_oz: number | null; as_of: string; source: string } | null = null;
let spotAt = 0;
async function fetchMetal(sym: string): Promise<{ price: number; at: string } | null> {
  try {
    const r = await fetch(`https://api.gold-api.com/price/${sym}`, { signal: AbortSignal.timeout(8000) });
    const j: any = await r.json();
    if (j && typeof j.price === 'number' && j.price > 0) return { price: j.price, at: j.updatedAt || new Date().toISOString() };
  } catch { /* non-critical */ }
  return null;
}
async function getSpot() {
  if (spotCache && Date.now() - spotAt < 600_000) return spotCache;
  const [ag, au] = await Promise.all([fetchMetal('XAG'), fetchMetal('XAU')]);
  if (ag) {
    spotCache = {
      silver_usd_per_oz: +ag.price.toFixed(2),
      gold_usd_per_oz: au ? +au.price.toFixed(2) : (spotCache?.gold_usd_per_oz ?? null),
      as_of: ag.at,
      source: 'gold-api.com',
    };
    spotAt = Date.now();
  }
  return spotCache;
}

async function reserve() {
  if (cache && Date.now() - cache.at < 10_000) return cache.data;
  const ids: string[] = [];
  let cursor: unknown = null;
  do {
    const page = await rpc('suix_queryEvents', [{ MoveEventType: `${PKG}::passport::PassportMinted` }, cursor, 50, false]);
    for (const e of page.data) ids.push(e.parsedJson.passport_id);
    cursor = page.hasNextPage ? page.nextCursor : null;
  } while (cursor);
  const units: any[] = [];
  for (const id of ids) {
    const r = await rpc('sui_getObject', [id, { showContent: true }]);
    const f = r.data?.content?.fields;
    if (f) units.push({ id, seq: +f.sequence, product: f.product, unit: f.unit, year: +f.year,
      qty: +f.quantity, purity: +f.purity, silver_oz: +(Number(f.silver_content_mg) / OZ).toFixed(4) });
  }
  units.sort((a, b) => a.seq - b.seq);
  const silver_oz = +(units.reduce((s, u) => s + u.silver_oz, 0)).toFixed(4);
  const coins = units.reduce((s, u) => s + u.qty, 0);
  const byProduct: Record<string, { units: number; coins: number; silver_oz: number }> = {};
  for (const u of units) {
    (byProduct[u.product] ||= { units: 0, coins: 0, silver_oz: 0 });
    byProduct[u.product].units++; byProduct[u.product].coins += u.qty;
    byProduct[u.product].silver_oz = +(byProduct[u.product].silver_oz + u.silver_oz).toFixed(4);
  }
  const spot = await getSpot();
  const usd_value = spot ? +(silver_oz * spot.silver_usd_per_oz).toFixed(2) : null;
  const data = { package: PKG, network: 'testnet', totals: { passports: units.length, coins, silver_oz, usd_value }, spot, byProduct, passports: units };
  cache = { at: Date.now(), data };
  return data;
}

async function ask(question: string): Promise<string> {
  const data = await reserve();
  const system =
    'You are the Silver Passport reserve auditor, an AI agent for a vault of physical silver tracked on the Sui blockchain. ' +
    'Answer the user using ONLY the DATA provided, which was read live from chain and is authoritative. ' +
    'Never invent or estimate a number that is not in the DATA. Keep answers to 1-3 sentences, concrete and friendly. ' +
    'For value questions, use DATA.totals.usd_value and DATA.spot, which carries live spot prices in USD per troy oz: DATA.spot.silver_usd_per_oz and DATA.spot.gold_usd_per_oz. The vault holds silver, so usd_value reflects the silver content; cite the silver per-ounce price and call it an approximate spot value. You may also state the live gold price if asked. ' +
    'If relevant, note this attests custody recorded on-chain, not independently verified physical holdings.';
  const r = await fetch(`${OLLAMA}/api/chat`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: CHAT_MODEL, stream: false, keep_alive: '30m',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: `DATA:\n${JSON.stringify(data, null, 2)}\n\nQUESTION: ${question}` },
      ] }),
  });
  const j = await r.json();
  let a: string = j.message?.content ?? '';
  const close = a.lastIndexOf('</think>');
  if (close !== -1) a = a.slice(close + 8);
  return a.trim() || 'I could not produce an answer.';
}

const MIME: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg', '.ico': 'image/x-icon' };

createServer(async (req, res) => {
  try {
    const url = (req.url || '/').split('?')[0];
    if (url === '/api/reserve') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(await reserve()));
    }
    if (url === '/api/spot') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify(await getSpot() ?? { error: 'spot unavailable' }));
    }
    if (url === '/api/ask' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const q = (JSON.parse(body || '{}').question || '').slice(0, 500);
      const answer = await ask(q);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ answer }));
    }
    // static
    const rel = url === '/' ? 'vault.html' : url.replace(/^\/+/, '');
    const file = resolve(WEB, rel);
    if (!file.startsWith(WEB + sep)) { res.writeHead(403); return res.end('forbidden'); }
    const buf = await readFile(file);
    res.writeHead(200, { 'Content-Type': MIME[extname(file)] || 'application/octet-stream' });
    res.end(buf);
  } catch (e: any) {
    res.writeHead(e?.code === 'ENOENT' ? 404 : 500, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: e?.message || 'error' }));
  }
}).listen(PORT, () => {
  console.log(`Silver Passport agent on http://localhost:${PORT}`);
  console.log(`  Ask the Vault: http://localhost:${PORT}/`);
  console.log(`  Vault board:   http://localhost:${PORT}/vault.html`);
  console.log(`  Chat model:    ${CHAT_MODEL}`);
});
