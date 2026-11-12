// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Test} from "forge-std/Test.sol";
import {MemeHelmLaunchFactory,MemeHelmToken} from "../src/MemeHelmLaunchFactory.sol";
import {RevenueSplitVault} from "../src/RevenueSplitVault.sol";
contract RevenueSplitVaultTest is Test {
    MemeHelmLaunchFactory factory;
    address project=address(0x1111);
    address reserve=address(0x2222);
    receive() external payable {}
    function setUp() public { vm.chainId(46630); factory=new MemeHelmLaunchFactory(); vm.deal(address(this),100 ether); }
    function config(uint16 bps) internal view returns(MemeHelmLaunchFactory.LaunchConfig memory) {
        return MemeHelmLaunchFactory.LaunchConfig("Orbit Club","ORBIT","Qm11111111111111111111111111111111111111111111",1e27,project,reserve,bps);
    }
    function testIndependentLaunch() public {
        bytes32 salt=bytes32(uint256(1));address predicted=factory.predictTokenAddress(address(this),config(1000),salt);
        (address token,address vault)=factory.createToken{value:1 ether}(config(1000),salt);
        assertEq(token,predicted);assertEq(MemeHelmToken(token).balanceOf(address(this)),1e27);assertEq(factory.vaults(token),vault);
        assertEq(RevenueSplitVault(payable(vault)).pending(project),0.9 ether);assertEq(RevenueSplitVault(payable(vault)).pending(reserve),0.1 ether);
    }
    function testMainnetDeploymentBlocked() public { vm.chainId(4663); vm.expectRevert("Robinhood Testnet only");new MemeHelmLaunchFactory(); }
    function testFuzzConservation(uint96 amount,uint16 share) public {
        share=uint16(bound(share,0,10000));amount=uint96(bound(amount,1,1 ether));
        (,address vault)=factory.createToken{value:amount}(config(share),bytes32(uint256(1)));
        RevenueSplitVault split=RevenueSplitVault(payable(vault));uint256 one=split.pending(project);uint256 two=split.pending(reserve);assertEq(one+two,amount);
        if(one>0)split.release(payable(project));if(two>0)split.release(payable(reserve));assertEq(vault.balance,0);assertEq(split.totalReceived(),amount);assertEq(split.totalReleased(),amount);
    }
}
