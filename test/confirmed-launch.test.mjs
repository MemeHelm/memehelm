import test from 'node:test';
import assert from 'node:assert/strict';
import {encodeEventTopics,encodeAbiParameters,zeroAddress} from 'viem';
import {confirmedLaunchInput} from '../shared/confirmed-launch.mjs';
import {factoryAbi,PONS} from '../shared/pons.mjs';

const wallet='0x1111111111111111111111111111111111111111',token='0x2222222222222222222222222222222222222222',curve='0x3333333333333333333333333333333333333333',vault='0x4444444444444444444444444444444444444444',other='0x5555555555555555555555555555555555555555';
const hash='0x'+'a'.repeat(64);
function log({factory=PONS.factory.address,deployer=wallet}={}){
  return{address:factory,topics:encodeEventTopics({abi:factoryAbi,eventName:'TokenLaunched',args:{token,curve,deployer}}),data:encodeAbiParameters([{type:'address'},{type:'uint256'},{type:'uint256'}],[zeroAddress,0n,420000000000000000n])};
}
const prepared=settings=>({to:PONS.factory.address,settings:{name:'Recovered Coin',symbol:'RCV',description:'Keep the reviewed story.',creatorFeeRecipient:wallet,...settings}});

test('confirmed launch recovery preserves reviewed metadata and the selected vault for every fee mode',()=>{
  for(const mode of [null,'splitEnabled','holdersEnabled','socialEnabled']){
    const settings={splitEnabled:false,holdersEnabled:false,socialEnabled:false,vaultAddress:vault,...(mode?{[mode]:true,creatorFeeRecipient:vault}:{})};
    const input=confirmedLaunchInput(wallet,prepared(settings),{logs:[log()],transactionHash:hash},'draft-a');
    assert.equal(input.tokenAddress.toLowerCase(),token);assert.equal(input.launchHash,hash);assert.equal(input.draftId,'draft-a');assert.equal(input.name,'Recovered Coin');assert.equal(input.symbol,'RCV');assert.equal(input.description,'Keep the reviewed story.');
    assert.equal(input.vaultAddress,mode?vault:null);assert.equal(input.creatorFeeRecipient,mode?vault:wallet);if(mode)assert.equal(input[mode],true);
  }
});

test('confirmed launch recovery rejects unrelated deployers, factories and missing launch events',()=>{
  for(const logs of [[log({deployer:other})],[log({factory:other})],[],[log({factory:other,deployer:other})]]){
    assert.throws(()=>confirmedLaunchInput(wallet,prepared({}),{logs,transactionHash:hash}),error=>/No matching launch event/.test(error.message)&&error.message.includes(hash));
  }
  const input=confirmedLaunchInput(wallet,prepared({}),{logs:[log({deployer:other}),log({factory:other}),log()],transactionHash:hash});assert.equal(input.tokenAddress.toLowerCase(),token);assert.equal(input.draftId,undefined);
});
