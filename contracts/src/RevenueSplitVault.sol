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

/// @notice Fixed-recipient native ETH adapter for pons v2 on Robinhood mainnet.
/// No upgrade, delegatecall, arbitrary external call or recipient changes.
contract RevenueSplitVault is ReentrancyGuard {
    address public constant feeEscrow = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    address public controller;
    address public projectTreasury;
    address public auditTreasury;
    uint16 public auditBps;
    uint256 public totalReleased;
    mapping(address => uint256) public released;
    event RevenueReceived(address indexed sender, uint256 amount);
    event RevenueReleased(address indexed recipient, uint256 amount);

    constructor(address project, address reserve, uint16 reserveBps) {
        require(block.chainid == 4663, "Robinhood mainnet only");
        require(project != address(0) && reserve != address(0), "Treasury address is required");
        require(project != reserve, "Treasury addresses must differ");
        require(project != address(this) && reserve != address(this), "Vault cannot be a recipient");
        require(reserveBps <= 10000, "Reserve share exceeds 100%");
        controller = msg.sender;
        projectTreasury = project;
        auditTreasury = reserve;
        auditBps = reserveBps;
    }
    receive() external payable { if (msg.value != 0) emit RevenueReceived(msg.sender, msg.value); }
    /// The escrow credits msg.sender, so the vault must claim its own ledger.
    /// Anyone may trigger collection; funds can only leave for the fixed recipients.
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
    function totalReceived() public view returns (uint256) { return address(this).balance + totalReleased; }
    function pending(address recipient) public view returns (uint256) {
        require(recipient == projectTreasury || recipient == auditTreasury, "Unknown recipient");
        uint256 gross = totalReceived();
        uint256 reserve = gross * auditBps / 10000;
        uint256 entitlement = recipient == auditTreasury ? reserve : gross - reserve;
        return entitlement - released[recipient];
    }
    function release(address payable recipient) external nonReentrant {
        uint256 amount = pending(recipient);
        require(amount != 0, "No revenue to release");
        released[recipient] += amount;
        totalReleased += amount;
        (bool success,) = recipient.call{value: amount}("");
        require(success, "Revenue transfer failed");
        emit RevenueReleased(recipient, amount);
    }
}
