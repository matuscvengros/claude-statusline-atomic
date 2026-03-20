# Claude: Context Window

[![CI](https://github.com/matuscvengros/claude-context-window/actions/workflows/ci.yml/badge.svg)](https://github.com/matuscvengros/claude-context-window/actions/workflows/ci.yml)
[![npm version](https://img.shields.io/npm/v/claude-context-window)](https://www.npmjs.com/package/claude-context-window)
[![Downloads](https://img.shields.io/npm/dm/claude-context-window)](https://www.npmjs.com/package/claude-context-window)
[![License](https://img.shields.io/npm/l/claude-context-window)](https://github.com/matuscvengros/claude-context-window/blob/main/LICENSE)

Real-time context window usage bar for [Claude Code](https://docs.anthropic.com/en/docs/claude-code).

Shows a colored progress bar in the Claude Code status line that fills up as your context window is consumed.

```
Opus 4.6 │ 100K/1M tokens │ █░░░░░░░░░ 10%     ← green
Opus 4.6 │ 500K/1M tokens │ █████░░░░░ 50%     ← yellow
Opus 4.6 │ 780K/1M tokens │ ████████░░ 78%     ← orange
Opus 4.6 │ 900K/1M tokens │ █████████░ 90%     ← red
```

## Install

```sh
npx claude-context-window@latest install
```

Restart Claude Code to activate.

## Uninstall

```sh
npx claude-context-window@latest uninstall
```

## How it works

The installer copies a lightweight Node.js script to `~/.claude/hooks/claude-context-window.js` and configures the `statusLine` setting in `~/.claude/settings.json`. Claude Code periodically invokes the script, passing context window metrics via stdin. The script outputs a formatted, color-coded status line.

**Colors indicate context usage:**

| Color  | Usage     | Meaning         |
|--------|-----------|-----------------|
| Green  | 0–50%     | Plenty of room  |
| Yellow | 50–75%    | Getting there   |
| Orange | 75–90%    | Caution         |
| Red    | 90–100%   | Nearly full     |

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)

## License

[MIT](LICENSE)
