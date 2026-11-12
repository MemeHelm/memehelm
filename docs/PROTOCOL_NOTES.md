# Pons v2 integration

Primary references: https://docs.ponsfamily.com/v2 and https://developers.uniswap.org/docs/protocols/v4/deployments . The docs root defaults to v1; always use /v2. Robinhood mainnet: https://docs.robinhood.com/chain/connecting/ .

Factory: 0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e. Hook: 0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044. Fee escrow: 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e. Uniswap router 2.1.2: 0x204FAca1764B154221e35c0d20aBb3c525710498. Runtime bytecode hashes, Quoter, StateView, PoolManager and Permit2 are pinned in shared/pons-addresses.mjs, read on 2026-11-12.

Pons launches mint all initial supply to a bonding curve. The current live configuration read was 1 billion 18-decimal tokens, 1% base fee, 1.68 ETH virtual reserve, and 4.2 ETH graduation threshold; launchFee was 0.0005 ETH and creator-fee cap 10%. These are observations, not hard-coded terms. Query enabled configurations, canLaunch(owner), fees and expectedEconomics each time.

Curve math uses integer fee ordering and full virtual+real reserves for marginal price. Progress uses realQuoteReserve only. A final buy can be clamped and refunded: minTokensOut protects the quoted rate, scaled against requested input. Sells close when readyToGraduate, before the curve’s graduated flag may change. Phase 1 waits for pool creation; phase 2 routes both trade directions to Uniswap v4; phase 3 is rescued and not tradeable.

V4 trades use pool keys read from launch records, hook-aware Quoter calls and Universal Router actions SWAP_EXACT_IN_SINGLE → SETTLE_ALL → TAKE_ALL. Approvals are exact and short-lived, including Permit2. Each signature step is bound to wallet, network, quote id and expiry. Every transaction is simulated where approvals already permit it; later approval-dependent execution is gas-estimated in the user wallet. Local fork tests verify the actual complete approval and swap sequences.

Fees accrue on the curve/hook before settlement into the escrow. An escrow balance belongs to the recipient, possibly across multiple tokens, and is never represented as project-only income. Unswept fields show gross protocol amounts, not the creator’s final entitlement. Native fees can be claimed only by the credited address. The MemeHelm adapter calls escrow.claim() itself, then allows independent releases to fixed wallets. It has no upgrades, arbitrary calls or recipient setters. Its controller identifies the creating wallet and has no redirection power.

Creator sweeps requiring conversion or buyback revert unless made by the protocol operator. The UI does not label these funds ready to collect. The first release offers native ETH pairs only and disables buyback vesting. Custom ERC-20 pairs, legacy pons factories, community takeovers, token-ledger claims and migrations are outside this release.

Pons docs list ongoing audit work. The MemeHelm adapter has local tests and fork verification, not an independent audit. No assistant broadcasts or real user funds were used in development verification.
