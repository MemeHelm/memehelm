import { spawn } from 'node:child_process';
import { resolve } from 'node:path';
const commands = [
  ['--env-file-if-exists=.env', 'server/index.mjs'],
  [resolve('node_modules/vite/bin/vite.js')],
];
const children = commands.map(args => spawn(process.execPath, args, { stdio: 'inherit' }));
let stopping = false;
function stop(code = 0) { if (stopping) return; stopping = true; for (const child of children) child.kill(); process.exitCode = code; }
process.on('SIGINT', () => stop());
process.on('SIGTERM', () => stop());
for (const child of children) child.on('exit', code => { if (!stopping) stop(code || 0); });
