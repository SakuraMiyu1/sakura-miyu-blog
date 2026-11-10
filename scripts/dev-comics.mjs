import { spawn } from 'node:child_process';
const child = spawn(process.execPath, ['node_modules/astro/bin/astro.mjs', 'dev', ...process.argv.slice(2)], { stdio: 'inherit', env: { ...process.env, COMICS_DEMO: '1' } });
child.once('error', error => { console.error(error.message); process.exitCode = 1; });
child.once('exit', code => { process.exitCode = code ?? 1; });
