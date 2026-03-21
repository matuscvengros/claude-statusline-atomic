---
name: claude-context-window:uninstall
description: Remove the context window status bar from Claude Code
allowed-tools: [Bash, Read, Edit, Write]
---

Remove the context window status bar from Claude Code settings.

## Steps

1. Read the user's settings file at `~/.claude/settings.json`.

2. Check if `statusLine.command` contains `claude-context-window`:
   - If yes, remove the `statusLine` key entirely from settings.json.
   - If no (belongs to another tool), tell the user there's nothing to uninstall.
   - If settings.json doesn't exist, tell the user there's nothing to uninstall.

3. Preserve all other existing keys in settings.json.

4. Report success and remind the user to restart Claude Code to deactivate.
