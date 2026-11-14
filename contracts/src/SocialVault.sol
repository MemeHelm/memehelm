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

/// @notice Community-escrow native ETH adapter for pons v2 on Robinhood mainnet.
/// Fees wait here until the controller proposes a release; every proposal is public
/// onchain and must wait out a fixed review window before it can be executed.
/// No upgrade, delegatecall, arbitrary external call or stored identity rules:
/// the window and the signed proposal are the whole rule set.
contract SocialVault is ReentrancyGuard {
    address public constant feeEscrow = 0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    uint256 public constant reviewWindow = 2 days;
    address public controller;
    uint256 public totalReleased;
    uint256 public proposalCount;
    enum Status { Open, Executed, Cancelled }
    struct Proposal { address recipient; uint256 amount; uint256 proposedAt; Status status; }
    mapping(uint256 => Proposal) public proposals;
    event RevenueReceived(address indexed sender, uint256 amount);
    event Proposed(uint256 indexed id, address indexed recipient, uint256 amount, uint256 availableAt);
    event Executed(uint256 indexed id, address indexed recipient, uint256 amount);
    event Cancelled(uint256 indexed id);

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
    function totalReceived() public view returns (uint256) { return address(this).balance + totalReleased; }
    function distributable() public view returns (uint256) { return address(this).balance; }
    /// A proposal holds funds in place; only the review window and the controller stand between it and release.
    function propose(address recipient, uint256 amount) external nonReentrant {
        require(msg.sender == controller, "Controller only");
        require(recipient != address(0) && recipient != address(this), "Invalid recipient");
        require(amount != 0 && amount <= address(this).balance, "Invalid amount");
        proposalCount += 1;
        proposals[proposalCount] = Proposal({recipient: recipient, amount: amount, proposedAt: block.timestamp, status: Status.Open});
        emit Proposed(proposalCount, recipient, amount, block.timestamp + reviewWindow);
    }
    function execute(uint256 id) external nonReentrant {
        require(msg.sender == controller, "Controller only");
        Proposal storage proposal = proposals[id];
        require(proposal.status == Status.Open, "Proposal is not open");
        require(block.timestamp >= proposal.proposedAt + reviewWindow, "Review window is open");
        proposal.status = Status.Executed;
        totalReleased += proposal.amount;
        (bool success,) = proposal.recipient.call{value: proposal.amount}("");
        require(success, "Release transfer failed");
        emit Executed(id, proposal.recipient, proposal.amount);
    }
    function cancel(uint256 id) external nonReentrant {
        require(msg.sender == controller, "Controller only");
        Proposal storage proposal = proposals[id];
        require(proposal.status == Status.Open, "Proposal is not open");
        proposal.status = Status.Cancelled;
        emit Cancelled(id);
    }
}
