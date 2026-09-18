# Order Leak

## What It Is

Order Leak is a browser-only teaching demo of deterministic AES-GCM-SIV, a deliberately small BCLO-style order-preserving encryption construction, and CLWW-style order-revealing ciphertext comparisons. It demonstrates that ciphertext equality and order are useful database features and also inference signals. It is not production crypto: the OPE and ORE implementations are inspectable toy-domain teaching constructions, not a deployment library.

## Exhibits

1. The DBA view runs equality, range, and sorting queries on sealed values.
2. The attacker view receives only ciphertexts and a public distribution, then performs frequency matching, sorting, and MSDB-tree recovery.
3. Reveal scores every recovered cell against separately held truth; the randomized AES-GCM control recovers nothing.
4. The authentication fixture verifies every AES-GCM-SIV tag while showing that authentication does not hide equality leakage.

## When to Use It

Use this to learn why encrypted database query features need an explicit leakage budget. Do not use it to select a database product, encrypt real records, or conclude that authenticated encryption alone prevents inference.

## Live Demo

https://systemslibrarian.github.io/crypto-lab-order-leak/

Choose a column, run a ciphertext query, recover it from public statistics, and reveal the cell-by-cell score.

## What Can Go Wrong

Frequency ties are labelled ambiguous rather than guessed. Sorting is complete only for a dense column whose auxiliary distribution matches. Values outside the 8-bit OPE teaching domain are rejected. A randomized AES-GCM control intentionally cannot support equality or order queries.

## Real-World Usage

Property-preserving encryption was popularized for encrypted database query systems such as CryptDB. Deterministic encryption leaks equality; OPE and ORE leak ordering. The attacks illustrated here follow Naveed, Kamara, and Wright's inference-attack model and later MSDB leakage work by Durak, DuBuisson, Cash, and Grubbs et al.

## How to Run Locally

```bash
npm install
npm run dev
```

## Related Demos

[Crypto Lab](https://crypto-lab.systemslibrarian.dev/) includes related work on searchable encryption and format-preserving encryption.

## Build & Verify

```bash
npm test
npm run build
npm run test:a11y
```

The suite currently has 5 unit tests and 3 production-browser claim/accessibility tests. AES-GCM-SIV uses the audited `@noble/ciphers` implementation; OPE monotonicity and ORE comparison correctness are tested over the teaching domain.

## Performance

The demo intentionally uses a small table (240-1,000 rows) so each attack remains inspectable in a browser.

---

*One of the browser demos in the [Crypto Lab](https://crypto-lab.systemslibrarian.dev/) suite.*

*"So whether you eat or drink or whatever you do, do it all for the glory of God." — 1 Corinthians 10:31*# crypto-lab-order-leak