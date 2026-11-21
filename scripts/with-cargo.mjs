#!/usr/bin/env node
/**
 * Run a command with ~/.cargo/bin prepended to PATH.
 *
 * rustup installs cargo there, but non-interactive shells (IDE tasks, some
 * terminals) do not source ~/.cargo/env, so wasm-pack and the Tauri CLI cannot
 * find cargo. Every npm entry point goes through this helper.
 */
import { spawn } from 'node:child_process';
import { homedir } from 'node:os';
import { delimiter, join } from 'node:path';

const cargoBin = join(homedir(), '.cargo', 'bin');
const env = { ...process.env };
const pathValue = env.PATH || env.Path || '';
env.PATH = pathValue ? `${cargoBin}${delimiter}${pathValue}` : cargoBin;
if (process.platform === 'win32') {
  env.Path = env.PATH;
}

const [command, ...args] = process.argv.slice(2);
if (!command) {
  console.error('usage: node scripts/with-cargo.mjs <command> [args...]');
  process.exit(2);
}

const child = spawn(command, args, {
  stdio: 'inherit',
  env,
  shell: process.platform === 'win32',
});

child.on('error', (error) => {
  console.error(error.message);
  process.exit(1);
});

child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});
