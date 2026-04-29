#!/usr/bin/env node
'use strict';

const { execFileSync } = require('child_process');
const os = require('os');

const FILLED = '\u2588';
const EMPTY = '\u2591';
const BAR_WIDTH = 10;

const COLOR = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
  cyan: '\x1b[36m',
  dim: '\x1b[2m',
  reset: '\x1b[0m',
};

function getColor(usedPct) {
  if (usedPct >= 90) return COLOR.red;
  if (usedPct >= 75) return COLOR.orange;
  if (usedPct >= 50) return COLOR.yellow;
  return COLOR.green;
}

function formatTokens(count) {
  if (count >= 999950) {
    const val = Math.round(count / 100000) / 10;
    return val % 1 === 0 ? `${val}M` : `${val.toFixed(1)}M`;
  }
  if (count >= 1000) {
    const val = Math.round(count / 100) / 10;
    return val % 1 === 0 ? `${val}K` : `${val.toFixed(1)}K`;
  }
  return String(count);
}

function buildBar(usedPct) {
  const filled = Math.round((usedPct / 100) * BAR_WIDTH);
  const empty = BAR_WIDTH - filled;
  return FILLED.repeat(filled) + EMPTY.repeat(empty);
}

function getUsername() {
  try {
    return os.userInfo().username;
  } catch {
    return '';
  }
}

function getHostname() {
  try {
    return os.hostname();
  } catch {
    return '';
  }
}

const GIT_OPTS = { encoding: 'utf8', stdio: ['pipe', 'pipe', 'ignore'], timeout: 2000 };

function getGitBranch() {
  try {
    const branch = execFileSync('git', ['branch', '--show-current'], GIT_OPTS).trim();
    if (branch) return branch;
    // Detached HEAD — show abbreviated commit hash
    return execFileSync('git', ['rev-parse', '--short', 'HEAD'], GIT_OPTS).trim();
  } catch {
    return '';
  }
}

function getGitChanges() {
  try {
    const staged = execFileSync('git', ['diff', '--cached', '--numstat'], GIT_OPTS).trim();
    const modified = execFileSync('git', ['diff', '--numstat'], GIT_OPTS).trim();
    const stagedCount = staged ? staged.split('\n').filter(Boolean).length : 0;
    const modifiedCount = modified ? modified.split('\n').filter(Boolean).length : 0;
    return { staged: stagedCount, modified: modifiedCount };
  } catch {
    return { staged: 0, modified: 0 };
  }
}

function getGitRemoteUrl() {
  try {
    let remote = execFileSync('git', ['remote', 'get-url', 'origin'], GIT_OPTS).trim();
    // ssh://git@host:port/org/repo.git -> https://host/org/repo
    remote = remote.replace(/^ssh:\/\/git@([^/:]+)(?::\d+)?\/(.+?)(?:\.git)?$/, 'https://$1/$2');
    // git@host:org/repo.git -> https://host/org/repo
    remote = remote.replace(/^git@([^:]+):(.+?)(?:\.git)?$/, 'https://$1/$2');
    // strip trailing .git from https URLs
    remote = remote.replace(/\.git$/, '');
    if (!remote.startsWith('http')) return '';
    return remote;
  } catch {
    return '';
  }
}

function sanitizeForOSC(str) {
  return str.replace(/[\x00-\x1f\x7f]/g, '');
}

function getRepoLabel(remoteUrl) {
  try {
    const segments = new URL(remoteUrl).pathname.replace(/^\/|\/$/g, '').split('/').filter(Boolean);
    const repoName = segments[segments.length - 1] || '';
    const ownerName = segments.length >= 2 ? segments[segments.length - 2] : '';
    return ownerName ? `${ownerName}@${repoName}` : repoName;
  } catch {
    return '';
  }
}

function makeOSC8Link(url, text) {
  return `\x1b]8;;${sanitizeForOSC(url)}\x07${sanitizeForOSC(text)}\x1b]8;;\x07`;
}

function truncateDir(fullPath) {
  if (!fullPath) return '';
  const home = os.homedir();
  let parts = fullPath.split('/').filter(Boolean);
  let prefix = '/';
  if (home && (fullPath === home || fullPath.startsWith(home + '/'))) {
    const homeParts = home.split('/').filter(Boolean);
    parts = parts.slice(homeParts.length);
    prefix = '~/';
  }
  if (parts.length === 0) return prefix.replace(/\/$/, '');
  if (parts.length <= 3) return prefix + parts.join('/');
  return '..' + parts.slice(-3).join('/');
}

