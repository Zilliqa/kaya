# Roadmap for Kaya

## Pre Release
* Basic functionalities to enable contract development
* JSON well-formness checks
* Debug mode to enable greater verbosity for developers
* Nonce and gas checks
* Save and load snapshots for persistence storage

<===== OPEN SOURCE =======>

## Kaya 0.1.0 (by mid-sep)
* [ ] Signature verification
* [ ] Built-in support for interpreter API (so users do not need to compile scilla locally)
    * [ ] Many calls have to be refractored from sync to async
* [ ] Load wallets into kaya for deterministic testing
* [ ] CI tools integration
* [ ] Automated Testing

## Kaya 0.2.0 (by end-Oct)
* [ ] Multi-contract functionality with state revert functionality
* [ ] Psuedo-values for DX and TX blocks
* [ ] GetBlockchainInfo

## Future implementations
* In-memory DB (e.g. [leveljs](https://github.com/Level/level-js))
* GUI
* Contract test suites (most probably a different project entirely)
