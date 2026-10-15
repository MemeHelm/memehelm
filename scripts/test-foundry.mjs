import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import {resolve} from 'node:path';
const bundled=resolve('vendor/foundry-v1.8.5/forge.exe');
const executable=process.env.FORGE_BIN||(process.platform==='win32'&&existsSync(bundled)?bundled:'forge');
const fork=process.argv.includes('--fork');
const child=spawn(executable,['test',fork?'--match-contract':'--no-match-contract','FlapTestnetForkTest',...(fork?['--evm-version','cancun']:[]),'-vv'],{cwd:resolve('contracts'),stdio:'inherit',env:{...process.env,...(fork?{RUN_FLAP_FORK:'true'}:{})}});
child.on('error',()=>{console.error('Foundry is unavailable. Install it from https://getfoundry.sh or set FORGE_BIN to its executable.');process.exitCode=1;});
child.on('exit',code=>{process.exitCode=code??1;});
