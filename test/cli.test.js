const { describe, it, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const os = require('os');
const { execFileSync } = require('child_process');

const CLI_PATH = path.join(__dirname, '..', 'bin', 'cli.js');

function createTempHome() {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ccw-test-'));
  return tmpDir;
}

function runCli(args, env = {}) {
  try {
    const result = execFileSync(process.execPath, [CLI_PATH, ...args], {
      env: { ...process.env, HOME: env.HOME || os.homedir(), USERPROFILE: env.HOME || os.homedir(), ...env },
      encoding: 'utf8',
      timeout: 10000,
    });
    return { stdout: result, exitCode: 0 };
  } catch (err) {
    return { stdout: err.stdout || '', stderr: err.stderr || '', exitCode: err.status };
  }
}

describe('CLI', () => {
  let tmpHome;
  let claudeDir;
  let scriptPath;
  let settingsPath;

  beforeEach(() => {
    tmpHome = createTempHome();
    claudeDir = path.join(tmpHome, '.claude');
    scriptPath = path.join(claudeDir, 'statusline.js');
    settingsPath = path.join(claudeDir, 'settings.json');
  });

  afterEach(() => {
    fs.rmSync(tmpHome, { recursive: true, force: true });
  });

  describe('install', () => {
    it('creates .claude dir, script, and settings', () => {
      const { stdout } = runCli(['install'], { HOME: tmpHome });
      assert.ok(fs.existsSync(scriptPath), 'script should exist');
      assert.ok(fs.existsSync(settingsPath), 'settings should exist');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.statusLine.type, 'command');
      assert.ok(settings.statusLine.command.includes('claude-context-window'));
      assert.ok(stdout.includes('installed'));
    });

    it('preserves existing settings keys', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({ theme: 'dark', other: true }));

      runCli(['install'], { HOME: tmpHome });

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.theme, 'dark');
      assert.equal(settings.other, true);
      assert.ok(settings.statusLine);
    });

    it('overwrites own previous installation', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({
        statusLine: { type: 'command', command: 'node /old/claude-context-window.js' },
      }));

      runCli(['install'], { HOME: tmpHome });

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(settings.statusLine.command.includes('claude-context-window'));
    });

    it('copies a working statusline script', () => {
      runCli(['install'], { HOME: tmpHome });

      const input = JSON.stringify({
        context_window: { used_percentage: 50, context_window_size: 1000000 },
        model: { display_name: 'Opus 4.6' },
      });

      const result = execFileSync(process.execPath, [scriptPath], {
        input,
        encoding: 'utf8',
      });

      assert.ok(result.includes('50%'));
      assert.ok(result.includes('Opus 4.6'));
    });

    it('uses forward slashes in command path', () => {
      runCli(['install'], { HOME: tmpHome });
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(!settings.statusLine.command.includes('\\'), 'command should not contain backslashes');
    });

    it('quotes the script path in command', () => {
      runCli(['install'], { HOME: tmpHome });
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(settings.statusLine.command.startsWith('node "'), 'command should quote the path');
      assert.ok(settings.statusLine.command.includes('" # claude-context-window'), 'command should have marker comment');
    });

    it('refuses to overwrite another tool statusLine', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({
        statusLine: { type: 'command', command: 'node /other/tool.js' },
      }));

      const { exitCode } = runCli(['install'], { HOME: tmpHome });
      assert.equal(exitCode, 1);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.statusLine.command, 'node /other/tool.js', 'should not overwrite');
    });

    it('is idempotent when run twice', () => {
      runCli(['install'], { HOME: tmpHome });
      const first = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

      runCli(['install'], { HOME: tmpHome });
      const second = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

      assert.deepEqual(first, second);
    });

    it('sets padding to 0', () => {
      runCli(['install'], { HOME: tmpHome });
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.statusLine.padding, 0);
    });

    it('handles corrupt settings.json gracefully', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, 'not valid json{{{');

      const { exitCode } = runCli(['install'], { HOME: tmpHome });
      assert.equal(exitCode, 0);

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(settings.statusLine, 'should install despite corrupt existing settings');
    });

});

  describe('uninstall', () => {
    it('removes script and settings entry', () => {
      runCli(['install'], { HOME: tmpHome });
      assert.ok(fs.existsSync(scriptPath));

      const { stdout } = runCli(['uninstall'], { HOME: tmpHome });
      assert.ok(!fs.existsSync(scriptPath), 'script should be removed');
      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.statusLine, undefined);
      assert.ok(stdout.includes('uninstalled'));
    });

    it('preserves other settings on uninstall', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({
        theme: 'dark',
        statusLine: { type: 'command', command: 'node /path/claude-context-window.js' },
      }));

      runCli(['uninstall'], { HOME: tmpHome });

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.equal(settings.theme, 'dark');
      assert.equal(settings.statusLine, undefined);
    });

    it('does not remove statusLine from another tool', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, JSON.stringify({
        statusLine: { type: 'command', command: 'node /other/some-tool.js' },
      }));

      runCli(['uninstall'], { HOME: tmpHome });

      const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));
      assert.ok(settings.statusLine, 'should preserve other tool statusLine');
    });

    it('handles missing settings.json gracefully', () => {
      const { stdout } = runCli(['uninstall'], { HOME: tmpHome });
      assert.ok(stdout.includes('Nothing to uninstall'));
    });

    it('handles missing .claude dir gracefully', () => {
      const emptyHome = createTempHome();
      const { stdout } = runCli(['uninstall'], { HOME: emptyHome });
      assert.ok(stdout.includes('Nothing to uninstall'));
      fs.rmSync(emptyHome, { recursive: true, force: true });
    });

    it('removes legacy hooks location', () => {
      const hooksDir = path.join(claudeDir, 'hooks');
      fs.mkdirSync(hooksDir, { recursive: true });

      const legacyPath = path.join(hooksDir, 'claude-context-window.js');
      fs.writeFileSync(legacyPath, '// legacy');

      // Also need a settings entry so uninstall reports success
      fs.writeFileSync(settingsPath, JSON.stringify({
        statusLine: { type: 'command', command: 'node /old/claude-context-window.js' },
      }));

      const { stdout } = runCli(['uninstall'], { HOME: tmpHome });
      assert.ok(!fs.existsSync(legacyPath), 'legacy script should be removed');
      assert.ok(stdout.includes('uninstalled'));
    });

    it('cleans statusLine from backup files', () => {
      fs.mkdirSync(claudeDir, { recursive: true });

      // Create main settings and a backup, both with our statusLine
      const ourSettings = {
        theme: 'dark',
        statusLine: { type: 'command', command: 'node /path/claude-context-window.js' },
      };
      fs.writeFileSync(settingsPath, JSON.stringify(ourSettings));

      const backupPath = path.join(claudeDir, 'settings.json.20260321-backup');
      fs.writeFileSync(backupPath, JSON.stringify(ourSettings));

      runCli(['uninstall'], { HOME: tmpHome });

      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.equal(backup.statusLine, undefined, 'backup should have statusLine removed');
      assert.equal(backup.theme, 'dark', 'backup should preserve other keys');
    });

    it('does not clean backup files belonging to another tool', () => {
      fs.mkdirSync(claudeDir, { recursive: true });

      // Install ours so there's something to uninstall
      runCli(['install'], { HOME: tmpHome });

      // Create a backup with another tool's statusLine
      const backupPath = path.join(claudeDir, 'settings.json.20260321-backup');
      fs.writeFileSync(backupPath, JSON.stringify({
        statusLine: { type: 'command', command: 'node /other/tool.js' },
      }));

      runCli(['uninstall'], { HOME: tmpHome });

      const backup = JSON.parse(fs.readFileSync(backupPath, 'utf8'));
      assert.ok(backup.statusLine, 'should preserve other tool statusLine in backup');
    });

    it('handles corrupt settings.json gracefully', () => {
      fs.mkdirSync(claudeDir, { recursive: true });
      fs.writeFileSync(settingsPath, 'garbage{{{');

      const { stdout } = runCli(['uninstall'], { HOME: tmpHome });
      assert.ok(stdout.includes('Nothing to uninstall'));
    });

});

  describe('help', () => {
    it('prints usage with no arguments', () => {
      const { stdout } = runCli([], { HOME: tmpHome });
      assert.ok(stdout.includes('install'));
      assert.ok(stdout.includes('uninstall'));
    });

    it('prints usage with unknown command', () => {
      const { stdout } = runCli(['foo'], { HOME: tmpHome });
      assert.ok(stdout.includes('install'));
    });
  });
});