function renderLine1(data) {
  const username = getUsername();
  const hostname = getHostname();
  const projectDir = (data && data.workspace && data.workspace.current_dir) || '';
  const dirLabel = truncateDir(projectDir);

  let line = '';

  if (username) {
    const userLabel = hostname ? `${username}@${hostname}` : username;
    line += `[${COLOR.cyan}${userLabel}${COLOR.reset}]`;
  }
  if (dirLabel) line += (line ? ':' : '') + `[${dirLabel}]`;

  const remoteUrl = getGitRemoteUrl();
  const branch = getGitBranch();

  if (remoteUrl) {
    const repoLabel = getRepoLabel(remoteUrl);
    line += (line ? ':' : '') + `[${makeOSC8Link(remoteUrl, repoLabel)}]`;
  }

  if (branch) line += `/[${branch}]`;

  const changes = getGitChanges();
  if (changes.staged > 0 || changes.modified > 0) {
    let status = '';
    if (changes.staged > 0) status += `${COLOR.green}+${changes.staged}${COLOR.reset}`;
    if (changes.staged > 0 && changes.modified > 0) status += ' ';
    if (changes.modified > 0) status += `${COLOR.yellow}~${changes.modified}${COLOR.reset}`;
    line += ' ' + `[${status}]`;
  }

  return line;
}

function getEffortLabel(data) {
  const eff = (data && data.effort) || (data && data.model && data.model.effort);
  if (!eff) return '';
  if (typeof eff === 'string') return eff;
  if (typeof eff === 'object' && typeof eff.level === 'string') return eff.level;
  return '';
}

function getExactUsedTokens(ctx) {
  const usage = ctx && ctx.current_usage;
  if (!usage || typeof usage !== 'object') return null;
  const input = typeof usage.input_tokens === 'number' ? usage.input_tokens : 0;
  const cacheCreate = typeof usage.cache_creation_input_tokens === 'number' ? usage.cache_creation_input_tokens : 0;
  const cacheRead = typeof usage.cache_read_input_tokens === 'number' ? usage.cache_read_input_tokens : 0;
  const total = input + cacheCreate + cacheRead;
  return total > 0 ? total : null;
}

function renderLine2(data) {
  const ctx = data && data.context_window;
  const usedPctRaw = ctx && typeof ctx.used_percentage === 'number' ? ctx.used_percentage : null;
  const modelName = (data && data.model && data.model.display_name) || 'Claude';
  const effort = getEffortLabel(data);
  const modelLabel = effort ? `${modelName} (${effort})` : modelName;

  if (usedPctRaw === null) {
    const bar = EMPTY.repeat(BAR_WIDTH);
    return `${COLOR.dim}[${modelLabel}] [waiting...] ${bar} [0%]${COLOR.reset}`;
  }

  const clampedRaw = Math.max(0, Math.min(100, usedPctRaw));
  const clamped = Math.round(clampedRaw);
  const color = getColor(clamped);
  const bar = buildBar(clamped);

  const ctxSize = (ctx && ctx.context_window_size) || 200000;
  const exactTokens = getExactUsedTokens(ctx);
  const usedTokens = exactTokens !== null
    ? exactTokens
    : Math.round(ctxSize * clampedRaw / 100);

  return `${color}[${modelLabel}] [${formatTokens(usedTokens)}/${formatTokens(ctxSize)}] ${bar} [${clamped}%]${COLOR.reset}`;
}

function renderStatusLine(data) {
  return renderLine1(data) + '\n' + renderLine2(data);
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      process.stdout.write(renderStatusLine(data));
    } catch {
      process.stdout.write(renderStatusLine(null));
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = {
  renderLine1,
  renderLine2,
  renderStatusLine,
  buildBar,
  getColor,
  formatTokens,
  truncateDir,
  getUsername,
  getHostname,
  getGitBranch,
  getGitChanges,
  getGitRemoteUrl,
  getRepoLabel,
  makeOSC8Link,
  sanitizeForOSC,
};
