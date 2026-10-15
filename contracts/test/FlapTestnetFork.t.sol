// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Test} from "forge-std/Test.sol";
import {Clones} from "@openzeppelin/proxy/Clones.sol";
import {IERC20} from "@openzeppelin/token/ERC20/IERC20.sol";
import {RevenueSplitFactory, RevenueSplitVault} from "../src/RevenueSplitVault.sol";
import {IVaultPortal, IVaultPortalTypes} from "../src/flap/IVaultPortal.sol";
import {IPortalTypes, IPortalCommonTypes} from "../src/flap/IPortal.sol";
import {IFlapTaxTokenV3} from "../src/flap/IFlapTaxTokenV3.sol";
import {ITaxProcessor} from "../src/flap/ITaxProcessor.sol";

/// @notice Read-only public-chain fork simulation. Never broadcasts a transaction.
contract FlapTestnetForkTest is Test {
    function testLaunchWithLiveTestnetContracts() public {
        if (!vm.envOr("RUN_FLAP_FORK", false)) { vm.skip(true); return; }
        vm.createSelectFork(vm.envOr("BSC_TESTNET_RPC_URL", string("https://bsc-testnet-rpc.publicnode.com")));
        assertEq(block.chainid, 97);
        address portal = 0x5bEacaF7ABCbB3aB280e80D007FD31fcE26510e9;
        IVaultPortal vaultPortal = IVaultPortal(0x027e3704fC5C16522e9393d04C60A3ac5c0d775f);
        address implementation = 0xE6Ff967a887084c16D0fD71548CF709542cc1557;
        RevenueSplitFactory factory = new RevenueSplitFactory();
        bytes32 salt;
        for (uint256 nonce = 1; nonce < 2000000; nonce++) {
            address predicted = Clones.predictDeterministicAddress(implementation, bytes32(nonce), portal);
            if (uint16(uint160(predicted)) == 0x7777 && predicted.code.length == 0) { salt = bytes32(nonce); break; }
        }
        require(salt != bytes32(0), "No vanity salt found");
        IVaultPortalTypes.NewTokenV6WithVaultParams memory params;
        params.name = "Copilot Fork Test";
        params.symbol = "CFT";
        params.meta = "QmYwAPJzv5CZsnAzt8auVZRnGi2C1xYNwkGMxmMLNRSz6L";
        params.salt = salt;
        params.dexThresh = IPortalCommonTypes.DexThreshType.FOUR_FIFTHS;
        params.migratorType = IPortalTypes.MigratorType.V2_MIGRATOR;
        params.buyTaxRate = 300;
        params.sellTaxRate = 300;
        params.taxDuration = 365 days;
        params.antiFarmerDuration = 3 days;
        params.mktBps = 10000;
        params.tokenVersion = IPortalTypes.TokenVersion.TOKEN_TAXED_V3;
        params.vaultFactory = address(factory);
        params.vaultData = abi.encode(address(0x1234), address(0x5678), uint16(1000));
        params.quoteAmt = 0.01 ether;
        vm.deal(address(this), 10 ether);
        address token = vaultPortal.newTokenV6WithVault{value: params.quoteAmt, gas: 10000000}(params);
        assertGt(token.code.length, 0);
        assertGt(IERC20(token).balanceOf(address(this)), 0);
        IVaultPortalTypes.VaultInfo memory info = vaultPortal.getVault(token);
        assertGt(info.vault.code.length, 0);
        RevenueSplitVault vault = RevenueSplitVault(payable(info.vault));
        assertEq(vault.taxToken(), token);
        assertEq(vault.projectTreasury(), address(0x1234));
        assertEq(vault.auditTreasury(), address(0x5678));
        assertEq(vault.auditBps(), 1000);
        // Exercise the actual deployed protocol's tax dispatch and both fixed payouts.
        ITaxProcessor(IFlapTaxTokenV3(token).taxProcessor()).dispatch{gas: 1000000}();
        uint256 received = vault.totalReceived();
        assertGt(received, 0);
        uint256 auditPending = vault.pending(address(0x5678));
        uint256 projectPending = vault.pending(address(0x1234));
        assertEq(projectPending + auditPending, received);
        uint256 projectBefore = address(0x1234).balance;
        uint256 auditBefore = address(0x5678).balance;
        vault.release(payable(address(0x1234)));
        vault.release(payable(address(0x5678)));
        assertEq(address(0x1234).balance, projectBefore + projectPending);
        assertEq(address(0x5678).balance, auditBefore + auditPending);
        assertEq(address(vault).balance, 0);
    }
    receive() external payable {}
}
