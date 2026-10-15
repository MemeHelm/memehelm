// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {VaultBaseV2} from "./flap/VaultBaseV2.sol";
import {VaultFactoryBaseV2} from "./flap/VaultFactoryBaseV2.sol";
import {IVaultFactoryValidationV2} from "./flap/IVaultFactory.sol";
import {VaultUISchema, VaultMethodSchema, VaultDataSchema, FieldDescriptor, ApproveAction, FactoryPolicy} from "./flap/IVaultSchemasV1.sol";
import {Initializable} from "@openzeppelin-upgradeable/proxy/utils/Initializable.sol";
import {ReentrancyGuardUpgradeable} from "@openzeppelin-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import {BeaconProxy} from "@openzeppelin/proxy/beacon/BeaconProxy.sol";
import {UpgradeableBeacon} from "@openzeppelin/proxy/beacon/UpgradeableBeacon.sol";
import {Strings} from "@openzeppelin/utils/Strings.sol";

/// @notice Native-BNB revenue splitter. No trading, AI execution, or owner withdrawals.
/// @dev The immutable launch configuration allocates revenue to two fixed recipients.
///      The Flap Guardian owns the beacon and can change this implementation.
contract RevenueSplitVault is VaultBaseV2, Initializable, ReentrancyGuardUpgradeable {
    address public taxToken;
    address public projectTreasury;
    address public auditTreasury;
    uint16 public auditBps;
    uint256 public totalReleased;
    mapping(address => uint256) public released;

    event RevenueReceived(address indexed sender, uint256 amount);
    event RevenueReleased(address indexed recipient, uint256 amount);

    constructor() { _disableInitializers(); }

    function initialize(address token, address project, address audit, uint16 reserveBps) external initializer {
        require(token != address(0), "Token is required");
        require(project != address(0) && audit != address(0), "Treasury address is required");
        require(project != audit, "Treasury addresses must differ");
        require(project != address(this) && audit != address(this), "Vault cannot be a recipient");
        require(reserveBps <= 10000, "Audit share exceeds 100%");
        __ReentrancyGuard_init();
        taxToken = token;
        projectTreasury = project;
        auditTreasury = audit;
        auditBps = reserveBps;
    }

    /// @dev Deliberately O(1). Recipient calls happen in release(), outside the receive path.
    receive() external payable { if (msg.value != 0) emit RevenueReceived(msg.sender, msg.value); }

    /// @notice Total received native currency, including forced transfers.
    function totalReceived() public view returns (uint256) { return address(this).balance + totalReleased; }

    function pending(address recipient) public view returns (uint256) {
        require(recipient == projectTreasury || recipient == auditTreasury, "Unknown recipient");
        uint256 gross = totalReceived();
        uint256 reserve = gross * auditBps / 10000;
        uint256 entitlement = recipient == auditTreasury ? reserve : gross - reserve;
        return entitlement - released[recipient];
    }

    /// @notice Anyone can trigger a payout; funds always go to the recorded recipient.
    function release(address payable recipient) external nonReentrant {
        uint256 amount = pending(recipient);
        require(amount != 0, "No revenue to release");
        released[recipient] += amount;
        totalReleased += amount;
        (bool success,) = recipient.call{value: amount}("");
        require(success, "Revenue transfer failed");
        emit RevenueReleased(recipient, amount);
    }

    function description() public view override returns (string memory) {
        return string.concat("Native BNB split vault. Audit reserve: ", Strings.toString(auditBps),
            " bps. No audit certification is implied. Beacon upgrades are controlled by the Flap Guardian.");
    }

    function vaultUISchema() public pure override returns (VaultUISchema memory schema) {
        schema.vaultType = "RevenueSplitVault";
        schema.description = "Splits native BNB revenue between fixed project and audit-reserve wallets. Guardian-controlled beacon upgrades.";
        schema.methods = new VaultMethodSchema[](9);
        schema.methods[0] = _method("taxToken", "Token served by this vault", "token", "address", 0);
        schema.methods[1] = _method("projectTreasury", "Project revenue recipient", "recipient", "address", 0);
        schema.methods[2] = _method("auditTreasury", "Audit reserve recipient", "recipient", "address", 0);
        schema.methods[3] = _method("auditBps", "Audit share in basis points (100 = 1%)", "bps", "uint16", 0);
        schema.methods[4] = _method("totalReceived", "Total native BNB received", "amount", "uint256", 18);
        schema.methods[5] = _method("totalReleased", "Total native BNB released", "amount", "uint256", 18);
        schema.methods[6] = _method("pending", "Native BNB available to a fixed recipient", "amount", "uint256", 18);
        schema.methods[6].inputs = _recipientInput();
        schema.methods[7] = _method("released", "Native BNB already paid to a recipient", "amount", "uint256", 18);
        schema.methods[7].inputs = _recipientInput();
        schema.methods[8] = _method("release", "Pay available native BNB to the fixed recipient", "", "", 0);
        schema.methods[8].inputs = _recipientInput();
        schema.methods[8].isWriteMethod = true;
    }

    function _recipientInput() private pure returns (FieldDescriptor[] memory fields) {
        fields = new FieldDescriptor[](1);
        fields[0] = FieldDescriptor("recipient", "address", "Project or audit-reserve wallet", 0);
    }

    function _method(string memory name, string memory help, string memory output, string memory kind, uint8 decimals)
        private pure returns (VaultMethodSchema memory method) {
        method.name = name;
        method.description = help;
        method.inputs = new FieldDescriptor[](0);
        method.outputs = new FieldDescriptor[](bytes(output).length == 0 ? 0 : 1);
        if (bytes(output).length != 0) method.outputs[0] = FieldDescriptor(output, kind, help, decimals);
        method.approvals = new ApproveAction[](0);
    }
}

