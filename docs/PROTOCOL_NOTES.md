# Independent MemeHelm protocol

Updated 2026-11-12. The user explicitly removed Flap. Current issuance depends on Robinhood Chain RPC and MemeHelm's own contracts; it does not call an external launch portal or registry.

## Contracts

`MemeHelmLaunchFactory.createToken(config, salt)` atomically deploys a fixed-supply ERC-20 and a two-recipient native-ETH splitter. CREATE2 salts include the signing creator address, preventing another creator from occupying the same predicted address using the same salt. The factory stores the creator and vault for each token and emits `TokenCreated`.

The token uses the retained OpenZeppelin ERC20 implementation. Its supply is minted once to the signing creator. Its IPFS token URI is fixed in the constructor; no setters, owner, mint, upgrade, blacklist, transfer restriction or tax function is exposed.

The vault has immutable token, factory, recipients and reserve share. It uses independent pull payouts with a reentrancy guard. Total received is `balance + totalReleased`, including forced ETH. The reserve receives `floor(totalReceived * reserveBps / 10000)` and the project receives the remainder. Each recipient can claim its cumulative entitlement minus its already released amount. A rejecting recipient cannot block the other wallet.

There is no proxy, beacon, privileged withdrawal or external Guardian. The factory constructor rejects every chain except 46630. Exact compiled factory runtime-bytecode matching is required before preparing a launch and before trusting a vault's factory registration.

## Economics and boundaries

The integrated path is fixed-supply issuance, not a fair-launch bonding curve. All supply initially belongs to its creator. No market, liquidity, trading tax, price or automatic project income is created. Optional initial test ETH funds the vault and is immediately allocated to its fixed recipients; it purchases no tokens. The factory keeps none of that deposit and charges no commission.

Future trading pools, curve sales, transfer rules, reward strategies, automation and fees need their own protocol design, transparent user disclosures, implementation and tests. No hypothetical future income is counted toward an audit budget.

## Reads and external services

- Robinhood Testnet chain 46630, native ETH, public RPC and Blockscout explorer. Public RPC is rate-limited; production needs appropriate infrastructure.
- IPFS content pinned by the user; availability depends on its host.
- Injected browser wallet for explicit sign-in and transactions.
- Optional server-only model provider for user-requested writing. No signing tools are available to the model.

No public deployment or independent security audit is claimed. The earlier internal review concerns superseded contracts only.

Primary references: [Robinhood network configuration](https://docs.robinhood.com/chain/connecting/), [OpenZeppelin ERC20 v4](https://docs.openzeppelin.com/contracts/4.x/erc20), [OpenZeppelin security v4](https://docs.openzeppelin.com/contracts/4.x/api/security).
