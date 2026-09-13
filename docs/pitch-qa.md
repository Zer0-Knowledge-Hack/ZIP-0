# Pitch Q&A — the four questions that decide the room

Prepared answers for the objections most likely to come after the pitch. Each one states the honest
position, including where we are weaker than the alternative.

The rule for all of them: **concede the true part first.** An audience that hears you defend an
indefensible point stops believing the defensible ones.

---

## 0. Correct this before you go on stage

> "Binance Pay already uses SWIFT underneath."

**This is not true, and saying it will cost you the room.**

Binance Pay moves value on Binance's **internal ledger**, between two Binance accounts. It is
instant and free between users. No SWIFT message is generated, because no money leaves Binance —
only a database entry changes owner.

SWIFT and local rails appear only at the **edges**: getting fiat in, and getting fiat out. And even
there it is usually local rails, not SWIFT.

If you claim Binance Pay runs on SWIFT, any judge who works in payments knows you are wrong, and
everything you said before it becomes suspect. The real argument against Binance Pay is a different
one, and it is stronger.

---

## 1. "Why not just use Binance Pay?"

**Concede first:** for two small businesses that both already have Binance accounts, Binance Pay is
genuinely better than us today. Faster, free, and it exists. We are not trying to win that user.

Then the three reasons an institution cannot use it:

| | Binance Pay | ZIP·0 |
| --- | --- | --- |
| **Reach** | Both parties must be Binance customers, in a supported jurisdiction | The counterparty needs a bank account, not an exchange account |
| **Custody** | Your working capital sits with one exchange | Funds sit in a settlement contract whose code is published and verified |
| **Exit** | You cannot unilaterally recover funds | `claimRefund` returns the payment to the payer after 24 hours if nothing settled |

The custody point is the one that matters in an institutional room. A regulated institution's
treasury policy generally cannot permit parking working capital at a crypto exchange — not because
of ideology, but because it is a single counterparty with no deposit guarantee. Everyone in that
room remembers FTX.

**One line if you only get one:** "Binance Pay asks you to trust a company. We ask you to read a
contract."

---

## 2. "What if my supplier already accepts crypto?"

**Then we are worth much less to you, and I will not pretend otherwise.**

If both sides are crypto-native, comfortable with custody, and happy to reconcile in stablecoins,
the honest answer is that you do not need us.

What is still unsolved even in that case:

- Your supplier still has to reach local currency to pay wages and taxes.
- Your finance team still has to match what arrived against what was invoiced, and produce
  something an auditor accepts.
- Someone still carries FX exposure between the invoice date and the settlement date.

But the customer we are actually built for is the opposite one: **the party that cannot hold crypto
at all.** A cooperative, an importer, a mid-size institution whose policy or regulator forbids
holding digital assets. For them the rail has to be invisible — they send an invoice amount and
receive an invoice amount, and the settlement mechanism is our problem, not theirs.

If your supplier already takes crypto, you have solved your own problem. Most exporters in this
region have not.

---

## 3. "What do you actually offer over the other solutions?"

This is where overclaiming kills you, so be exact about today versus the design.

**What is genuinely different today:**

1. **The rules are readable.** The settlement contract is deployed and its source is verified on the
   block explorer. You can read exactly what can happen to your money. No exchange, bank or
   remittance provider offers that.
2. **The payer has a unilateral exit.** `claimRefund` lets the payer recover the deposit after 24
   hours if the operator never acknowledged it. You are not dependent on our goodwill or our
   continued existence.
3. **A stated safety invariant.** A payment cannot both settle at the destination and be refunded at
   the origin. It is written down formally and enforced by the state machine, not asserted in
   marketing.
4. **Disclosures that say what we do not have.** The legal page lists, per jurisdiction, which
   obligations would apply and which we do not yet meet.

**What is not different yet, and you must say so if asked:**

Today an operator with the relayer role can release funds from the vault. That is the same class of
trust assumption as an exchange, at a smaller scale. It is not solved. The audit and the compliance
model are what remove it, and neither is done.

**The honest framing:** "Our advantage today is not that we are trustless. It is that our trust
assumptions are written down, bounded, and enforceable on-chain — and that the payer can always
walk away with their money."

That answer beats a confident lie, because the person asking already knows the answer.

---

## 4. "How does ZIP·0 make money?"

> **Status: not decided, and not implemented.** The contract charges **zero** today — `releasePayment`
> transfers the full amount. Do not invent a number on stage.

Start with the constraint, because it is the interesting part:

**Our pitch forbids the obvious business model.** "The amount you send is the amount that arrives"
rules out taking a cut mid-flight — that is precisely the behaviour we are attacking. So revenue has
to come from somewhere the payer agrees to *before* the payment moves.

That leaves four candidates:

| Model | How it works | Trade-off |
| --- | --- | --- |
| **Quoted fee at initiation** | The sender sees the fee in the quote and pays it on top. The beneficiary still receives the full invoice | Preserves the promise exactly. Easy to undercut |
| **Subscription per institution** | Flat platform fee, unlimited corridors | Predictable revenue, never touches the payment. Slow to sell |
| **Liquidity provision** | We pre-fund the corridor so the institution does not have to, and charge for guaranteed same-day settlement | Directly attacks the $27tn nostro problem. Capital-intensive — this is the one that needs funding |
| **FX spread** | Quoted transparently at conversion | Largest revenue pool, and where incumbents actually earn. Also the least differentiated |

**The answer to give:** a quoted fee at initiation plus paid liquidity provision. The fee keeps the
core promise intact because it is visible before you send and never deducted from the beneficiary.
Liquidity provision is the real business — we take on the pre-funding burden institutions currently
carry themselves, which is the $27 trillion problem stated from the other side.

**If pressed for a number:** say it is not set, and that pricing follows the pilot corridor. Naming
a fabricated take rate to a room that prices payments for a living is worse than saying "not yet".

---

## What not to say

- Do not say Binance Pay runs on SWIFT. See section 0.
- Do not say "we are trustless" or "non-custodial". An operator can release funds today.
- Do not say "we replace SWIFT". We replace correspondent banking settlement; SWIFT is messaging.
- Do not quote a fee percentage. There is no fee in the contract.
- Do not claim payments are live. The submit button is disabled and the demo is testnet.
- Do not answer a regulatory question from memory. Open the disclosures page and read from it.
