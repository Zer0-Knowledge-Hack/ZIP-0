# Market — what SWIFT actually does, and what hurts

Research behind ZIP-0's positioning. The short version: we had the competitor wrong, and we were
leading with the wrong pain.

## SWIFT is messaging, not settlement

SWIFT, founded in 1973, operates a secure financial **messaging** network. It does not hold
balances and it does not move money. It carries payment instructions between institutions in a
standard format.

The money moves through **correspondent banking**: one bank holds an account for another —
nostro and vostro accounts — and debits and credits them to settle. That is the layer where the
delay, the cost and the opacity live.

**Implication for how we talk about ZIP-0.** "An alternative to SWIFT" is imprecise, and a banker
will notice. We are an alternative to the *correspondent banking settlement layer*. SWIFT is the
instruction layer above it. "Alternative to correspondent banking" is both more accurate and more
compelling, because that is the part institutions complain about.

## What SWIFT gpi gives banks

gpi is the modern service layer on top of the same rails. It attaches a unique reference to each
payment and requires every bank in the chain to confirm what it did. Four commitments:

| gpi provides | Consequence for us |
| :--- | :--- |
| Speed commitments (SLAs) | We beat this on the vault rail |
| End-to-end tracking in real time | **Table stakes, not a differentiator** |
| Fee and FX transparency | Partially solved; we can go further |
| Unaltered remittance information | We should match it |

The important line is the second. Tracking and verifiability are what gpi already promises banks.
Leading with "every payment is verifiable" tells an institutional audience we match the incumbent
— it does not tell them why to switch.

## What actually hurts

### Trapped liquidity

**More than $27 trillion sits idle in nostro accounts at any given time.** To pay into a corridor,
an institution must pre-fund an account in that currency, in that jurisdiction. That capital is
parked, not deployed, and it is exposed to FX movement while it sits.

Smaller institutions cannot fund every corridor, so they lean on more intermediaries — which adds
cost and settlement risk to exactly the parties least able to absorb it.

### The amount that arrives is not the amount you sent

This is the pain worth leading with, and the one we were not addressing.

Intermediary banks deduct fees mid-flight. The beneficiary receives less than the invoice, so the
receivables team spends hours matching short payments against original invoices, chasing the
difference, and explaining it to the supplier.

It is not an abstract inefficiency. It is a person doing manual reconciliation every week because
the payment rail quietly changed the number.

### Cost is FX and liquidity, not messaging

Most of the cost and delay comes from currency conversion and liquidity management, not from the
messaging technology. Anyone pitching "faster messages" is solving the cheap part of the problem.

## How this changes our copy

| Was | Should be |
| :--- | :--- |
| "Alternative to SWIFT" | Alternative to correspondent banking |
| Lead with verifiability | Lead with: the amount you send is the amount that arrives |
| "Settled in seconds" | Same day, no pre-funded account in each corridor |
| Tracking as a headline feature | Tracking as an expectation, mentioned once |

The reconciliation angle is stronger than speed because it is felt daily by the person who would
champion the tool internally, and because it is concrete enough to picture.

## Sources

- [Swift gpi](https://www.swift.com/products/swift-gpi)
- [Societe Generale — transparency in cross-border payments](https://wholesale.banking.societegenerale.com/en/news-insights/all-news-insights/news-details/news/beyond-speed-and-cost-the-push-for-transparency-in-cross-border-payments/)
- [Thunes — liquidity in cross-border payments](https://www.thunes.com/insights/solutions/demystifying-liquidity-in-cross-border-payments-challenges-and-solutions/)
- [Circle — legacy system friction](https://www.circle.com/blog/global-payments-today-constraints-complexity-and-the-path-forward)
- [The Payments Association — cross-border payments 2026](https://thepaymentsassociation.org/article/cross-border-payments-2026-friction-reform/)
