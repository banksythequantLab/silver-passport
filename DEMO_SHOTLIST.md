# Silver Passport - Demo Screen-Grab / Shot List

Pair with `DEMO_SCRIPT.md` (VO) and `vo\VO_TIMING.md`. Each beat lists the page, what to pre-stage, and the exact grabs to capture. Element names below are the real labels in the UI.

Pages (Cloudflare tunnel `bagof.fun`, or local `:8899`):
- market.html  -> beats 1, 2, 4, 5   (https://bagof.fun/market.html)
- vault.html   -> beat 3             (https://bagof.fun/vault.html)
- index.html   -> optional B-roll: single passport + Walrus photo (https://bagof.fun/)

---

## PRE-RECORD SETUP (do once)
- Browser: Chrome, 100% zoom, hide the bookmarks bar, full-screen the window. Clean desktop / no notifications.
- Slush extension: unlocked, network = **Testnet**. Have these accounts ready to switch between:
  - **Applicant** (starts UNVERIFIED) - used for the gate arc in beat 2. Give it a little testnet SUI so it can mint after approval.
  - **Buyer** `0x4fd7...6f94e` - UNVERIFIED, funded 0.3 SUI. For beat 4.
  - **Operator/Seller** `0x6e38...5bb2` - already verified, owns the kiosk + the 2 live listings. (You sign approvals as operator from the terminal, not the wallet.)
- A terminal open at `B:\silver-passport` for the approve command (beat 2):
  `npx tsx src\verify-seller.ts <APPLICANT_WALLET>`  (load .env first)
- Email: `dj@soltis.info` inbox open in a tab, ready to show the seller-application email (beat 2).
- Demo data is already clean: reserve = 6 passports; For sale = seq14 Peace$ @ 0.1 SUI + seq12 Mercury dimes @ 0.06 SUI.
- The AI Bull lives bottom-left (speech bubble); the royalty toast pops bottom-right - keep both corners in frame.

---

## BEAT 1 - HOOK   [clip: beat_1_hook.wav ~16s]
Page: real coins, then market.html
1. Physical: your real silver coins on the desk (slow push-in or slide). ~4s
2. Cut to market.html top: brand "Silver Passport / Verified custody - Sui testnet" + XAG/XAU ticker. ~2s
3. Hero: the big `$` value **counting up** (reload the page to retrigger the count-up) under the eyebrow "Live reserve - attested on-chain". ~4s
4. Slow scroll down across "The reserve - live from chain" grid (the silver-ringed coin cards, tilt/sheen as the cursor passes). ~5s

## BEAT 2 - THE GATE   [clip: beat_2_gate.wav ~22s]  <- hero beat, rehearse this
Page: market.html (+ terminal + email tab)
1. Click **Connect wallet**, pick the **Applicant** (unverified) account in Slush. ~3s
2. The **gate** snaps RED and pulses (locked state). Hold on it - that's "the chain refuses." ~2s
3. Scroll to "Add bullion - verified sellers mint here": the **Mint passport** button is **disabled/locked** for this wallet. Hover it. ~3s
4. Scroll to "Become a verified seller": fill the form - Legal business name, EIN, State, Business address; the **Wallet to approve** field auto-fills with the connected applicant wallet. Click **Submit application**. ~4s
5. Cut to the email inbox: the seller-application email has arrived (shows the business details + the approve command). ~3s
6. Cut to the terminal: run `npx tsx src\verify-seller.ts <APPLICANT_WALLET>` -> success/digest line. ~3s
7. Back to market.html: reload, reconnect the **same applicant** wallet -> the **gate flips GREEN** (unlock animation). ~2s
8. The **Mint passport** button is now enabled -> click it -> Slush sign prompt (bull: "Minting a passport - sign in Slush.") -> approve. Land on the new coin appearing / photo to Walrus. ~2s

## BEAT 3 - THE WALRUS CORE   [clip: beat_3_walrus.wav ~19s]  <- the track money shot
Page: vault.html
1. Open vault.html: "The vault, audited on-chain" - numbers shown are read live from chain. ~3s
2. Scroll to "**Audit history - agent memory on Walrus**" with the green **matches-chain badge** next to it. ~3s
3. Click "**Re-audit now**" -> status line: "Running a fresh audit - enumerating chain, writing attestation to Walrus..." ~4s
4. New attestation row drops into the **audit-history timeline**; each row is a Walrus blob (the agent's memory). Slow-scroll the timeline. ~5s
5. (Optional B-roll for the line "evidence on Walrus"): cut to index.html, look up one coin, show its photo with the caption "Photo fetched live from Walrus." ~4s

## BEAT 4 - BUY, ROYALTY ENFORCED   [clip: beat_4_royalty.wav ~13s]
Page: market.html
1. Switch Slush to the **Buyer** account; reconnect. Note the gate is RED for the buyer - that's fine ("buyers don't need verification"). ~2s
2. Scroll to "For sale - buy with your wallet"; on a listing (e.g. seq12 Mercury dimes @ 0.06) click **Buy**. ~2s
3. Bull: "Purchase built. Sign in Slush - price plus 1%." -> Slush sign prompt -> approve. ~3s
4. The **royalty-split toast** pops bottom-right: seller amount (green) + royalty cut (gold). Bull: "X SUI to the seller, Y to the vault. Clean." Hold on the toast. ~5s

## BEAT 5 - HONEST FRAMING + CLOSE   [clip: beat_5_close.wav ~20s]
Page: market.html (+ index.html optional)
1. Frame the heroline / the "what this proves" framing text (the witnessed-attestation language). ~5s
2. Optional: index.html passport card - photo + Attestor + Attested time + weight/purity, as the "specific unit, recorded moment" visual. ~5s
3. End card: settle back on the market.html hero (brand + count-up value) for the "That's Silver Passport" line. ~5s

---

## QUICK CAPTURE ORDER (most efficient)
Record market.html beats in wallet-state order to minimize switching:
1) Beat 1 (fresh reload).  2) Beat 2 with the Applicant wallet (the full red->approve->green->mint arc).  3) Beat 4 with the Buyer wallet.  4) Beat 5 framing.  Then 5) Beat 3 entirely on vault.html.
Capture each beat a little LONGER than its clip - easier to trim to the VO than to stretch.