contract RevenueSplitFactory is VaultFactoryBaseV2 {
    address public immutable beacon;
    event VaultCreated(address indexed token, address indexed vault, address indexed creator);

    constructor() {
        require(block.chainid == 97, "Initial release supports BNB Testnet only");
        RevenueSplitVault implementation = new RevenueSplitVault();
        UpgradeableBeacon upgradeableBeacon = new UpgradeableBeacon(address(implementation));
        upgradeableBeacon.transferOwnership(_getGuardian());
        beacon = address(upgradeableBeacon);
    }

    function newVault(address token, address quoteToken, address creator, bytes calldata vaultData)
        external override returns (address vault) {
        require(msg.sender == _getVaultPortal(), "Only VaultPortal");
        require(quoteToken == address(0), "Native BNB only");
        require(token != address(0), "Token is required");
        (address project, address audit, uint16 reserveBps) = abi.decode(vaultData, (address, address, uint16));
        vault = address(new BeaconProxy(beacon,
            abi.encodeCall(RevenueSplitVault.initialize, (token, project, audit, reserveBps))));
        emit VaultCreated(token, vault, creator);
    }

    function isQuoteTokenSupported(address quoteToken) external pure override returns (bool) { return quoteToken == address(0); }

    function _validateBeforeLaunch(IVaultFactoryValidationV2.LaunchValidationDataV1 memory data)
        internal pure override returns (bool success, string memory reason) {
        if (data.quoteToken != address(0)) return (false, "Native BNB only");
        if (data.vaultBps == 0) return (false, "A vault revenue allocation is required");
        return (true, "");
    }

    function tokenCreationPolicies() public pure override returns (FactoryPolicy[] memory policies) {
        policies = new FactoryPolicy[](1);
        policies[0] = FactoryPolicy("quoteToken", "eq", abi.encode(address(0)), "Native BNB only");
    }

    /// @dev The prototype charges zero factory commission. Any future paid model needs
    ///      explicit product configuration, a new reviewed deployment and user disclosure.
    function vaultDataSchema() public pure override returns (VaultDataSchema memory schema) {
        schema.description = "Native BNB split; zero factory commission. Fixed recipients and reserve share. Guardian controls beacon upgrades.";
        schema.fields = new FieldDescriptor[](3);
        schema.fields[0] = FieldDescriptor("projectTreasury", "address", "Project revenue wallet", 0);
        schema.fields[1] = FieldDescriptor("auditTreasury", "address", "Separate audit reserve wallet", 0);
        schema.fields[2] = FieldDescriptor("auditBps", "uint16", "Audit share, 0-10000 basis points", 0);
    }
}
