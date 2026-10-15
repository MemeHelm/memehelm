import solc from 'solc';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
export function compileContracts(extraSources = {}) {
  const sources = {
    'src/RevenueSplitVault.sol': { content: readFileSync(resolve(root, 'contracts/src/RevenueSplitVault.sol'), 'utf8') },
    'src/flap/IVaultPortal.sol': { content: readFileSync(resolve(root, 'contracts/src/flap/IVaultPortal.sol'), 'utf8') },
    'src/flap/IPortal.sol': { content: readFileSync(resolve(root, 'contracts/src/flap/IPortal.sol'), 'utf8') },
    ...extraSources,
  };
  const output = JSON.parse(solc.compile(JSON.stringify({
    language: 'Solidity', sources,
    settings: { optimizer: { enabled: true, runs: 200 }, evmVersion: 'shanghai', outputSelection: { '*': { '*': ['abi', 'evm.bytecode.object', 'evm.deployedBytecode.object'] } } },
  }), { import(path) {
    let file = path.startsWith('@openzeppelin-contracts-upgradeable/')
      ? resolve(root, 'contracts/lib/openzeppelin-contracts-upgradeable/contracts', path.slice('@openzeppelin-contracts-upgradeable/'.length))
      : path.startsWith('@openzeppelin-upgradeable/')
      ? resolve(root, 'contracts/lib/openzeppelin-contracts-upgradeable/contracts', path.slice('@openzeppelin-upgradeable/'.length))
      : path.startsWith('@openzeppelin/')
        ? resolve(root, 'contracts/lib/openzeppelin-contracts/contracts', path.slice('@openzeppelin/'.length))
        : resolve(root, 'contracts', path);
    return existsSync(file) ? { contents: readFileSync(file, 'utf8') } : { error: `Missing Solidity import: ${path}` };
  } }));
  const errors = output.errors?.filter(e => e.severity === 'error') ?? [];
  if (errors.length) throw new Error(errors.map(e => e.formattedMessage).join('\n'));
  return output.contracts;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const contracts = compileContracts();
  mkdirSync(resolve(root, 'artifacts'), { recursive: true });
  for (const [file, content] of Object.entries(contracts)) for (const [name, contract] of Object.entries(content)) {
    if (!['RevenueSplitFactory', 'RevenueSplitVault', 'IVaultPortal', 'IPortal'].includes(name)) continue;
    const artifact = { contractName: name, sourceName: file, compiler: solc.version(), abi: contract.abi, bytecode: `0x${contract.evm.bytecode.object}`, deployedBytecode: `0x${contract.evm.deployedBytecode.object}` };
    writeFileSync(resolve(root, `artifacts/${name}.json`), JSON.stringify(artifact, null, 2));
    console.log(`Compiled ${name}: ${contract.evm.bytecode.object.length / 2} bytes`);
  }
}
