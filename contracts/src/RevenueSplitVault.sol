// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {ReentrancyGuard} from "@openzeppelin/security/ReentrancyGuard.sol";

/// @notice Non-upgradeable ETH splitter. Only its fixed recipients can receive payouts.
contract RevenueSplitVault is ReentrancyGuard {
    address public immutable token;
    address public immutable launchFactory;
    address public immutable projectTreasury;
    address public immutable auditTreasury;
    uint16 public immutable auditBps;
    uint256 public totalReleased;
    mapping(address => uint256) public released;
    event RevenueReceived(address indexed sender, uint256 amount);
    event RevenueReleased(address indexed recipient, uint256 amount);

    constructor(address token_, address project, address reserve, uint16 reserveBps) {
        require(token_ != address(0), "Token is required");
        require(project != address(0) && reserve != address(0), "Treasury address is required");
        require(project != reserve, "Treasury addresses must differ");
        require(project != address(this) && reserve != address(this), "Vault cannot be a recipient");
        require(reserveBps <= 10000, "Reserve share exceeds 100%");
        token = token_;
        launchFactory = msg.sender;
        projectTreasury = project;
        auditTreasury = reserve;
        auditBps = reserveBps;
    }
    receive() external payable { if (msg.value != 0) emit RevenueReceived(msg.sender, msg.value); }
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
