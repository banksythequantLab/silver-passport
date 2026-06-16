# Silver Passport — Devpost submission

*Copy/paste into the Devpost fields. Sections map to Devpost's standard prompts.*

---

## Elevator pitch (one line)

Verifiable custody passports for physical silver, on Sui + Walrus — with an AI reserve-auditor that uses Walrus as its data and memory layer and never invents a number.

---

## Inspiration

"Proof of reserve" is everywhere in crypto, and almost all of it has the same hole: a custodian *asserts* what they hold, and you trust the assertion. The honest version of the problem isn't "make trust unnecessary" — it's "make the assertion tamper-evident, timestamped, and independently checkable." That's exactly what bullion dealers, vaults, and auditors have always done with witnessed attestation.

We had actual silver on the desk — Peace dollars, rolls of Mercury dimes, rolls of war nickels — so we could build the honest version instead of simulating custody. Each physical unit becomes one on-chain object pointing at photographic evidence that's locked on Walrus, and anyone can re-check it from public infrastructure.

## What it does

- **Mints a passport per unit.** A single coin, or a sealed roll, becomes one Sui `CoinPassport` object carrying product, year, weight, purity, and an on-chain-derived silver content — plus a Walrus blob ID for its photo.
- **Verifies live.** A certificate page takes any passport ID, reads the object from a public Sui node, and pulls the photo straight from a public Walrus aggregator. Nothing is pre-loaded; it works even from `file://`.
- **Audits the whole vault with an AI agent.** A reserve-auditor enumerates every passport from on-chain mint events, computes the totals **deterministically**, asks a local LLM to write the plain-language attestation, and **stores that attestation back on Walrus as its own memory**.
- **Enforces an economic layer.** Passports trade through a Sui Kiosk under a `TransferPolicy` with a royalty rule, so a sale can't settle on-chain without paying the marketplace cut.

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

Four real passports live on testnet — 92 coins, ~7.41 troy oz — each independently verifiable; an AI agent that writes auditable, Walrus-stored reserve reports; and an on-chain royalty layer that makes the fee model real, not a slide.

## What's next

Redemption logistics, a verifier that confirms *current* custody (not just attested-at), extension to bars, collectibles, and warehouse receipts, and serious legal work (securities / money-transmission) before any mainnet, redeemable-token step. This stays on testnet until that's done.

## Built with

Sui, Move, Walrus, Sui Kiosk / TransferPolicy, `@mysten/sui`, `@mysten/walrus`, `@mysten/kiosk`, TypeScript, Node, Ollama (local LLM), HTML/JS.

## Links / on-chain proof (testnet)

- Repo: https://github.com/banksythequantLab/silver-passport
- Package: `0x8b8d40c850e716600fa9398ba01db62376cc865e5472c0f5cff975feb50ae03b`
- Royalty policy: `0x5c3ca094a5a422aa24cd90228480f749b70be4a9dddb848d8ccff34b0aa4fffc`
- A sample passport (Peace dollar): `0xb670ffca780e38f5b26de5ef30c44328c2c57c52621fcb049950fb83620ce148`
- An agent attestation on Walrus: `https://aggregator.walrus-testnet.walrus.space/v1/blobs/lXOgsS_0mh738e7k39IKtD0Eax-0IENw1TaxqPPL7BE`
