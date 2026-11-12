// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;
import {Test} from "forge-std/Test.sol";
import {RevenueSplitVault,IPonsFactory} from "../src/RevenueSplitVault.sol";
contract MockEscrow {
    mapping(address=>uint256) public balanceOf;
    function credit(address recipient) external payable { balanceOf[recipient]+=msg.value; }
    function claim() external { uint256 amount=balanceOf[msg.sender];balanceOf[msg.sender]=0;(bool ok,)=msg.sender.call{value:amount}("");require(ok); }
}
contract RevenueSplitVaultTest is Test {
    RevenueSplitVault vault;
    address project=address(0x1111);
    address reserve=address(0x2222);
    address escrow=0xd3AFEB2a57f70eF218Aa82451c51B2fb0416Ac9e;
    function setUp() public {vm.chainId(4663);vm.deal(address(this),100 ether);vault=new RevenueSplitVault(project,reserve,1500);MockEscrow mock=new MockEscrow();vm.etch(escrow,address(mock).code);}
    function testClaimsVaultEscrowThenPaysFixedRecipients() public {
        MockEscrow(escrow).credit{value:1 ether}(address(vault));
        vm.prank(address(0x9999));vault.claimFees();assertEq(vault.totalReceived(),1 ether);
        vault.release(payable(project));vault.release(payable(reserve));assertEq(project.balance,0.85 ether);assertEq(reserve.balance,0.15 ether);
    }
    function testRejectsOtherNetworksAndInvalidRecipients() public {
        vm.chainId(46630);vm.expectRevert("Robinhood mainnet only");new RevenueSplitVault(project,reserve,1000);
        vm.chainId(4663);vm.expectRevert("Treasury addresses must differ");new RevenueSplitVault(project,project,1000);
        vm.expectRevert("Unknown recipient");vault.release(payable(address(0x9999)));
    }
    function testRejectsSweepingUnrelatedLaunch() public {
        address factory=0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e;
        IPonsFactory.Launch memory launch;
        launch.exists=true;launch.creatorFeeRecipient=address(0x9999);
        vm.mockCall(factory,abi.encodeWithSelector(IPonsFactory.getLaunchedToken.selector,project),abi.encode(launch));
        vm.expectRevert("Unrelated launch");vault.sweepFees(project);
    }
    function testFuzzConservation(uint96 amount,uint16 share) public {
        share=uint16(bound(share,0,10000));amount=uint96(bound(amount,1,1 ether));
        RevenueSplitVault split=new RevenueSplitVault(project,reserve,share);
        (bool ok,)=address(split).call{value:amount}("");assertTrue(ok);
        uint256 one=split.pending(project);uint256 two=split.pending(reserve);assertEq(one+two,amount);
        if(one>0)split.release(payable(project));if(two>0)split.release(payable(reserve));assertEq(address(split).balance,0);assertEq(split.totalReceived(),amount);assertEq(split.totalReleased(),amount);
    }
}
