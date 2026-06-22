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

    // ===== unit tests (test_only; excluded from published bytecode) =====
    #[test_only] use sui::test_scenario as ts;
    #[test_only] const SELLER: address = @0xA11CE;

    #[test_only]
    fun share_registry(scenario: &mut ts::Scenario, verified: bool) {
        let ctx = ts::ctx(scenario);
        let mut verifiers = table::new<address, bool>(ctx);
        if (verified) { table::add(&mut verifiers, SELLER, true); };
        transfer::share_object(VerifierRegistry { id: object::new(ctx), verifiers });
    }

    #[test]
    fun mint_computes_silver_content() {
        let mut sc = ts::begin(SELLER);
        share_registry(&mut sc, true);
        ts::next_tx(&mut sc, SELLER);
        {
            let reg = ts::take_shared<VerifierRegistry>(&sc);
            let c = clock::create_for_testing(ts::ctx(&mut sc));
            mint(&reg, 7, std::string::utf8(b"Test Round"), 2026, std::string::utf8(b""), std::string::utf8(b"coin"), 1, 31103, 999, std::string::utf8(b"photo"), std::string::utf8(b""), &c, ts::ctx(&mut sc));
            clock::destroy_for_testing(c);
            ts::return_shared(reg);
        };
        ts::next_tx(&mut sc, SELLER);
        {
            let p = ts::take_from_sender<CoinPassport>(&sc);
            assert!(p.silver_content_mg == 31103 * 999 / 1000, 100);
            assert!(p.sequence == 7, 101);
            assert!(p.quantity == 1, 102);
            ts::return_to_sender(&sc, p);
        };
        ts::end(sc);
    }

    #[test]
    fun redeem_consumes_passport() {
        let mut sc = ts::begin(SELLER);
        share_registry(&mut sc, true);
        ts::next_tx(&mut sc, SELLER);
        {
            let reg = ts::take_shared<VerifierRegistry>(&sc);
            let c = clock::create_for_testing(ts::ctx(&mut sc));
            mint(&reg, 1, std::string::utf8(b"X"), 2026, std::string::utf8(b""), std::string::utf8(b"coin"), 1, 1000, 999, std::string::utf8(b"p"), std::string::utf8(b""), &c, ts::ctx(&mut sc));
            clock::destroy_for_testing(c);
            ts::return_shared(reg);
        };
        ts::next_tx(&mut sc, SELLER);
        {
            let p = ts::take_from_sender<CoinPassport>(&sc);
            redeem(p, ts::ctx(&mut sc));
        };
        ts::end(sc);
    }

    #[test]
    #[expected_failure(abort_code = ENotVerified)]
    fun unverified_cannot_mint() {
        let mut sc = ts::begin(SELLER);
        share_registry(&mut sc, false);
        ts::next_tx(&mut sc, SELLER);
        {
            let reg = ts::take_shared<VerifierRegistry>(&sc);
            let c = clock::create_for_testing(ts::ctx(&mut sc));
            mint(&reg, 1, std::string::utf8(b"X"), 2026, std::string::utf8(b""), std::string::utf8(b"coin"), 1, 1000, 999, std::string::utf8(b"p"), std::string::utf8(b""), &c, ts::ctx(&mut sc));
            clock::destroy_for_testing(c);
            ts::return_shared(reg);
        };
        ts::end(sc);
    }
}