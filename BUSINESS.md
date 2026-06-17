# Silver Passport — custody, authorization & business model

Silver Passport turns one physical unit of bullion into one on-chain claim: a Sui `CoinPassport` object that points at photographic evidence on Walrus and carries weight, purity, and silver content. This document explains **who is authorized to mint, sell, and redeem**, how that authorization is enforced on-chain, what it costs, and who it is for.

## The problem it solves

There is a thriving retail-bullion arbitrage culture — buy coins or bars at competitive prices (warehouse clubs, mints, peer-to-peer), then have them authenticated and resold. The friction is **trust**: every time metal changes hands, the new buyer has to re-establish that it is real, the right weight, and the right purity. Authentication (XRF, weight, dimensions, ping/ultrasound) is a repeated cost and a recurring point of doubt.

Silver Passport collapses that into a one-time event. A trusted operator verifies the metal **once**, takes custody, and mints a passport. From then on the passport — a tamper-evident, transferable claim — carries the verification and provenance. The piece can change hands many times on-chain while the metal sits in the vault, and only leaves when someone redeems it. **Liquidity without re-verifying or moving metal.**

## Actors

- **Verifier / Custodian** — the operator (ideally an existing bullion or jewelry dealer). Authenticates the physical unit, holds it in a vault, and mints the passport. Stakes its reputation on each attestation.
- **Holder / Owner** — whoever holds the passport. The passport is a bearer claim on one specific, identified unit. Can hold, sell, or redeem.
- **Buyer** — acquires a passport on the secondary market and becomes the new Holder.

## Authorization — who can do what, and how it is enforced

| Operation | Authorized party | Enforcement | Fee |
|---|---|---|---|
| **Mint / intake** | Verifier only | `AdminCap` capability gates the mint function — only the operator holding the cap can issue a passport | Verification / intake, **~2–3%** |
| **Buy / sell** | Current holder | **Sui Kiosk + TransferPolicy** — a transfer cannot settle unless the royalty rule is paid; ownership is bearer, no operator approval needed | Marketplace royalty, **~1%** (built) |
| **Redeem** | Current holder, executed by Verifier | Holder surrenders the passport; it is **burned / flagged redeemed** so the claim cannot be double-spent; Verifier ships the metal | Redemption / handling |
| **Storage** | — | Optional periodic demurrage for vault + insurance | Storage (optional) |

### Mint / intake
Minting is the trust anchor: it asserts "I verified this and I hold it." In production the `mint` entry function is gated behind an **`AdminCap`** held by the operator, so only the verifier can create passports. The 2–3% intake fee is the "is it real?" authentication value, captured once.

### Buy / sell — already built and demonstrated
Passports trade through a **Sui Kiosk** under a **`TransferPolicy`** carrying a **1% royalty rule**. A purchase cannot settle unless the royalty is paid — not a configuration claim but demonstrated on testnet: a second wallet bought a Peace dollar and the chain refused to finalize until the royalty cleared (tx `5uKFfc…`). Ownership is bearer, so the holder sells to anyone without asking the operator.

### Redeem — the one remaining contract addition
Redemption is where the on-chain claim meets the physical world. The honest, double-spend-proof design: the holder **burns** the passport to redeem, and the verifier ships the metal. Burning is essential — otherwise a holder could redeem the metal *and* still sell the passport.

**Contract gap (next build):** the current contract has no burn. The production addition is a `redeem` entry function that consumes the `CoinPassport` by value, emits a `Redeemed` event (with a claim reference), and destroys the object. Two variants:
- *Holder-initiated burn + event* — holder calls `redeem`, the passport is destroyed, the verifier watches for the event and ships. Simplest; holder trusts the operator to ship.
- *Escrowed redemption* — the passport moves to an escrow that releases only on shipment confirmation. Stronger, more moving parts.

For the hackathon this is described as the next step; the buy/sell/royalty rail is fully built.

## Trust & custody framing (read honestly)

This is **witnessed attestation, not trustless physical custody** — no chain can prove metal is still in a vault. The operator is a **trusted custodian** in a **bailment**: it holds a specific, identified unit for the holder. Each passport is **non-fractional and fully backed** — one passport, one identified physical unit, redeemable for *that* unit — which makes it resemble a **warehouse receipt** far more than a pooled fund or a fractional note.

That distinction (warehouse receipt / bailment vs. security vs. money transmission) carries real regulatory weight and depends on exact structure and jurisdiction. **It requires qualified legal review before any launch, and nothing here is legal advice.**

## Revenue

1. **Intake / verification — ~2–3%** — the core new value: authenticate once, custody, mint.
2. **Secondary royalty — ~1%** — on every on-chain resale (built; enforced by TransferPolicy).
3. **Storage / demurrage** — optional; covers vault + insurance.
4. **Redemption / handling** — when physical delivery is taken.

A single piece can throw off the royalty repeatedly as it trades, while the metal never moves until redemption.

## Who it is for — a white-label rail for existing bullion & jewelry dealers

The ideal customer already buys, sells, authenticates, and ships bullion and jewelry, and already has a vault, insurance, and a customer base. Silver Passport is a **white-label layer** that adds:

- **Independently-verifiable provenance** — buyers trust the piece without re-authenticating, lifting resale value and speeding sales.
- **Liquidity without logistics** — inventory becomes a tradable on-chain claim; pieces change hands while metal stays put.
- **A public AI reserve auditor** — a continuously-verifiable reserve report (read live from chain, evidence and memory on Walrus, cannot invent a number) for customer confidence and marketing.
- **A new royalty line** — revenue on secondary trades the dealer would not otherwise capture.

The retail arbitrage loop — buy at retail, authenticate, resell — becomes: buy → bring to a Silver Passport operator → verified + passported → resell the *passport* at a trust premium, no re-authentication required.