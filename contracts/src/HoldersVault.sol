// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {ReentrancyGuard} from "@openzeppelin/security/ReentrancyGuard.sol";

interface IPonsFeeEscrow { function claim() external; }
interface IPonsFactory {
    struct Launch { address token; address curve; address deployer; address creatorFeeRecipient; address pairToken; uint256 graduationThreshold; uint24 poolFee; int24 tickSpacing; uint16 creatorTaxBps; bool buybackEnabled; uint8 phase; uint256 sweptQuote; uint256 sweptTokens; uint256 sweptAt; bool exists; }
    function getLaunchedToken(address token) external view returns (Launch memory);
}
interface IPonsCurve { function sweepFees(uint256) external; }
interface IPonsHook { function sweepPoolFees(bytes32,uint256,uint256) external; }

/// @notice Holder-share native ETH adapter for pons v2 on Robinhood mainnet.
/// Fees collect here, then the controller signs explicit payout batches prepared
/// by the local keeper from explorer balance snapshots.
/// No upgrade, delegatecall, arbitrary external call or stored recipient list:
/// every recipient and amount is visible in the signed transaction.
contract HoldersVault is ReentrancyGuard {
    address public constant feeEscrow = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address public controller;
    uint256 public totalDistributed;
    uint256 public rounds;
    mapping(address => uint256) public distributed;
    event RevenueReceived(address indexed sender, uint256 amount);
    event Distributed(uint256 indexed round, address indexed recipient, uint256 amount);

    constructor() {
        require(block.chainid == 4663, "Robinhood mainnet only");
        controller = msg.sender;
    }
    receive() external payable { if (msg.value != 0) emit RevenueReceived(msg.sender, msg.value); }
    /// The escrow credits msg.sender, so the vault must claim its own ledger.
    /// Anyone may trigger collection; only the controller can move funds out.
    function claimFees() external nonReentrant { IPonsFeeEscrow(feeEscrow).claim(); }
    /// Zero swap bounds are safe only when no conversion/buyback is needed.
    /// Pons rejects creator sweeps requiring internal swaps. The operator must settle those.
    function sweepFees(address token) external nonReentrant {
        IPonsFactory.Launch memory launch = IPonsFactory(0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e).getLaunchedToken(token);
        require(launch.exists && launch.creatorFeeRecipient == address(this), "Unrelated launch");
        require(launch.pairToken == address(0) && !launch.buybackEnabled, "Operator settlement required");
        if (launch.phase == 0) IPonsCurve(launch.curve).sweepFees(0);
        else {
            require(launch.phase == 2, "Pool unavailable");
            bytes32 pool = keccak256(abi.encode(address(0),token,launch.poolFee,launch.tickSpacing,address(0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044)));
            IPonsHook(0xE5e702641Ea86F4ae6cC3cDaeD2B886f976Be044).sweepPoolFees(pool,0,0);
        }
    }
    function totalReceived() public view returns (uint256) { return address(this).balance + totalDistributed; }
    function distributable() public view returns (uint256) { return address(this).balance; }
    /// Explicit batch payout: all-or-nothing per round, so a signed round cannot
    /// silently skip wallets. Recipients are not validated against any snapshot
    /// onchain; correctness depends on the prepared transaction the controller reviews.
    function distribute(address[] calldata recipients, uint256[] calldata amounts) external nonReentrant {
        require(msg.sender == controller, "Controller only");
        require(recipients.length == amounts.length && recipients.length != 0 && recipients.length <= 200, "Invalid payout list");
        uint256 total;
        for (uint256 i; i < recipients.length; ++i) {
            require(recipients[i] != address(0) && recipients[i] != address(this), "Invalid recipient");
            require(amounts[i] != 0, "Zero payout");
            total += amounts[i];
        }
        require(total <= address(this).balance, "Exceeds vault balance");
        rounds += 1;
        uint256 round = rounds;
        for (uint256 i; i < recipients.length; ++i) {
            distributed[recipients[i]] += amounts[i];
            totalDistributed += amounts[i];
            (bool success,) = recipients[i].call{value: amounts[i]}("");
            require(success, "Payout transfer failed");
            emit Distributed(round, recipients[i], amounts[i]);
        }
    }
}
