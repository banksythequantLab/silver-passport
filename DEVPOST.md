# Silver Passport — Devpost submission

*Copy/paste into the Devpost fields. Sections map to Devpost's standard prompts.*

---

## Elevator pitch (one line)

Verifiable custody passports for physical silver, on Sui + Walrus — with an AI reserve-auditor that uses Walrus as its data and memory layer and never invents a number.

**Live demo: https://bagof.fun** — the reserve vault, a per-coin certificate, and "Ask the Vault" (a live AI agent), all reading straight from chain.

---

## Inspiration

"Proof of reserve" is everywhere in crypto, and almost all of it has the same hole: a custodian *asserts* what they hold, and you trust the assertion. The honest version of the problem isn't "make trust unnecessary" — it's "make the assertion tamper-evident, timestamped, and independently checkable." That's exactly what bullion dealers, vaults, and auditors have always done with witnessed attestation.

We had actual silver on the desk — Peace dollars, rolls of Mercury dimes, rolls of war nickels — so we could build the honest version instead of simulating custody. Each physical unit becomes one on-chain object pointing at photographic evidence that's locked on Walrus, and anyone can re-check it from public infrastructure.

## What it does

- **Mints a passport per unit.** A single coin, or a sealed roll, becomes one Sui `CoinPassport` object carrying product, year, weight, purity, and an on-chain-derived silver content — plus a Walrus blob ID for its photo.
- **Verifies live.** A certificate page takes any passport ID, reads the object from a public Sui node, and pulls the photo straight from a public Walrus aggregator. Nothing is pre-loaded; it works even from `file://`.
- **Audits the whole vault with an AI agent.** A reserve-auditor enumerates every passport from on-chain mint events, computes the totals **deterministically**, asks a local LLM to write the plain-language attestation, and **stores that attestation back on Walrus as its own memory**.
- **Answers questions live.** "Ask the Vault" is a public chat agent: it pulls the live reserve from chain, marks it up with a live silver/gold spot price, and lets a local LLM answer questions ("how much silver?", "what's it worth?") grounded only in those figures — it cannot quote a number that isn't real.
- **Values the reserve at spot.** The dashboard and agent fetch live silver and gold prices, so the vault shows an approximate USD value (e.g. ~27.27 oz ≈ $1.9k) alongside the on-chain ounces.
- **Enforces an economic layer — and we proved it.** Passports trade through a Sui Kiosk under a `TransferPolicy` with a royalty rule, so a sale can't settle on-chain without paying the marketplace cut. We ran a real sale: a second wallet bought a listed Peace dollar, and the chain refused to settle until the 1% royalty was paid into the policy. Both the purchase and the collected royalty are on testnet.

## How Walrus is the data *and* memory layer

This is the heart of the Walrus-track entry:

- **Data layer:** every passport's evidence (the coin photo, and room for documents) lives as a Walrus blob. The Sui object is small and just references the blob; the heavy, permanent, content-addressed evidence is on Walrus.
- **Memory layer:** the auditor agent writes each reserve attestation — totals, per-product breakdown, the AI's prose, and a timestamp — as a Walrus blob, and keeps an index of those blobs as its audit history. The agent can recall what it attested and when, from Walrus, not from local state.

The design rule that makes the agent trustworthy: **the numbers come from chain, never from the model.** The LLM only narrates figures it is structurally prevented from changing, and the agent degrades gracefully (stores the figures without prose) if the model is offline.

## How we built it

- **Move (Sui):** a `CoinPassport` object with an on-chain silver-content calculation, a `PassportMinted` event for enumeration, and a one-time-witness `init` that claims the `Publisher` needed for Kiosk royalties.
- **TypeScript:** upload → mint → verify scripts on `@mysten/sui` (v2 line, gRPC + `.core`) and `@mysten/walrus`; a Kiosk royalty policy + listing on `@mysten/kiosk`.
- **The agent:** Node + a local Ollama model (`qwen3:30b`), reading events and objects over JSON-RPC, writing attestations to Walrus.
- **The front end:** two dependency-free pages — a per-passport certificate and a live reserve **vault dashboard** that enumerates the whole reserve in-browser and shows the agent's latest Walrus-stored attestation.

## Honest framing (what it proves, and what it doesn't)

A passport proves the attestor asserted custody of a specific unit and **locked the evidence at a recorded moment**, tamper-evidently. It does **not** prove the unit is still held today, or that one coin wasn't photographed twice. That is witnessed attestation — the same trust model real proof-of-reserve uses. We put this disclaimer in the contract's documentation, on the certificate, on the dashboard, and in the agent's own summary. The pitch never overclaims into "trustless physical custody," because that would be false.

## Challenges

- A Sui `Publisher` can only be claimed in `init` at first publish, so adding Kiosk royalties meant a fresh package version and a re-mint — a real constraint worth documenting.
- Keeping the AI honest: we route every figure through deterministic on-chain reads and let the model write prose only, so a hallucinated reserve is structurally impossible.
- v2 SDK churn (the `@mysten/sui` 2.x gRPC/`.core` API) meant verifying every call against current docs rather than trusting older patterns.

## Accomplishments

Six real passports live on testnet — 402 coins, ~27.27 troy oz of silver, including multi-roll batches each backed by its own real photo — every one independently verifiable. An AI agent that writes auditable, Walrus-stored reserve reports and answers live questions grounded only in on-chain figures. An on-chain royalty layer we didn't just configure but **demonstrated with a real sale** (the policy collected its 1% cut). And the whole thing is **live on a public domain, `bagof.fun`** — vault, certificates, and the agent — served straight off chain + Walrus.

## What's next

Redemption logistics, a verifier that confirms *current* custody (not just attested-at), extension to bars, collectibles, and warehouse receipts, and serious legal work (securities / money-transmission) before any mainnet, redeemable-token step. This stays on testnet until that's done.

## Built with

Sui, Move, Walrus, Sui Kiosk / TransferPolicy, `@mysten/sui`, `@mysten/walrus`, `@mysten/kiosk`, TypeScript, Node, Ollama (local LLM), HTML/JS.

## Links / on-chain proof (testnet)

- **Live demo:** https://bagof.fun (vault · `/index.html#<id>` certificate · `/ask.html` agent)
- Repo: https://github.com/banksythequantLab/silver-passport
- Package: `0x8b8d40c850e716600fa9398ba01db62376cc865e5472c0f5cff975feb50ae03b`
- Royalty policy: `0x5c3ca094a5a422aa24cd90228480f749b70be4a9dddb848d8ccff34b0aa4fffc`
- A sample passport (Peace dollar): `0xb670ffca780e38f5b26de5ef30c44328c2c57c52621fcb049950fb83620ce148`
- Multi-roll batch passports (each with its own real photo on Walrus): war nickels 4-roll `0xcfce05d3c6d2353b1f9eebb119acd59a25d287de12bdcf61287b76db49ea8d16`, Mercury dimes 3-roll `0x135a0c44557ca8c53a3dbf1519d1dc52b70eaf795644e6fa41d4cdb8b770392f`
- **Royalty sale (the policy enforced its 1% cut):** tx `5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD` — https://suiscan.xyz/testnet/tx/5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD
- An agent attestation on Walrus: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/7vwXi84CgTGkbn96HEOZhPrTn6eWMaGzuKFJwKwVe5U`
