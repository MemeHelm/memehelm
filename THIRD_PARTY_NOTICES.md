# Third-party notices

The active Solidity dependencies are minimal source subsets, with their original licenses and source copyright headers preserved:

- OpenZeppelin Contracts 4.9.6: only contracts/security/ReentrancyGuard.sol, used by the fixed revenue vault. The original MIT license is retained at contracts/lib/openzeppelin-contracts/LICENSE.
- Forge Standard Library 1.14.0: only Test.sol and its transitive source imports, used by local contract tests. The original MIT and Apache-2.0 licenses are retained at contracts/lib/forge-std/LICENSE-MIT and LICENSE-APACHE. StdChains.sol has been locally adjusted to omit unused default network registrations. This subset is not an unchanged full upstream distribution.

Unused contract modules, dependency copies, test fixtures and upgradeable contract packages are not included. The retained dependencies are third-party work, not project-authored libraries.

JavaScript package licenses remain in the installed packages and lockfile. Optional Foundry tools in the ignored vendor directory originate from the official Foundry release and are not browser assets.
