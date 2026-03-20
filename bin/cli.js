#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');

const SCRIPT_NAME = 'claude-context-window.js';
const MARKER = 'claude-context-window';

const COLOR = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

function getClaudeDir() {
  return path.join(os.homedir(), '.claude');
}

function getHooksDir() {
  return path.join(getClaudeDir(), 'hooks');
}

function getScriptDest() {
  return path.join(getHooksDir(), SCRIPT_NAME);
}

function getSettingsPath() {
  return path.join(getClaudeDir(), 'settings.json');
}

function buildCommand(scriptPath) {
  const normalized = scriptPath.replace(/\\/g, '/');
  return `node "${normalized}"`;
}

function readSettings(settingsPath) {
  try {
    const raw = fs.readFileSync(settingsPath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function writeSettings(settingsPath, settings) {
  fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
}

function isOurs(settings) {
  return settings.statusLine
    && settings.statusLine.command
    && settings.statusLine.command.includes(MARKER);
}

function askOverwrite() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(`${COLOR.yellow}A statusLine is already configured. Overwrite? (y/N) ${COLOR.reset}`, (answer) => {
      rl.close();
      resolve(answer.trim().toLowerCase() === 'y');
    });
  });
}

async function install() {
  const scriptDest = getScriptDest();
  const settingsPath = getSettingsPath();

  const settings = readSettings(settingsPath);

  if (settings.statusLine && !isOurs(settings)) {
    const overwrite = await askOverwrite();
    if (!overwrite) {
      console.log(`${COLOR.dim}Installation cancelled.${COLOR.reset}`);
      process.exit(0);
    }
  }

  const hooksDir = getHooksDir();
  if (!fs.existsSync(hooksDir)) {
    fs.mkdirSync(hooksDir, { recursive: true });
  }

  const scriptSrc = path.join(__dirname, '..', 'src', 'statusline.js');
  fs.copyFileSync(scriptSrc, scriptDest);

  // Remove legacy script from pre-0.2.0 installs (was in ~/.claude/ instead of ~/.claude/hooks/)
  const legacyScript = path.join(getClaudeDir(), SCRIPT_NAME);
  if (fs.existsSync(legacyScript)) {
    fs.unlinkSync(legacyScript);
  }

  settings.statusLine = {
    type: 'command',
    command: buildCommand(scriptDest),
    padding: 0,
  };

  writeSettings(settingsPath, settings);

  console.log(`\n${COLOR.green}\u2713 claude-context-window installed${COLOR.reset}`);
  console.log(`  Script: ${scriptDest}`);
  console.log(`  Config: ${settingsPath}`);
  console.log(`\n${COLOR.dim}Restart Claude Code to activate.${COLOR.reset}\n`);
}

function cleanStatusLineFromFile(filePath) {
  if (!fs.existsSync(filePath)) return false;
  const settings = readSettings(filePath);
  if (isOurs(settings)) {
    delete settings.statusLine;
    writeSettings(filePath, settings);
    return true;
  }
  return false;
}

function uninstall() {
  const scriptDest = getScriptDest();
  const settingsPath = getSettingsPath();
  const claudeDir = getClaudeDir();

  let removedScript = false;
  let removedConfig = false;

  if (fs.existsSync(scriptDest)) {
    fs.unlinkSync(scriptDest);
    removedScript = true;
  }

  // Remove legacy script from pre-0.2.0 installs (was in ~/.claude/ instead of ~/.claude/hooks/)
  const legacyScript = path.join(claudeDir, SCRIPT_NAME);
  if (fs.existsSync(legacyScript)) {
    fs.unlinkSync(legacyScript);
    removedScript = true;
  }

  if (cleanStatusLineFromFile(settingsPath)) {
    removedConfig = true;
  }

  // Also clean statusLine from any settings backup files so that
  // restoring a backup doesn't resurrect a reference to the deleted script.
  try {
    const backupFiles = fs.readdirSync(claudeDir)
      .filter((f) => f.startsWith('settings.json.') && f.endsWith('-backup'));
    for (const backup of backupFiles) {
      cleanStatusLineFromFile(path.join(claudeDir, backup));
    }
  } catch {
    // Ignore errors reading backup files
  }

  if (!removedScript && !removedConfig) {
    console.log(`${COLOR.dim}Nothing to uninstall.${COLOR.reset}`);
    return;
  }

  console.log(`\n${COLOR.green}\u2713 claude-context-window uninstalled${COLOR.reset}`);
  if (removedScript) console.log(`  Removed: ${scriptDest}`);
  if (removedConfig) console.log(`  Cleaned: ${settingsPath}`);
  console.log(`\n${COLOR.dim}Restart Claude Code to deactivate.${COLOR.reset}\n`);
}

function printUsage() {
  console.log(`
${COLOR.green}claude-context-window${COLOR.reset} — Real-time context window usage bar for Claude Code

Usage:
  npx claude-context-window@latest ${COLOR.dim}install${COLOR.reset}     Install and configure
  npx claude-context-window@latest ${COLOR.dim}uninstall${COLOR.reset}   Remove and clean up
`);
}

const command = process.argv[2];

switch (command) {
  case 'install':
    install().catch((err) => {
      console.error(`${COLOR.red}Install failed: ${err.message}${COLOR.reset}`);
      process.exit(1);
    });
    break;
  case 'uninstall':
    uninstall();
    break;
  default:
    printUsage();
    break;
}
