---
name: claude-context-window:install
description: Install the context window status bar into Claude Code
allowed-tools: [Bash, Read, Edit, Write]
---

Configure the Claude Code status line to show real-time context window usage.

## Steps

1. Resolve the plugin root by running:
```bash
echo "$CLAUDE_PLUGIN_ROOT"
```

2. Read the user's settings file at `~/.claude/settings.json`. If it doesn't exist, treat it as `{}`.

3. Check if `statusLine` is already configured:
   - If `statusLine.command` contains `claude-context-window`, it's ours — overwrite it.
   - If `statusLine` exists but belongs to another tool, ask the user if they want to overwrite.
   - If no `statusLine` exists, proceed.

4. Set the `statusLine` field in settings.json to:
```json
{
  "statusLine": {
    "type": "command",
    "command": "node \"<PLUGIN_ROOT>/src/statusline.js\" # claude-context-window",
    "padding": 0
  }
}
```
Replace `<PLUGIN_ROOT>` with the actual resolved path from step 1. Use forward slashes in the path. The `# claude-context-window` comment is a marker used to identify this installation for safe uninstall.

5. Preserve all other existing keys in settings.json.

6. Report success and remind the user to restart Claude Code to activate.
