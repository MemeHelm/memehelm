import { parentPort, workerData } from 'node:worker_threads';
import { keccak256, concatHex, getContractAddress, numberToHex } from 'viem';
const initCodeHash = keccak256(concatHex(['0x3d602d80600a3d3981f3363d3d373d3d3d363d73',workerData.implementation,'0x5af43d82803e903d91602b57fd5bf3']));
for (let nonce = BigInt(workerData.seed), attempts = 0; attempts < 2000000; nonce++, attempts++) {
  const salt = numberToHex(nonce,{size:32});
  const predicted = getContractAddress({opcode:'CREATE2',from:workerData.portal,salt,bytecodeHash:initCodeHash});
  if(predicted.toLowerCase().endsWith('7777')) { parentPort.postMessage({salt,predicted,attempts:attempts+1}); break; }
  if(attempts === 1999999) throw new Error('Vanity search limit reached. Try again.');
}
