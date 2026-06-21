# Silver Passport

A custodial bullion-and-crypto exchange on Sui - verified sellers hold, insure, and ship real metal; your on-chain passport is the redeemable claim; the evidence and audit memory live on Walrus.

Sui Overflow 2026 - Walrus track - Sui testnet
Live: https://bagof.fun/market.html
Repo: https://github.com/banksythequantLab/silver-passport

## Built With
Sui, Move, Walrus, Sui Kiosk, TransferPolicy, TypeScript, tsx, Node.js, Slush, wallet-standard, Ollama (local LLM), Cloudflare Tunnel, Nodemailer / Gmail SMTP, JavaScript, HTML, CSS

## Inspiration
Proof of reserve in crypto usually means the custodian asserts what they hold and you trust the assertion. Silver Passport introduces a bullion and crypto exchange where known, verified sellers meet buyers who want to move easily between crypto and precious metals. The market is booming - even Walmart now sells gold bullion - but the real friction is storage: most people do not want several thousand dollars of metal sitting in their home. This is a bailment system: a buyer can own physical precious metals without holding them on site, while the verified seller custodies, insures, and secures the metal until redemption - earning fees for validating and appraising each piece on intake and for shipping it on redemption. The passport is the on-chain claim on that custody. Bullion marketplaces are full of fake listings, so the first question should be: is the seller real, and can I inspect the evidence myself before I buy?

## What it does
Silver Passport is a bullion-and-crypto exchange that solves the real adoption blocker for precious metals: storage. Instead of keeping thousands of dollars of metal at home, a buyer holds an on-chain CoinPassport - a redeemable claim on a specific unit that a verified seller custodies, insures, and secures until redemption. It runs on three on-chain guarantees:
- Verified-seller (bailee) gate: only vetted custodians can take metal into the system. An unverified wallet cannot mint - the Move contract aborts with ENotVerified. A business applies with EIN / W-9, the operator approves the wallet on-chain, and only then can it mint.
- Deterministic AI reserve auditor: every figure is computed straight from chain state. The model only narrates and cannot invent a number. Each attestation is written back to Walrus and becomes the agent memory.
- Enforced economics: trades clear through a Sui Kiosk whose TransferPolicy will not settle a sale until the custodian fee is paid on-chain. Sellers earn for intake appraisal and validation and for shipping on redemption; buyers move between crypto and metal in a click and sign with Slush. Holders price each listing against live spot - an exact SUI amount or a premium or discount over melt - and every buyer-facing card shows that premium or discount live, so an ask reads against metal value, not a bare SUI number. Redeem burns the passport and the custodian ships the physical metal.

## How Walrus is used
Walrus is both the data layer and the memory layer. Each coin photo is a Walrus blob referenced by blob id inside the CoinPassport. Every reserve attestation the AI produces is also a Walrus blob, forming a history the agent reads back on each audit.

## How I built it
- Move (Sui): silver_passport::passport - AdminCap, a shared VerifierRegistry, gated mint, redeem, and a Kiosk TransferPolicy with a 1 percent royalty rule.
- Backend: TypeScript (tsx) - reserve math read from chain, live spot pricing, Walrus reads, server-built Kiosk purchase transactions that the browser signs, and Gmail SMTP seller onboarding. A local LLM (Ollama) powers the auditor and the Ask the Bull agent, grounded only in chain reads.
- Frontend: a no-build vanilla dApp (market.html) - Slush connect, on-chain verification gate, gated gold and silver mint, Walrus photos, and a royalty-enforced in-browser buy.
- Served live through a Cloudflare tunnel at bagof.fun. Demo narration was produced with my own voice-cloning stack.

## Challenges I ran into
- Nightly SDK drift: the Mysten Sui JSON-RPC client moved to SuiJsonRpcClient, and the Kiosk SDK would not load in-browser. I solved it by building purchase transactions server-side and signing them in the wallet.
- Keeping the auditor honest: numbers come only from chain reads, so the language model narrates but cannot fabricate a figure.
- Enforcing trust in the contract, not the UI: the gate (ENotVerified) and the royalty (TransferPolicy) are enforced on-chain so neither can be bypassed by hitting the API directly.

## Accomplishments that I am proud of
- The verified-seller gate is real on-chain enforcement, not a UI check - an unverified wallet genuinely cannot mint.
- The auditor is deterministic and self-auditing: it writes its own attestations back to Walrus as memory and recalls them.
- The 1 percent royalty cannot be skipped - the chain refuses to settle the sale otherwise.
- Honest framing throughout: I am precise that this is witnessed attestation, not trustless proof of current possession.

## What I learned
- Walrus works well as both an evidence store and an agent-memory layer in the same app.
- Pushing trust into Move assertions (the gate, the royalty) is stronger and simpler than app-layer checks.
- Grounding an LLM strictly in chain reads keeps it honest and safe to demo live.

## On-chain (testnet)
- Package: 0xdfca679175d9aed3ad6366e3e6d33642605f1d0e9c8e218388087fccbe625187
- VerifierRegistry (shared): 0xfba009dad9210e09da608be0fc4c8669fba01b17d3f439a5a842291e1e5c9978
- TransferPolicy CoinPassport: 0xdd6500bfac8be909894665dd40ba9d4fbffad994d4e21b7a30bee22827448248
- Operator / verified seller: 0x6e38f5b2b3957a54c74aaec24594d3ef68b27fede24d0b9a99d562a6c58e5bb2
- Operator Kiosk: 0x84159ffa48fce1c9006c9eb403d1c6948d65331fc8a248ad756578609837dfd2
- Walrus aggregator: https://aggregator.walrus-testnet.walrus.space/v1/blobs/

## Honest framing
This proves a verified party attested custody of a specific unit and locked the evidence at a recorded moment, tamper-evidently. It is witnessed attestation - not trustless proof of current physical possession, and I do not claim otherwise.

## What is next
- A full redemption-and-shipping flow: burn-on-handoff, insured label, delivery confirmation.
- An intake appraisal and validation step, with explicit custody and insurance terms bound to each passport.
- Mainnet with real KYB review of custodians; a crypto-to-metal on-ramp (pay in SUI or stablecoin); and third-party auditor signatures over operator attestations.
