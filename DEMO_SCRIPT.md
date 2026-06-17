# Silver Passport — demo video script (≤5:00, Walrus track)

Spine: **Walrus is the data layer *and* the agent's memory layer, and the AI can't invent a number.** Every beat reinforces one of those.

---

**0:00–0:20 — Cold open / hook**
*On screen:* the real coins on the desk — Peace dollars, a roll of Mercury dimes, the nickel batches. Cut to bagof.fun.
> "Proof of reserve is everywhere in crypto, and almost all of it has the same hole: a custodian *asserts* what they hold, and you trust them. I had actual silver on my desk — so I built the honest version. Every coin gets a passport on Sui, evidence locked on Walrus, and an AI auditor that can't lie about the numbers."

**0:20–0:50 — Mint a passport**
*On screen:* terminal — `npm run upload`, then `npm run mint`. Show photo → Walrus blob ID → Sui object.
> "One physical unit becomes one Sui object. The photo goes to Walrus — permanent, content-addressed. The object just points at the blob and carries weight, purity, silver content."

**0:50–1:25 — Verify it's real**
*On screen:* certificate page; paste a passport ID. Photo resolves from the public Walrus aggregator; show the QR and the provenance strip.
> "Anyone can verify. This page reads the object from a public Sui node and pulls the photo straight from a public Walrus aggregator — nothing pre-loaded, no backend trusted. It even works from a local file."

**1:25–2:05 — The live vault**
*On screen:* bagof.fun vault — counter animates to 27.2679 oz, the photo gallery of all six pieces, USD-at-spot line.
> "The vault enumerates every passport live from chain, in your browser — six passports, 402 coins, about 27 and a quarter troy ounces, marked to a live silver spot price. These photos are loading from Walrus right now."

**2:05–3:05 — THE WALRUS CORE (linger here — the money shot)**
*On screen:* click **Re-audit now**. Then scroll to the agent block + audit-history timeline + the green badge.
> "Here's the heart of it. The auditor enumerates every passport, computes the totals *deterministically from chain* — then a local LLM writes the attestation. The numbers come from the chain; the model only narrates. It cannot quote a figure that isn't real."
> "Then it writes that attestation back to Walrus — and that becomes its memory. This timeline is the agent recalling its own past audits, each one a Walrus blob. Walrus is its data layer *and* its memory."
*Point to the badge:*
> "And this badge re-checks the stored attestation against what we just read from chain — green means the agent's memory still matches reality."

**3:05–3:45 — Ask the vault**
*On screen:* type "How much silver, and what's it worth?" then "Is this real proof of reserve?" Show grounded answers + the "grounded in 6 passports / 27.27 oz" citation.
> "You can just ask it. Every answer is grounded only in the live on-chain figures — and when it's honest about limits, that's by design, not luck."

**3:45–4:20 — The economic layer, demonstrated**
*On screen:* suiscan tx `5uKFfc…`; the royalty in the policy.
> "Passports trade through a Sui Kiosk under a royalty policy. I didn't just configure it — a second wallet bought a Peace dollar and the chain refused to settle until the 1% royalty was paid. Here's that transaction on-chain."

**4:20–4:50 — Honest framing (wins trust with judges)**
*On screen:* the "what this proves" note.
> "And I'm precise about what this proves: that I attested custody of a specific unit and locked the evidence at a recorded moment, tamper-evidently. It's witnessed attestation — the same model real proof-of-reserve uses. It doesn't claim trustless physical custody, because that would be false."

**4:50–5:00 — Close**
> "Real silver, real photos on Walrus, an AI auditor with a Walrus memory that can't lie about the numbers — all live at bagof.fun. That's Silver Passport."

---

*Production notes:* record at 1080p+; large terminal font; the single most important minute is **2:05–3:05** (re-audit → Walrus write → memory timeline → badge). Rehearse so the "data layer *and* memory layer" line lands clean. Run `npm run check` on camera somewhere — five green checks is a clean proof beat.