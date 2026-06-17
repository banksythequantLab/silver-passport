# Silver Passport

Verifiable custody passports for physical silver, on **Sui** + **Walrus**. Built for Sui Overflow 2026 (Walrus track).

**Live demo: [bagof.fun](https://bagof.fun)** — the reserve vault dashboard, a per-coin certificate page, and "Ask the Vault" (a live AI agent), all reading straight from Sui + Walrus.

Each physical unit — a single coin, or a sealed roll — gets one Sui object that references photographic evidence stored permanently on Walrus. Anyone can read the object from a public node, pull the evidence back from Walrus, and confirm the attestation. No trust in us required.

On top of that sits an **AI reserve-auditor agent** that uses Walrus as its verifiable data and memory layer: it reads every passport on-chain, computes the reserve, and writes an attestation back to Walrus that it can recall later.

## What it honestly proves

A passport proves the attestor asserted custody of a specific unit and **locked the evidence at a recorded moment**, tamper-evidently. It does **not** prove the unit is still held today, or that one coin wasn't photographed twice. That is witnessed attestation — the same trust model real proof-of-reserve uses. The agent's report says exactly this; the pitch does not overclaim into "trustless physical custody."

## The Walrus-track core: the reserve-auditor agent

`npm run audit` runs an agent that:

1. Enumerates every passport via on-chain `PassportMinted` events, then reads each object.
2. Computes the reserve **deterministically** — the totals come from chain, never from the model.
3. Asks a **local LLM** (Ollama `qwen3:30b`) to write a plain-language attestation from those exact figures.
4. Stores the whole attestation as a **Walrus blob** — the agent's verifiable, retrievable memory — and appends the pointer to a local memory index so it remembers its own audit history.

The separation is the point: Walrus is the data layer (evidence) *and* the memory layer (the agent's attestations), and the AI narrates numbers it is not allowed to invent. The agent degrades gracefully if the LLM is offline (it stores the figures without prose).

## Live on testnet

| Thing | ID |
| --- | --- |
| Package (v3) | `0x8b8d40c850e716600fa9398ba01db62376cc865e5472c0f5cff975feb50ae03b` |
| Publisher | `0xe6cccd67203d650c9c2f5288e28fce4b7e97699a75de18ce94aaf1072eed935c` |
| TransferPolicy\<CoinPassport\> (1% royalty) | `0x5c3ca094a5a422aa24cd90228480f749b70be4a9dddb848d8ccff34b0aa4fffc` |

Six real passports from actual inventory — 402 coins, ~27.27 troy oz silver:

| # | Unit | Silver | Object |
| --- | --- | --- | --- |
| 011 | Peace dollar (1926) | 0.773 oz | `0xb670ffca780e38f5b26de5ef30c44328c2c57c52621fcb049950fb83620ce148` |
| 012 | Mercury dime roll (×50) | 3.617 oz | `0xd22e2eb97b148f539f166f891ff15bdfe249bf32e3c31df4b78a7adc9be221d2` |
| 013 | War nickel roll (×40) | 2.251 oz | `0xfb1207cb7a25341d56f7a4e91ab533f9d8c529e6def392a43b8ab45811f1798b` |
| 014 | Peace dollar (1922) | 0.773 oz | `0xfdd4fb86a66e7a098ac183864c078e7a5274cd65878125c46d95c40af255b80b` |
| 015 | War nickel **4-roll batch** (×160) | 9.002 oz | `0xcfce05d3c6d2353b1f9eebb119acd59a25d287de12bdcf61287b76db49ea8d16` |
| 016 | Mercury dime **3-roll batch** (×150) | 10.851 oz | `0x135a0c44557ca8c53a3dbf1519d1dc52b70eaf795644e6fa41d4cdb8b770392f` |

Each batch passport carries its own real photo on Walrus. Two earlier batch passports minted with placeholder photos were re-minted with the correct evidence; since the contract has no burn, the originals are **retired** — listed in `RETIRED_PASSPORTS` and excluded from the reserve tally and dashboard so their silver isn't double-counted.

A reserve attestation the agent wrote and stored on Walrus:
`https://aggregator.walrus-testnet.walrus.space/v1/blobs/7vwXi84CgTGkbn96HEOZhPrTn6eWMaGzuKFJwKwVe5U`

## The economic layer

Passports trade through a Sui **Kiosk** under a `TransferPolicy` with a royalty rule, so a sale cannot settle on-chain without paying the marketplace cut to the storage fund. That royalty is one of three intended fee sinks — marketplace cut, annual storage (demurrage), and a redemption fee — each separate by design.

```bash
npm run policy                 # one-time: create the TransferPolicy + royalty rule
npm run list <passportId> [priceMist]   # place a passport in a Kiosk and list it
npm run buy <buyerAddr> <passportId> <sellerKioskId> [priceMist]   # buy as another wallet
```

**We demonstrated it.** A second wallet bought a listed Peace dollar; the Kiosk refused to settle until the 1% royalty was paid into the policy, which now holds the collected cut. Sale tx: [`5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD`](https://suiscan.xyz/testnet/tx/5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD).

## The base loop

```
photograph unit -> upload evidence to Walrus -> mint a Sui object referencing it -> verify page re-fetches both
```

```bash
npm run upload data/peace-001.json    # photo -> Walrus blobId (written back into the json)
npm run mint   data/peace-001.json    # mint the on-chain passport
npm run verify <passportId>           # re-fetch object + blob, write verify/data.json
```

`verify/index.html` is the judge-facing page: paste any passport ID (or use `#<id>`), and it fetches the object from a public fullnode and the photo from a public Walrus aggregator, live — works even from `file://`.

## Serve the vault + agent

```bash
npm run serve                  # http://localhost:8899 — vault, certificates, and "Ask the Vault"
```

The server enumerates the whole reserve live from chain, marks it to a live silver/gold spot price (`/api/reserve`, `/api/spot`), and answers grounded questions via a local LLM (`/api/ask`) — it can only quote figures that came from chain. The public demo at **[bagof.fun](https://bagof.fun)** is this server behind a Cloudflare tunnel.

## Layout

```
move/sources/passport.move   # CoinPassport object, mint(), OTW + init that claims the Publisher
src/client.ts                # Sui (gRPC) + Walrus clients; keystore signing (honors PRIMARY_ADDRESS)
src/upload.ts                # photo -> Walrus blob
src/mint.ts                  # mint the on-chain passport
src/verify.ts                # re-fetch object + blob, write the verify bundle
src/audit.ts                 # the reserve-auditor agent (Walrus memory)
src/policy.ts                # create the Kiosk TransferPolicy + royalty rule
src/list.ts                  # list a passport for sale under the policy
src/buy.ts                   # buy a listed passport as another wallet (royalty auto-resolved)
src/server.ts                # serves the vault + certificate + "Ask the Vault" agent (port 8899)
verify/index.html            # live "is this real?" certificate page (+ QR)
verify/vault.html            # live reserve dashboard — Walrus photo gallery, USD at spot, inline "Ask the Vault"
verify/ask.html              # "Ask the Vault" — chat with the grounded reserve agent
data/*.json                  # unit metadata (photos are gitignored)
```

## Prerequisites

- **Node LTS** and the **Sui CLI**.
- A testnet address with gas (`sui client faucet`) and some testnet **WAL** for Walrus storage.
- For the agent: a local **Ollama** with a model pulled (default `qwen3:30b`); optional — the agent runs without it.
- Pinned, typechecked SDKs: `@mysten/sui` 2.17.0 (v2 line — `SuiGrpcClient` + `.core`), `@mysten/walrus` 1.1.7, `@mysten/kiosk` 1.3.0. `npx tsc --noEmit` passes clean.

## Setup

```bash
npm install --include=dev      # --include=dev matters if NODE_ENV=production is set
cp .env.example .env           # set PACKAGE_ID (and PUBLISHER_ID for the Kiosk scripts)
```

Signing uses the Sui CLI keystore directly, so `SUI_SECRET_KEY` can stay blank. If your keystore holds more than one address, set `PRIMARY_ADDRESS` (a public address, not a secret) in `.env` so minting and auditing always sign as the vault wallet regardless of keystore order. To publish your own package: `sui client publish --gas-budget 200000000` from `move/`, then put the package ID and the Publisher object ID into `.env`.

## Guardrails

- `.env` and all photos are gitignored. The repo is public during judging — keep secrets out.
- A redeemable token on mainnet raises securities / money-transmission questions that deserve real legal thought before going past testnet. This stays on testnet for now.
- Submission needs: public repo, ≤5-min demo video, a testnet deployment, and the package ID.
