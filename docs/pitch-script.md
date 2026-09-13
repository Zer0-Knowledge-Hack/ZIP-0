# Pitch Script — 3 minutes

Spoken script for the ZIP·0 pitch. English, international audience.

Positioning follows [`market.md`](market.md): we are **not** an alternative to SWIFT, we are an
alternative to correspondent banking. The lead is reconciliation, not speed and not verifiability —
tracking is already what gpi promises banks, so leading with it says we match the incumbent.

**372 spoken words — about 2:50 at a deliberate pace.** That is under three minutes on purpose. The
marked pauses and the switch to the live app consume the rest, and a pitch that fills its slot with
words has no room to land. Do not add more text to reach 3:00.

Slides: [`assets/zip0-pitch.pptx`](assets/zip0-pitch.pptx). Regenerate with
`node scripts/build-pitch-deck.mjs` after changing this script — the deck follows it, not the
other way round. Speaker cues are in the PowerPoint notes pane.

---

## The script

> **[0:00 — Open. Slide 1: wordmark on near-black.]**

My name is Julio Severiche, and this is ZIP·0.

> **[0:10 — Slide 2: the invoice. One number, large.]**

A banana exporter in Cochabamba ships to a buyer in Brazil and invoices fifty thousand dollars.

Eleven days later, forty-eight thousand six hundred arrives.

> **[Pause. Let the gap sit.]**

Nobody stole anything. Three correspondent banks each took a fee in flight.

Now someone on her team spends Thursday matching a short payment against the original invoice,
chasing the difference, and explaining it to a supplier who also got paid less than agreed.

> **[0:45 — Slide 3: messaging layer vs settlement layer.]**

People call this a SWIFT problem. It isn't.

SWIFT is messaging. It carries the instruction — it never holds the money. The money moves through
correspondent banking, one bank holding an account for another. That is where the deduction
happens, and that is the layer nobody has replaced.

It is also where the capital goes to die. More than twenty-seven trillion dollars sits idle in
these accounts right now, pre-funded so the corridors can exist at all.

> **[1:20 — Slide 4: the product. Mark centred, rail passing through.]**

ZIP·0 replaces the settlement layer, not the messaging.

A settlement contract holds the funds. The payment locks on one side and releases on the other.
One rail. No intermediaries taking a cut mid-flight, and no pre-funded account in every corridor.

The exporter receives the amount on the invoice. Not the amount minus whatever the chain decided.

> **[Same slide. This is the moment the objection forms — answer it before it is asked.]**

You might ask why she does not just accept digital dollars directly. She has no wallet, and her
bank will not take them. That is precisely the customer.

> **[1:50 — Slide 5: live product. Switch to the deployed app.]**

This is running now, on HashKey Chain.

The settlement contract is deployed and its source is verified on the block explorer. You do not
have to believe me — you can read it.

And the available funds on this screen are not a mockup. The app reads them from the chain every
fifteen seconds.

> **[2:20 — Slide 6: what is real. Stay honest, do not soften.]**

Let me be precise about what this is. A testnet prototype. Unaudited. A trusted operator.

The submit button is disabled, and that is deliberate. Every figure in this interface came from a
real chain read — or it says unavailable. Nothing here is decoration.

> **[2:40 — Slide 7: the team. Look at the room, not the screen.]**

Five of us built this, in Bolivia.

> **[2:50 — Slide 8: close. Wordmark and one line.]**

The contract is live and verified. What we need next is an audit and one pilot corridor:
Bolivia to Brazil.

ZIP·0. The amount you send is the amount that arrives.

---

## Delivery notes

**The one thing to get right.** The pause after "forty-eight thousand six hundred arrives" is the
whole pitch. That gap is where the audience does the subtraction themselves. If you fill it, they
hear a statistic instead of a loss.

**Say the numbers slowly.** "Twenty-seven trillion" lands only if it is given room. Everything else
can move at pace.

**Do not say "blockchain" until slide 5, and only once.** The audience is institutional. Naming the
technology early reframes the pitch as a crypto project rather than a settlement product — and it
invites the objection before the problem has landed.

**Do not oversell on slide 6.** Stating the limits plainly is the strongest moment in the pitch,
because every other team will be claiming more than they built. This project removed three
fabricated transaction hashes from its own codebase; that standard is the differentiator, so hold
it on stage.

**The alternatives line is doing real work.** "Why not just send digital dollars?" is the most
predictable objection in a payments pitch, and it forms in the listener's head the instant you
describe the solution. A judge who is arguing with you internally is not listening. Answering it
unprompted, in one sentence, costs ten seconds and buys back the rest of the pitch.

Everything else about competitors — Binance Pay, suppliers who already accept crypto, and how we
make money — stays out of the spoken script on purpose. Three minutes cannot carry the problem,
the demo, the limits and a competitive analysis, and a revenue model that is not yet decided is
weaker said aloud than answered when asked. It is all in [`pitch-qa.md`](pitch-qa.md).

**If you are running long**, cut the sentence beginning "Now someone on her team" — it is the most
expendable line. Do not cut the pause, and do not cut the alternatives line.

**If a judge asks about regulation** — point at the disclosures page. It states which obligations
apply and which we do not yet meet, by jurisdiction. Do not improvise on this.

**For everything else**, see [`pitch-qa.md`](pitch-qa.md): Binance Pay, suppliers who already accept
crypto, what we offer over the alternatives, and how ZIP·0 makes money. Read section 0 before going
on stage — it corrects a factual error that would cost the room.
