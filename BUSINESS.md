# Silver Passport — custody, authorization & business model

Silver Passport turns one physical unit of bullion into one on-chain claim: a Sui `CoinPassport` object that points at photographic evidence on Walrus and carries weight, purity, and silver content. This document explains **who is authorized to mint, sell, and redeem**, how that authorization is enforced on-chain, what it costs, and who it is for.

## The problem it solves

There is a thriving retail-bullion arbitrage culture — buy coins or bars at competitive prices, then have them authenticated and resold. The friction is **trust**: every time metal changes hands, the new buyer must re-establish that it is real, the right weight, the right purity. Authentication (XRF, weight, dimensions, ping/ultrasound) is a repeated cost and a recurring point of doubt.

Silver Passport collapses that into a one-time event. A trusted operator verifies the metal **once**, takes custody, and mints a passport. From then on the passport — a tamper-evident, transferable claim — carries the verification and provenance. The piece can change hands many times on-chain while the metal sits in the vault, and only leaves when someone redeems it. **Liquidity without re-verifying or moving metal.**

## Authorization — who can do what, and how it is enforced

| Operation | Authorized party | Enforcement | Fee |
|---|---|---|---|
| **Mint / intake** | Verifier only | `AdminCap` gates the mint function — only the operator holding the cap can issue a passport | Verification / intake, **~2–3%** |
| **Buy / sell** | Current holder | **Sui Kiosk + TransferPolicy** — a transfer cannot settle unless the royalty rule is paid; ownership is bearer | Royalty, **~1%** (built) |
| **Redeem** | Current holder, executed by Verifier | Holder surrenders the passport; it is **burned / flagged redeemed**; Verifier ships the metal | Redemption / handling |
| **Storage** | — | Optional periodic demurrage for vault + insurance | Storage (optional) |

### Mint / intake
Minting is the trust anchor: it asserts "I verified this and I hold it." In production the `mint` entry function is gated behind an **`AdminCap`** held by the operator. The 2–3% intake fee is the "is it real?" authentication value, captured once.

### Buy / sell — already built and demonstrated
Passports trade through a **Sui Kiosk** under a **`TransferPolicy`** carrying a **1% royalty rule**. A purchase cannot settle unless the royalty is paid — demonstrated on testnet: a second wallet bought a Peace dollar and the chain refused to finalize until the royalty cleared (tx `5uKFfc…`). Ownership is bearer, so the holder sells to anyone without operator approval.

### Redeem — the one remaining contract addition
The holder **burns** the passport to redeem; the verifier ships the metal. Burning is essential — otherwise a holder could redeem the metal *and* still sell the passport. **Contract gap (next build):** the current contract has no burn. The addition is a `redeem` entry function that consumes the `CoinPassport` by value, emits a `Redeemed` event, and destroys the object. For the hackathon this is the documented next step; the buy/sell/royalty rail is fully built.

## Trust & custody framing (read honestly)

This is **witnessed attestation, not trustless physical custody** — no chain can prove metal is still in a vault. The operator is a **trusted custodian** holding the metal in a **bailment** for the holder. The baseline is specific: once a unit is verified, the passport is a claim on **that identified lot**, non-fractional and fully backed — closer to a **warehouse receipt** than a pooled fund or fractional note.

**Two tiers, because not all silver is the same kind of thing:**

- **Distinct / numismatic pieces** (a specific dated Peace dollar, a key-date coin) are unique. The passport is a **specific bailment** — custody of *that* identified chattel, valued on its own merits. Redemption returns the exact piece.
- **Common bullion coins** (90% "junk silver" — circulated Mercury dimes, war nickels) are valued and traded by **silver weight**, not identity. One circulated roll of dimes is interchangeable with the next at an approximate roll weight, so these are effectively **fungible**. They can be **aggregated** — multiple rolls combined into a batch, or stated as bullion weight for a stack — which is exactly what the `roll` and `batch` unit types and the batch passports (the 4-roll war-nickel and 3-roll dime batches) already do.

For the fungible tier the closer legal analogue is a **commodity / fungible-goods warehouse** (think grain elevator), not a safe-deposit box: under the warehouse-receipt regime for fungible goods, like-kind units may be commingled and a holder is entitled to an **equivalent quantity and quality by weight**, not the exact coins deposited. A deliberate design fork worth deciding explicitly:

- *Specific redemption* — return the exact lot. Simplest bailment, no commingling.
- *Like-kind redemption* — return any equivalent rolls / weight. Enables pooling, aggregation, and deeper liquidity, but moves the structure toward a commodity-warehouse / fungible-bailment model.

Each tier (specific bailment vs. fungible-goods warehouse vs. anything resembling a security or money transmission) carries different regulatory weight and depends on exact structure and jurisdiction. **This needs qualified commodities/UCC counsel before any launch, and nothing here is legal advice — that call is yours.**

## Revenue

1. **Intake / verification — ~2–3%** — authenticate once, custody, mint.
2. **Secondary royalty — ~1%** — every on-chain resale (built; enforced by TransferPolicy).
3. **Storage / demurrage** — optional; covers vault + insurance.
4. **Redemption / handling** — when physical delivery is taken.

A single piece can throw off the royalty repeatedly as it trades, while the metal never moves until redemption.

## Who it is for — a white-label rail for existing bullion & jewelry dealers

The ideal customer already buys, sells, authenticates, and ships bullion and jewelry, with a vault, insurance, and a customer base. Silver Passport is a **white-label layer** that adds:

- **Independently-verifiable provenance** — buyers trust the piece without re-authenticating, lifting resale value and speeding sales.
- **Liquidity without logistics** — inventory becomes a tradable on-chain claim; pieces change hands while metal stays put.
- **A public AI reserve auditor** — a continuously-verifiable reserve report (read live from chain, evidence and memory on Walrus, cannot invent a number).
- **A new royalty line** — revenue on secondary trades the dealer would not otherwise capture.

The retail arbitrage loop — buy at retail, authenticate, resell — becomes: buy → bring to a Silver Passport operator → verified + passported → resell the *passport* at a trust premium, no re-authentication required.