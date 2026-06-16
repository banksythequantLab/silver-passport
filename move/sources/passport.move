/// Silver Passport (Sui Bullion) — one Sui object per physical custody unit.
///
/// A unit is either a SINGLE coin (halves, dollars, key dates) or a sealed
/// ROLL of common-date coins (dimes, nickels). Each passport is a verifiable
/// attestation that, at a recorded moment, the minter (attestor) held that
/// specific unit and locked its evidence (a photo, and optional documents) on
/// Walrus. Anyone can read the object on Sui, fetch the blobs from Walrus, and
/// confirm the attestation independently.
///
/// What this PROVES: the attestor asserted custody of this unit and locked
/// this evidence at attested_at_ms. What it does NOT prove: that the unit is
/// still held today, or that it was not photographed twice. This is witnessed
/// attestation, the same trust model real proof-of-reserve uses.
module silver_passport::passport {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::package;

    /// One-time witness for claiming the package Publisher. The Publisher is
    /// required to create a Kiosk TransferPolicy and attach a royalty rule, so
    /// the marketplace cut is enforced on every on-chain sale. An OTW can only
    /// be claimed in init at first publish — which is why this lives in v3.
    public struct PASSPORT has drop {}

    fun init(otw: PASSPORT, ctx: &mut TxContext) {
        let publisher = package::claim(otw, ctx);
        transfer::public_transfer(publisher, ctx.sender());
    }

    /// A passport for a single custody unit (one coin, or one roll).
    public struct CoinPassport has key, store {
        id: UID,
        /// Sequence number assigned by the attestor (e.g. 1 for "Unit #001").
        sequence: u64,
        /// Product description, e.g. "1921 Morgan Dollar" or
        /// "Mercury Dimes — common-date roll".
        product: String,
        /// Representative mint year; 0 for mixed-date rolls.
        year: u16,
        /// Mint mark, or "" if none / mixed.
        mint_mark: String,
        /// Custody unit: "coin" or "roll".
        unit: String,
        /// Number of coins in this unit (1 for a single coin, e.g. 50 for a
        /// roll of dimes, 40 for a roll of nickels).
        quantity: u64,
        /// Total GROSS weight of the unit in milligrams (1 troy oz = 31103 mg).
        weight_mg: u64,
        /// Fineness in thousandths (900 = 90% silver, 350 = war nickel).
        purity: u16,
        /// Fine silver content in milligrams, derived on-chain as
        /// weight_mg * purity / 1000. Sum these across passports for reserves.
        silver_content_mg: u64,
        /// Walrus blob ID for the photo (required evidence).
        photo_blob_id: String,
        /// Walrus blob ID for supporting docs/COA, or "" if none.
        evidence_blob_id: String,
        /// On-chain timestamp (ms) when the attestation was recorded.
        attested_at_ms: u64,
        /// Address that made the attestation.
        attestor: address,
    }

    /// Emitted on mint so indexers / the auditor agent can discover passports.
    /// Copyable fields only — full detail lives on the object (see passport_id).
    public struct PassportMinted has copy, drop {
        passport_id: ID,
        sequence: u64,
        quantity: u64,
        silver_content_mg: u64,
        attestor: address,
        attested_at_ms: u64,
    }

    /// Mint a passport for one custody unit and transfer it to the caller.
    public fun mint(
        sequence: u64,
        product: String,
        year: u16,
        mint_mark: String,
        unit: String,
        quantity: u64,
        weight_mg: u64,
        purity: u16,
        photo_blob_id: String,
        evidence_blob_id: String,
        clock: &Clock,
        ctx: &mut TxContext,
    ) {
        let now = clock::timestamp_ms(clock);
        let attestor = ctx.sender();
        let silver_content_mg = weight_mg * (purity as u64) / 1000;

        let passport = CoinPassport {
            id: object::new(ctx),
            sequence,
            product,
            year,
            mint_mark,
            unit,
            quantity,
            weight_mg,
            purity,
            silver_content_mg,
            photo_blob_id,
            evidence_blob_id,
            attested_at_ms: now,
            attestor,
        };

        event::emit(PassportMinted {
            passport_id: object::id(&passport),
            sequence,
            quantity,
            silver_content_mg,
            attestor,
            attested_at_ms: now,
        });

        transfer::public_transfer(passport, attestor);
    }
}
