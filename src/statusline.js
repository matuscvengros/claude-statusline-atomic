#!/usr/bin/env node
'use strict';

const FILLED = '\u2588';
const EMPTY = '\u2591';
const SEP = ' \u2502 ';
const BAR_WIDTH = 10;

const COLOR = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  orange: '\x1b[38;5;208m',
  red: '\x1b[31m',
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

function render(data) {
  const ctx = data && data.context_window;
  const usedPct = ctx && typeof ctx.used_percentage === 'number' ? Math.round(ctx.used_percentage) : null;
  const modelName = (data && data.model && data.model.display_name) || 'Claude';

  if (usedPct === null) {
    const bar = EMPTY.repeat(BAR_WIDTH);
    return `${COLOR.dim}${modelName}${SEP}waiting...${SEP}${bar} 0%${COLOR.reset}`;
  }

  const clamped = Math.max(0, Math.min(100, usedPct));
  const color = getColor(clamped);
  const bar = buildBar(clamped);

  const ctxSize = (ctx && ctx.context_window_size) || 200000;
  const usedTokens = Math.round(ctxSize * clamped / 100);

  return `${color}${modelName}${SEP}${formatTokens(usedTokens)}/${formatTokens(ctxSize)} tokens${SEP}${bar} ${clamped}%${COLOR.reset}`;
}

function main() {
  let input = '';
  process.stdin.setEncoding('utf8');
  process.stdin.on('data', (chunk) => { input += chunk; });
  process.stdin.on('end', () => {
    try {
      const data = JSON.parse(input);
      process.stdout.write(render(data));
    } catch {
      process.stdout.write(render(null));
    }
  });
}

if (require.main === module) {
  main();
}

module.exports = { render, buildBar, getColor, formatTokens };
