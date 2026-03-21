#!/usr/bin/env bash
set -euo pipefail

# install.sh — Configure claude-context-window status bar in Claude Code settings.
# Usage: ./install.sh [install|uninstall|--force]
#
# Copies src/statusline.js to ~/.claude/statusline.js and updates
# ~/.claude/settings.json with the statusLine command.

MARKER="claude-context-window"

# Resolve the directory this script lives in (handles symlinks)
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
STATUSLINE_SRC="${SCRIPT_DIR}/src/statusline.js"
CLAUDE_DIR="${HOME}/.claude"
STATUSLINE_DEST="${CLAUDE_DIR}/statusline.js"
SETTINGS_FILE="${CLAUDE_DIR}/settings.json"

GREEN='\033[32m'
DIM='\033[2m'
RESET='\033[0m'

ensure_deps() {
  if ! command -v node >/dev/null 2>&1; then
    echo "Error: node is required but not found in PATH" >&2
    exit 1
  fi
  if ! command -v jq >/dev/null 2>&1; then
    echo "Error: jq is required but not found in PATH" >&2
    exit 1
  fi
}

read_settings() {
  if [ -f "$SETTINGS_FILE" ]; then
    cat "$SETTINGS_FILE"
  else
    echo '{}'
  fi
}

build_command() {
  local dest_path="$1"
  # Normalize to forward slashes (Windows compat)
  local normalized
  normalized="$(echo "$dest_path" | sed 's|\\|/|g')"
  echo "node \"${normalized}\" # claude-context-window"
}

do_install() {
  ensure_deps

  if [ ! -f "$STATUSLINE_SRC" ]; then
    echo "Error: statusline.js not found at ${STATUSLINE_SRC}" >&2
    exit 1
  fi

  # Ensure ~/.claude/ exists
  mkdir -p "$CLAUDE_DIR"

  # Copy statusline.js to ~/.claude/statusline.js
  cp "$STATUSLINE_SRC" "$STATUSLINE_DEST"

  local settings
  settings="$(read_settings)"

  # Check for existing non-ours statusLine
  local existing_cmd
  existing_cmd="$(echo "$settings" | jq -r '.statusLine.command // ""')"
  if [ -n "$existing_cmd" ] && ! echo "$existing_cmd" | grep -q "$MARKER"; then
    echo "Warning: a statusLine is already configured by another tool." >&2
    echo "Existing command: ${existing_cmd}" >&2
    echo "Use --force to overwrite, or remove it manually from ${SETTINGS_FILE}" >&2
    # Clean up copied file
    rm -f "$STATUSLINE_DEST"
    exit 1
  fi

  # Update settings.json
  local cmd
  cmd="$(build_command "$STATUSLINE_DEST")"
  local new_settings
  new_settings="$(echo "$settings" | jq \
    --arg cmd "$cmd" \
    '.statusLine = {"type": "command", "command": $cmd, "padding": 0}')"

  echo "$new_settings" > "$SETTINGS_FILE"

  printf "\n${GREEN}✓ claude-context-window installed${RESET}\n"
  printf "  Script: %s\n" "$STATUSLINE_DEST"
  printf "  Config: %s\n" "$SETTINGS_FILE"
  printf "\n${DIM}Restart Claude Code to activate.${RESET}\n\n"
}

do_force_install() {
  ensure_deps

  if [ ! -f "$STATUSLINE_SRC" ]; then
    echo "Error: statusline.js not found at ${STATUSLINE_SRC}" >&2
    exit 1
  fi

  mkdir -p "$CLAUDE_DIR"
  cp "$STATUSLINE_SRC" "$STATUSLINE_DEST"

  local settings
  settings="$(read_settings)"
  local cmd
  cmd="$(build_command "$STATUSLINE_DEST")"
  local new_settings
  new_settings="$(echo "$settings" | jq \
    --arg cmd "$cmd" \
    '.statusLine = {"type": "command", "command": $cmd, "padding": 0}')"

  echo "$new_settings" > "$SETTINGS_FILE"

  printf "\n${GREEN}✓ claude-context-window installed (forced)${RESET}\n"
  printf "  Script: %s\n" "$STATUSLINE_DEST"
  printf "  Config: %s\n" "$SETTINGS_FILE"
  printf "\n${DIM}Restart Claude Code to activate.${RESET}\n\n"
}

uninstall() {
  ensure_deps

  local removed_script=false
  local removed_config=false

  if [ -f "$STATUSLINE_DEST" ]; then
    rm -f "$STATUSLINE_DEST"
    removed_script=true
  fi

  if [ -f "$SETTINGS_FILE" ]; then
    local settings
    settings="$(read_settings)"

    local existing_cmd
    existing_cmd="$(echo "$settings" | jq -r '.statusLine.command // ""')"

    if echo "$existing_cmd" | grep -q "$MARKER"; then
      local new_settings
      new_settings="$(echo "$settings" | jq 'del(.statusLine)')"
      echo "$new_settings" > "$SETTINGS_FILE"
      removed_config=true
    fi
  fi

  if [ "$removed_script" = false ] && [ "$removed_config" = false ]; then
    printf "${DIM}Nothing to uninstall.${RESET}\n"
    return
  fi

  printf "\n${GREEN}✓ claude-context-window uninstalled${RESET}\n"
  [ "$removed_script" = true ] && printf "  Removed: %s\n" "$STATUSLINE_DEST"
  [ "$removed_config" = true ] && printf "  Cleaned: %s\n" "$SETTINGS_FILE"
  printf "\n${DIM}Restart Claude Code to deactivate.${RESET}\n\n"
}

case "${1:-install}" in
  install)             do_install ;;
  --uninstall|uninstall) uninstall ;;
  --force)             do_force_install ;;
  *)
    echo "Usage: $0 [install|uninstall|--force]"
    exit 1
    ;;
esac
