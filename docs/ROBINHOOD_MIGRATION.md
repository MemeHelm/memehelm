# Mainnet migration

The active product is pons v2 on Robinhood mainnet (4663), explicitly selected by the user on 2026-11-12. Earlier BSC/Flap and independent Robinhood-testnet prototypes are historical.

The browser prefix is memehelm:4663:pons-v2:<wallet>. The default SQLite directory is data/robinhood-mainnet-pons-v2. Older stores are untouched and are not automatically imported or displayed as mainnet launches. The independent factory source is archived as text under docs/historical and is not exposed by the artifact API. Only the current RevenueSplitVault artifact can be requested.

No private keys move into the server. Mainnet writes remain wallet-signed. Local fork testing is permitted and never uses a remote broadcast destination.
