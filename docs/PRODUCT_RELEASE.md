# Product scope

MemeHelm combines pons v2 issuance/trading on Robinhood mainnet with creator operations and transparent ETH revenue routing. The product is creator-led: AI supplies drafts and suggestions, while the creator approves public updates and signs transactions.

The launch flow offers a direct EOA fee recipient or a MemeHelm fixed two-wallet split. The split is activated before issuance and becomes the pons fee recipient. Supply, graduation rules and base fees come from enabled pons configurations. Optional creator fees cannot exceed the live cap. There is no arbitrary premint, independent factory activation, initial vault deposit disguised as a buy, automated trading or cross-chain flow.

Discovery and trade history cover recent 20,000 blocks, up to 30 launch cards and 60 recent trades. Charts use actual execution events or locally observed spot prices, with source/coverage labels. Read-only custom-pair markets retain the actual quote asset and decimals, including USDG; transaction preparation still accepts native ETH pairs only. Core facts load independently of holder indexing and trade history, with bounded deadlines and retry. There is no all-time indexer, fabricated history, USD oracle or investment rating. Holder data depends on Blockscout availability.

EIP-4361 sign-in, chain/wallet-scoped browser drafts, wallet-owned SQLite records and explicit publication protect private work. The server binds to loopback. Hosting, production operations and a published security audit have not been supplied/completed. User-facing pages contain product actions and material transaction facts, not developer progress or setup instructions.
