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

## Installation

There are four ways to install, depending on your setup. Restart Claude Code after installing.

### Option 1: npx (standalone)

The quickest way if you just want the status bar. No plugin system needed.

```sh
npx claude-context-window@latest install
```

Copies the script to `~/.claude/statusline.js` and configures `~/.claude/settings.json`.

To remove:

```sh
npx claude-context-window@latest uninstall
```

### Option 2: Claude Code plugin (from this repo)

Register this repository as a plugin marketplace, then install the plugin:

```sh
claude plugin marketplace add https://github.com/matuscvengros/claude-context-window
claude plugin install claude-context-window
```

Once installed, activate the status line:

```
/claude-context-window:install
```

This points the status line directly at the plugin's cached copy of the script — nothing is copied to `~/.claude/`. To remove:

```
/claude-context-window:uninstall
```

### Option 3: Claude Code plugin (from a marketplace)

This plugin is also available through plugin marketplaces that include it (e.g. [claude-mako-plugins](https://github.com/matuscvengros/claude-mako-plugins)). If your marketplace already has it, just install and activate:

```sh
claude plugin install claude-context-window@<marketplace-name>
```

```
/claude-context-window:install
```

### Option 4: Shell script (Docker / CI)

For headless environments where there is no interactive Claude Code session. Requires `node` and `jq`.

```sh
./install.sh              # install
./install.sh uninstall    # remove
./install.sh --force      # overwrite existing statusLine from another tool
```

Copies the script to `~/.claude/statusline.js` and configures `~/.claude/settings.json`. The script resolves its own location, so it works from any working directory — just call it by its path.

## How it works

Claude Code's [status line](https://code.claude.com/docs/en/statusline) is a customizable bar at the bottom of the terminal. It runs a shell command after each assistant message, piping JSON session data to stdin. The command's stdout becomes the status bar content.

This tool provides that command: a Node.js script that reads the JSON, extracts context window usage, and outputs a color-coded progress bar with token counts.

**Colors indicate context usage:**

| Color  | Usage   | Meaning       |
|--------|---------|---------------|
| Green  | 0–50%   | Plenty of room |
| Yellow | 50–75%  | Getting there |
| Orange | 75–90%  | Caution       |
| Red    | 90–100% | Nearly full   |

The script has zero dependencies, runs in under 100ms, and handles edge cases gracefully (null fields before the first API call, missing data, auto-compaction resets).

## Ownership detection

All install methods embed a `# claude-context-window` marker comment in the settings.json command string. This allows safe uninstall — the tool only removes its own statusLine entry and will not touch configurations from other tools.

## Requirements

- Node.js >= 18
- [Claude Code](https://docs.anthropic.com/en/docs/claude-code)
- `jq` (only for `install.sh`)

## License

[MIT](LICENSE)
