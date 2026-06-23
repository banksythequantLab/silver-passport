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
import { readFile, writeFile } from 'node:fs/promises';
import { join, extname, resolve, sep } from 'node:path';
import { spawn } from 'node:child_process';
import { FULLNODE, requirePackageId, RETIRED_PASSPORTS, GOLD_PASSPORTS } from './client';

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

let spotCache: { silver_usd_per_oz: number; gold_usd_per_oz: number | null; sui_usd: number | null; as_of: string; source: string } | null = null;
let spotAt = 0;
async function fetchMetal(sym: string): Promise<{ price: number; at: string } | null> {
  try {
    const r = await fetch(`https://api.gold-api.com/price/${sym}`, { signal: AbortSignal.timeout(8000) });
    const j: any = await r.json();
    if (j && typeof j.price === 'number' && j.price > 0) return { price: j.price, at: j.updatedAt || new Date().toISOString() };
  } catch { /* non-critical */ }
  return null;
}
async function fetchSuiUsd(): Promise<number | null> {
  try {
    const r = await fetch('https://api.coingecko.com/api/v3/simple/price?ids=sui&vs_currencies=usd', { signal: AbortSignal.timeout(8000) });
    const j: any = await r.json();
    if (j && j.sui && typeof j.sui.usd === 'number' && j.sui.usd > 0) return j.sui.usd;
  } catch { /* non-critical */ }
  return null;
}
async function getSpot() {
  if (spotCache && Date.now() - spotAt < 600_000) return spotCache;
  const [ag, au, su] = await Promise.all([fetchMetal('XAG'), fetchMetal('XAU'), fetchSuiUsd()]);
  if (ag) {
    spotCache = {
      silver_usd_per_oz: +ag.price.toFixed(2),
      gold_usd_per_oz: au ? +au.price.toFixed(2) : (spotCache?.gold_usd_per_oz ?? null),
      sui_usd: su ? +su.toFixed(4) : (spotCache?.sui_usd ?? null),
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
    for (const e of page.data) { const pid = e.parsedJson.passport_id; if (!RETIRED_PASSPORTS.has(pid) && !GOLD_PASSPORTS.has(pid)) ids.push(pid); }
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
    if (url === '/api/history') {
      let hist = [];
      try { hist = JSON.parse(await readFile(resolve('data/reserve-memory.json'), 'utf8')); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ history: hist.slice().reverse() }));
    }
    if (url === '/api/reaudit' && req.method === 'POST') {
      try {
        await new Promise((ok, no) => {
          const env = { ...process.env, OLLAMA_MODEL: process.env.OLLAMA_MODEL ?? 'qwen3:30b-a3b-instruct-2507-q4_K_M' };
          const child = spawn('npx', ['tsx', 'src/audit.ts'], { env, shell: true, stdio: 'ignore' });
          child.on('exit', (code) => code === 0 ? ok(null) : no(new Error('audit exited ' + code)));
          child.on('error', no);
        });
        cache = null;
        let hist = [];
        try { hist = JSON.parse(await readFile(resolve('data/reserve-memory.json'), 'utf8')); } catch {}
        res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: true, latest: hist[hist.length - 1] || null }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
        return res.end(JSON.stringify({ ok: false, error: (e && e.message) || 'audit failed' }));
      }
    }
    if (url === '/api/ask' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      const q = (JSON.parse(body || '{}').question || '').slice(0, 500);
      const answer = await ask(q);
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ answer }));
    }
    if (url === '/api/seller-application' && req.method === 'POST') {
      let body = '';
      for await (const chunk of req) body += chunk;
      let app: any = {};
      try { app = JSON.parse(body || '{}'); } catch {}
      app.at = app.at || new Date().toISOString();
      const apath = resolve('data/seller-applications.json');
      let list: any[] = [];
      try { list = JSON.parse(await readFile(apath, 'utf8')); } catch {}
      list.push(app);
      await writeFile(apath, JSON.stringify(list, null, 2));
      let emailed = false;
      const to = process.env.NOTIFY_EMAIL;
      if (to && process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
        try {
          const nodemailer = (await import('nodemailer')).default;
          const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port: Number(process.env.SMTP_PORT || 587), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
          const rows = Object.entries({ Business: app.business, EIN: app.ein, State: app.state, Address: app.address, Wallet: app.wallet, 'W-9': app.w9, Submitted: app.at }).map(function(kv){ return '<tr><td style="padding:6px 14px;color:#7f9483;font-family:monospace;border-bottom:1px solid #eee">'+kv[0]+'</td><td style="padding:6px 14px;border-bottom:1px solid #eee">'+(kv[1]||'-')+'</td></tr>'; }).join('');
          const html = '<div style="font-family:system-ui,sans-serif;max-width:580px;color:#1a1a1a"><h2 style="font-family:Georgia,serif;font-weight:600">New verified-seller application</h2><table style="border-collapse:collapse;width:100%;border:1px solid #eee;border-radius:8px;overflow:hidden">'+rows+'</table><p style="color:#888;font-size:12px;margin-top:16px">Approve on-chain:<br><code style="background:#f4f4f2;padding:4px 8px;border-radius:4px">npx tsx src/verify-seller.ts '+(app.wallet||'')+'</code></p><p style="color:#aaa;font-size:11px">Silver Passport · Sui testnet</p></div>';
          await t.sendMail({ from: process.env.SMTP_FROM || process.env.SMTP_USER, to, subject: 'Seller application: ' + (app.business || '(unknown)'), text: JSON.stringify(app, null, 2), html: html });
          emailed = true;
        } catch (e: any) { console.error('email failed:', e?.message); }
      }
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: true, count: list.length, emailed }));
    }
    if (url === '/api/listings') {
      let listings: any[] = [];
      try { listings = JSON.parse(await readFile(resolve('data/listings.json'), 'utf8')); } catch {}
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ listings }));
    }
    if (url === '/api/list' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const { item, price, premiumPct } = JSON.parse(body || '{}');
      if (!item) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'item required' })); }
      const priceMist = String(price || '100000000');
      const { Transaction } = await import('@mysten/sui/transactions');
      const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import('@mysten/sui/jsonRpc');
      const { kiosk, KioskTransaction } = await import('@mysten/kiosk');
      const { loadKeypair } = await import('./client');
      const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' }).$extend(kiosk());
      const keypair = loadKeypair();
      const me = keypair.toSuiAddress();
      const itemType = `${PKG}::passport::CoinPassport`;
      const owned = await client.kiosk.getOwnedKiosks({ address: me });
      const tx = new Transaction();
      const ktx = new KioskTransaction({ transaction: tx, kioskClient: client.kiosk });
      const fresh = owned.kioskOwnerCaps.length === 0;
      if (fresh) ktx.create(); else ktx.setCap(owned.kioskOwnerCaps[0]);
      ktx.placeAndList({ itemType, item, price: priceMist });
      if (fresh) ktx.shareAndTransferCap(me);
      ktx.finalize();
      const exec = await client.signAndExecuteTransaction({ transaction: tx, signer: keypair, options: { showEffects: true } });
      const status = exec.effects?.status?.status;
      const after = await client.kiosk.getOwnedKiosks({ address: me });
      const kioskId = after.kioskIds[0] || null;
      let product = '', seq: any = null, silver_oz: any = null;
      try { const rv = await reserve(); const u = rv.passports.find((p: any) => p.id === item); if (u) { product = u.product; seq = u.seq; silver_oz = u.silver_oz; } } catch {}
      const lpath = resolve('data/listings.json');
      let listings: any[] = [];
      try { listings = JSON.parse(await readFile(lpath, 'utf8')); } catch {}
      listings = listings.filter((l) => l.itemId !== item);
      listings.push({ itemId: item, kioskId, price: priceMist, product, seq, silver_oz, premiumPct: (premiumPct ?? null), listedAt: new Date().toISOString() });
      await writeFile(lpath, JSON.stringify(listings, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: status === 'success', status, digest: exec.digest, kioskId }));
    }
    if (url === '/api/buy-build' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const { buyer, item, sellerKiosk, price } = JSON.parse(body || '{}');
      if (!buyer || !item || !sellerKiosk) { res.writeHead(400, { 'Content-Type': 'application/json' }); return res.end(JSON.stringify({ error: 'buyer,item,sellerKiosk required' })); }
      const { Transaction } = await import('@mysten/sui/transactions');
      const { SuiJsonRpcClient, getJsonRpcFullnodeUrl } = await import('@mysten/sui/jsonRpc');
      const { kiosk, KioskTransaction } = await import('@mysten/kiosk');
      const client = new SuiJsonRpcClient({ url: getJsonRpcFullnodeUrl('testnet'), network: 'testnet' }).$extend(kiosk());
      const itemType = `${PKG}::passport::CoinPassport`;
      const owned = await client.kiosk.getOwnedKiosks({ address: buyer });
      const fresh = owned.kioskOwnerCaps.length === 0;
      const tx = new Transaction();
      tx.setSender(buyer);
      const ktx = fresh ? new KioskTransaction({ transaction: tx, kioskClient: client.kiosk }) : new KioskTransaction({ transaction: tx, kioskClient: client.kiosk, cap: owned.kioskOwnerCaps[0] });
      if (fresh) ktx.create();
      await ktx.purchaseAndResolve({ itemType, itemId: item, price: String(price || '100000000'), sellerKiosk });
      if (fresh) ktx.shareAndTransferCap(buyer);
      ktx.finalize();
      const txJson = await tx.toJSON();
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: true, tx: txJson }));
    }
    if (url === '/api/listing-remove' && req.method === 'POST') {
      let body = ''; for await (const chunk of req) body += chunk;
      const { item } = JSON.parse(body || '{}');
      const lpath = resolve('data/listings.json');
      let listings: any[] = [];
      try { listings = JSON.parse(await readFile(lpath, 'utf8')); } catch {}
      listings = listings.filter((l) => l.itemId !== item);
      await writeFile(lpath, JSON.stringify(listings, null, 2));
      res.writeHead(200, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
      return res.end(JSON.stringify({ ok: true, count: listings.length }));
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
