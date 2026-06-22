/// Silver Passport (Sui Bullion) — v4: verified-seller marketplace.
/// Only wallets approved by the operator (off-chain: legal name, EIN, W-9) and
/// recorded in the shared VerifierRegistry may mint — an unverified scammer
/// simply cannot create a passport. Buy/sell runs through Kiosk under the
/// royalty policy; redeem burns the passport when the bullion is claimed.
module silver_passport::passport {
    use std::string::String;
    use sui::clock::{Self, Clock};
    use sui::event;
    use sui::package;
    use sui::table::{Self, Table};

    const ENotVerified: u64 = 1;

    public struct PASSPORT has drop {}
    public struct AdminCap has key, store { id: UID }
    public struct VerifierRegistry has key { id: UID, verifiers: Table<address, bool> }

    public struct CoinPassport has key, store {
        id: UID, sequence: u64, product: String, year: u16, mint_mark: String,
        unit: String, quantity: u64, weight_mg: u64, purity: u16,
        silver_content_mg: u64, photo_blob_id: String, evidence_blob_id: String,
        attested_at_ms: u64, attestor: address,
    }
    public struct PassportMinted has copy, drop {
        passport_id: ID, sequence: u64, quantity: u64,
        silver_content_mg: u64, attestor: address, attested_at_ms: u64,
    }
    public struct VerifierAdded has copy, drop { who: address }
    public struct VerifierRemoved has copy, drop { who: address }
    public struct Redeemed has copy, drop {
        passport_id: ID, sequence: u64, silver_content_mg: u64, by: address,
    }

    fun init(otw: PASSPORT, ctx: &mut TxContext) {
        transfer::public_transfer(package::claim(otw, ctx), ctx.sender());
        let mut verifiers = table::new<address, bool>(ctx);
        table::add(&mut verifiers, ctx.sender(), true);
        transfer::share_object(VerifierRegistry { id: object::new(ctx), verifiers });
        transfer::public_transfer(AdminCap { id: object::new(ctx) }, ctx.sender());
    }

    public fun is_verified(reg: &VerifierRegistry, who: address): bool {
        table::contains(&reg.verifiers, who)
    }
    public fun add_verifier(_: &AdminCap, reg: &mut VerifierRegistry, who: address) {
        if (!table::contains(&reg.verifiers, who)) { table::add(&mut reg.verifiers, who, true); };
        event::emit(VerifierAdded { who });
    }
    public fun remove_verifier(_: &AdminCap, reg: &mut VerifierRegistry, who: address) {
        if (table::contains(&reg.verifiers, who)) { table::remove(&mut reg.verifiers, who); };
        event::emit(VerifierRemoved { who });
    }
    public fun mint(
        reg: &VerifierRegistry, sequence: u64, product: String, year: u16,
        mint_mark: String, unit: String, quantity: u64, weight_mg: u64, purity: u16,
        photo_blob_id: String, evidence_blob_id: String, clock: &Clock, ctx: &mut TxContext,
    ) {
        let attestor = ctx.sender();
        assert!(table::contains(&reg.verifiers, attestor), ENotVerified);
        let now = clock::timestamp_ms(clock);
        let silver_content_mg = weight_mg * (purity as u64) / 1000;
        let passport = CoinPassport {
            id: object::new(ctx), sequence, product, year, mint_mark, unit, quantity,
            weight_mg, purity, silver_content_mg, photo_blob_id, evidence_blob_id,
            attested_at_ms: now, attestor,
        };
        event::emit(PassportMinted {
            passport_id: object::id(&passport), sequence, quantity,
            silver_content_mg, attestor, attested_at_ms: now,
        });
        transfer::public_transfer(passport, attestor);
    }

    public fun redeem(passport: CoinPassport, ctx: &TxContext) {
        let CoinPassport {
            id, sequence, silver_content_mg, product: _, year: _, mint_mark: _,
            unit: _, quantity: _, weight_mg: _, purity: _, photo_blob_id: _,
            evidence_blob_id: _, attested_at_ms: _, attestor: _,
        } = passport;
        event::emit(Redeemed { passport_id: object::uid_to_inner(&id), sequence, silver_content_mg, by: ctx.sender() });
        object::delete(id);
    }
}