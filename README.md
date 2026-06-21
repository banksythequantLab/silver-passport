# Silver Passport

A custodial bullion-and-crypto exchange on **Sui** + **Walrus**. Built for Sui Overflow 2026 (Walrus track).

**Live demo: [bagof.fun](https://bagof.fun)** — the reserve vault dashboard, a per-coin certificate page, and "Ask the Vault" (a live AI agent), all reading straight from Sui + Walrus.

Each physical unit — a single coin, or a sealed roll — gets one Sui object that references photographic evidence stored permanently on Walrus. Anyone can read the object from a public node, pull the evidence back from Walrus, and confirm the attestation. No trust in us required.

On top of that sits an **AI reserve-auditor agent** that uses Walrus as its verifiable data and memory layer: it reads every passport on-chain, computes the reserve, and writes an attestation back to Walrus that it can recall later.

## What it honestly proves

A passport proves the attestor asserted custody of a specific unit and **locked the evidence at a recorded moment**, tamper-evidently. It does **not** prove the unit is still held today, or that one coin wasn't photographed twice. That is witnessed attestation — the same trust model real proof-of-reserve uses. The agent's report says exactly this; the pitch does not overclaim into "trustless physical custody."

## The verified-seller gate (anti-scam)

Minting is gated on-chain. Only an approved custodian can take metal into the system - an unverified wallet cannot mint, because the Move contract aborts with `ENotVerified`. A shared `VerifierRegistry` holds the approved seller addresses; the operator (holding the `AdminCap`) approves a wallet after an off-chain application (business name, EIN / W-9). The gate is enforced by the chain, not a bypassable server.

```bash
npm run verify-seller <address>   # operator adds a seller to the VerifierRegistry
```

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
| Package (v4) | `0xdfca679175d9aed3ad6366e3e6d33642605f1d0e9c8e218388087fccbe625187` |
| VerifierRegistry (shared) | `0xfba009dad9210e09da608be0fc4c8669fba01b17d3f439a5a842291e1e5c9978` |
| AdminCap | `0x86c2e786d19544b1a01e30c578b0958a9e41557dee0ef74d68dc0d9f3fc30d39` |
| Operator / verified seller | `0x6e38f5b2b3957a54c74aaec24594d3ef68b27fede24d0b9a99d562a6c58e5bb2` |
| Operator Kiosk | `0x84159ffa48fce1c9006c9eb403d1c6948d65331fc8a248ad756578609837dfd2` |
| TransferPolicy\<CoinPassport\> (1% royalty) | `0xdd6500bfac8be909894665dd40ba9d4fbffad994d4e21b7a30bee22827448248` |

Eight real passports from actual inventory — 492 coins, ~38.12 troy oz silver:

| # | Unit | Silver | Object |
| --- | --- | --- | --- |
| 011 | Peace dollar (1926) | 0.773 oz | `0x88c19f67e5a73ad777e6f876042a6d2f5e4ca028c13002e03460ac422bd7102f` |
| 012 | Mercury dime roll (×50) | 3.617 oz | `0xde775e53882a30a842c5f91d1c8a721b88002d38d674a3de3c4878472fb781a2` |
| 013 | War nickel roll (×40) | 2.251 oz | `0x61726aedf5253a945c30f3e1566194e3b26cdb669e1afb727e3ac31fdcfab393` |
| 014 | Peace dollar (1922) | 0.773 oz | `0x878b118adf59f0b9032ea0b332c1554f7dce18d005a97d27ec37ed77b1441564` |
| 015 | War nickel **4-roll batch** (×160) | 9.002 oz | `0xca83697286eaeecb2655d1fec248401aeb113d7b03f60c55de2bd400e605ddc1` |
| 016 | Mercury dime **3-roll batch** (×150) | 10.851 oz | `0x0c859355e2d3182895075eea4e9b970e31d56fe8de065eeca752c9a7360aea86` |
| 017 | Silver dime roll, 1964 and prior (x50) | 3.617 oz | `0x21e53b266e83c6182829b23f9e393931cd6c34b4235e8d6918aac412ad049e42` |
| 018 | Silver quarter roll, 1964 and prior (x40) | 7.234 oz | `0xbf53268a17af67827530e4e38c43192cb282e7a67e6226f3fcfd77e695132504` |

Each batch passport carries its own real photo on Walrus. Superseded passports (re-minted with corrected evidence) are **retired** — listed in `RETIRED_PASSPORTS` and excluded from the reserve tally and dashboard so their silver isn't double-counted.

An example reserve attestation the agent stored on Walrus (the live history is in the vault):
`https://aggregator.walrus-testnet.walrus.space/v1/blobs/QyQMX4vtqkIFPNQvUDYkR8Hje-dpsg5MU51eH4ccIHU`

## The economic layer

Passports trade through a Sui **Kiosk** under a `TransferPolicy` with a royalty rule, so a sale cannot settle on-chain without paying the marketplace cut to the storage fund. That royalty is one of three intended fee sinks — marketplace cut, annual storage (demurrage), and a redemption fee — each separate by design.

```bash
npm run policy                 # one-time: create the TransferPolicy + royalty rule
npm run list <passportId> [priceMist]   # place a passport in a Kiosk and list it
npm run buy <buyerAddr> <passportId> <sellerKioskId> [priceMist]   # buy as another wallet
```

**We demonstrated it.** A second wallet bought a listed Peace dollar; the Kiosk refused to settle until the 1% royalty was paid into the policy, which now holds the collected cut. Sale tx: [`5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD`](https://suiscan.xyz/testnet/tx/5uKFfcEWA5fvKLY7JpCbUCs28PnT12M2WdKnTBNQGGLD).

**Pricing against spot.** Bullion trades at a premium or discount to melt, so the marketplace makes that explicit. When a verified holder lists a coin, the panel shows its live spot value (silver content × spot) and lets them set either an exact SUI price or a premium/discount percentage over spot — the two inputs stay linked, with one-tap *set to spot / +5% / +10%* controls. Every buyer-facing card then shows the listing's live premium or discount versus spot, so an ask is legible against metal value instead of a bare SUI number. The on-chain Kiosk price stays a fixed SUI amount; the premium is computed live against the silver spot and the SUI/USD rate, so the badge stays honest as markets move.

## Redemption (closing the bailment)

`redeem()` is implemented on-chain: the holder passes the `CoinPassport` to `redeem` by value; the contract emits a `Redeemed` event (sequence, silver content, redeemer) and deletes the object. Burning is the point - once the metal leaves custody the claim must not keep trading. In bailment terms this is redelivery: the verified seller (bailee) hands back the physical metal and the on-chain claim is extinguished in the same motion. The off-chain shipping/handoff and the redemption-fee rail sit on top of this primitive and are the next build.

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
move/sources/passport.move   # CoinPassport, gated mint() (ENotVerified), redeem() burns, VerifierRegistry, AdminCap
src/client.ts                # Sui (gRPC) + Walrus clients; keystore signing (honors PRIMARY_ADDRESS)
src/verify-seller.ts         # operator adds a seller to the VerifierRegistry
src/upload.ts                # photo -> Walrus blob
src/mint.ts                  # mint the on-chain passport
src/verify.ts                # re-fetch object + blob, write the verify bundle
src/audit.ts                 # the reserve-auditor agent (Walrus memory)
src/policy.ts                # create the Kiosk TransferPolicy + royalty rule
src/list.ts                  # list a passport for sale under the policy
src/buy.ts                   # buy a listed passport as another wallet (royalty auto-resolved)
src/server.ts                # serves the vault + certificate + "Ask the Vault" agent (port 8899)
verify/market.html           # marketplace dApp (Slush connect, gated mint, royalty buy)
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
cp .env.example .env           # set PACKAGE_ID and REGISTRY_ID (plus the Kiosk IDs for trading)
```

Signing uses the Sui CLI keystore directly, so `SUI_SECRET_KEY` can stay blank. If your keystore holds more than one address, set `PRIMARY_ADDRESS` (a public address, not a secret) in `.env` so minting and auditing always sign as the vault wallet regardless of keystore order. To publish your own package: `sui client publish --gas-budget 200000000` from `move/`, then put the package ID and the shared object IDs (REGISTRY_ID and the policy) into `.env`.

## Guardrails

- `.env` and all photos are gitignored. The repo is public during judging — keep secrets out.
- A redeemable token on mainnet raises securities / money-transmission questions that deserve real legal thought before going past testnet. This stays on testnet for now.
- Submission needs: public repo, ≤5-min demo video, a testnet deployment, and the package ID.
