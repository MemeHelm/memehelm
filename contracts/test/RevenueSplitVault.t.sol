// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Test} from "forge-std/Test.sol";
import {RevenueSplitFactory, RevenueSplitVault} from "../src/RevenueSplitVault.sol";
import {UpgradeableBeacon} from "@openzeppelin/proxy/beacon/UpgradeableBeacon.sol";
import {VaultUISchema, VaultDataSchema} from "../src/flap/IVaultSchemasV1.sol";

contract RevenueSplitVaultTest is Test {
    address constant PORTAL = 0xe9F7AB7DE8FB8756acbB6a1cd13316a43308197B;
    address constant GUARDIAN = 0x0000b48720d3B4ED6BC5031768B07F2b59270000;
    address constant PROJECT = address(0x1234);
    address constant AUDIT = address(0x5678);
    address constant TOKEN = address(0x7777);
    RevenueSplitFactory factory;
    RevenueSplitVault vault;

    function setUp() public {
        vm.chainId(46630);
        factory = new RevenueSplitFactory();
        vm.prank(PORTAL);
        vault = RevenueSplitVault(payable(factory.newVault(TOKEN, address(0), PROJECT, abi.encode(PROJECT, AUDIT, uint16(1000)))));
        vm.deal(address(this), 10 ether);
    }
    function testReceiveGasUnderBudgetAndSplit() public {
        uint256 beforeGas = gasleft();
        (bool ok,) = address(vault).call{value: 1 ether}("");
        assertTrue(ok); assertLt(beforeGas - gasleft(), 1000000);
        assertEq(vault.pending(PROJECT), 0.9 ether); assertEq(vault.pending(AUDIT), 0.1 ether);
    }
    function testReleasePaysOnlyTheRecordedRecipient() public {
        (bool ok,) = address(vault).call{value: 1 ether}(""); assertTrue(ok);
        vault.release(payable(AUDIT)); assertEq(AUDIT.balance, 0.1 ether);
        assertEq(vault.released(AUDIT), 0.1 ether); assertEq(vault.totalReceived(), 1 ether);
        vm.expectRevert("No revenue to release"); vault.release(payable(AUDIT));
        vm.expectRevert("Unknown recipient"); vault.release(payable(address(0xdead)));
    }
    function testOnlyVaultPortalCanCreate() public {
        vm.expectRevert("Only VaultPortal");
        factory.newVault(TOKEN, address(0), PROJECT, abi.encode(PROJECT, AUDIT, uint16(1000)));
    }
    function testFactoryRejectsBnbAndRobinhoodMainnet() public {
        vm.chainId(97);
        vm.expectRevert("Initial release supports Robinhood Testnet only");
        new RevenueSplitFactory();
        vm.chainId(4663);
        vm.expectRevert("Initial release supports Robinhood Testnet only");
        new RevenueSplitFactory();
    }
    function testRejectsBadConfiguration() public {
        vm.prank(PORTAL); vm.expectRevert("Treasury addresses must differ");
        factory.newVault(TOKEN, address(0), PROJECT, abi.encode(PROJECT, PROJECT, uint16(1000)));
        vm.prank(PORTAL); vm.expectRevert("Native ETH only");
        factory.newVault(TOKEN, address(1), PROJECT, abi.encode(PROJECT, AUDIT, uint16(1000)));
    }
    function testCannotReinitialize() public {
        vm.expectRevert("Initializable: contract is already initialized");
        vault.initialize(TOKEN, PROJECT, AUDIT, 1000);
    }
    function testGuardianOwnsBeaconAndCanUpgrade() public {
        UpgradeableBeacon beacon = UpgradeableBeacon(factory.beacon());
        assertEq(beacon.owner(), GUARDIAN);
        RevenueSplitVault replacement = new RevenueSplitVault();
        vm.expectRevert("Ownable: caller is not the owner"); beacon.upgradeTo(address(replacement));
        vm.prank(GUARDIAN); beacon.upgradeTo(address(replacement));
        assertEq(vault.taxToken(), TOKEN); assertEq(vault.auditBps(), 1000);
    }
    function testSchemasAndDescription() public view {
        VaultUISchema memory schema = vault.vaultUISchema();
        assertEq(schema.methods.length, 9); assertTrue(schema.methods[8].isWriteMethod);
        VaultDataSchema memory data = factory.vaultDataSchema();
        assertEq(data.fields.length, 3); assertGt(bytes(vault.description()).length, 0);
    }
    function testFuzzRevenueConservation(uint128 amount, uint16 share) public {
        share = uint16(bound(share, 0, 10000));
        vm.prank(PORTAL);
        RevenueSplitVault other = RevenueSplitVault(payable(factory.newVault(TOKEN, address(0), PROJECT, abi.encode(PROJECT, AUDIT, share))));
        vm.deal(address(this), amount);
        (bool ok,) = address(other).call{value: amount}(""); assertTrue(ok);
        assertEq(other.pending(PROJECT) + other.pending(AUDIT), amount);
    }
}
