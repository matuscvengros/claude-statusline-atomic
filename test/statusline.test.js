const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const {
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
} = require('../src/statusline.js');

describe('formatTokens', () => {
  it('formats numbers below 1000', () => {
    assert.equal(formatTokens(0), '0');
    assert.equal(formatTokens(500), '500');
    assert.equal(formatTokens(999), '999');
  });

  it('formats thousands as K', () => {
    assert.equal(formatTokens(1000), '1K');
    assert.equal(formatTokens(50000), '50K');
    assert.equal(formatTokens(100000), '100K');
    assert.equal(formatTokens(999000), '999K');
  });

  it('formats fractional thousands', () => {
    assert.equal(formatTokens(1500), '1.5K');
    assert.equal(formatTokens(200500), '200.5K');
  });

  it('formats millions as M', () => {
    assert.equal(formatTokens(1000000), '1M');
    assert.equal(formatTokens(2000000), '2M');
  });

  it('formats fractional millions', () => {
    assert.equal(formatTokens(1500000), '1.5M');
  });

  it('handles boundary values without producing 1000.0K', () => {
    assert.equal(formatTokens(999999), '1M');
    assert.equal(formatTokens(999900), '999.9K');
    assert.equal(formatTokens(999949), '999.9K');
    assert.equal(formatTokens(999950), '1M');
  });

  it('formats large token counts', () => {
    assert.equal(formatTokens(5000000), '5M');
    assert.equal(formatTokens(10000000), '10M');
    assert.equal(formatTokens(1200000), '1.2M');
  });
});

describe('getColor', () => {
  it('returns green below 50%', () => {
    assert.equal(getColor(0), '\x1b[32m');
    assert.equal(getColor(49), '\x1b[32m');
  });

  it('returns yellow at 50-74%', () => {
    assert.equal(getColor(50), '\x1b[33m');
    assert.equal(getColor(74), '\x1b[33m');
  });

  it('returns orange at 75-89%', () => {
    assert.equal(getColor(75), '\x1b[38;5;208m');
    assert.equal(getColor(89), '\x1b[38;5;208m');
  });

  it('returns red at 90%+', () => {
    assert.equal(getColor(90), '\x1b[31m');
    assert.equal(getColor(100), '\x1b[31m');
  });

  it('returns correct color at exact thresholds', () => {
    // 49 is green, 50 is yellow
    assert.equal(getColor(49), '\x1b[32m');
    assert.equal(getColor(50), '\x1b[33m');
    // 74 is yellow, 75 is orange
    assert.equal(getColor(74), '\x1b[33m');
    assert.equal(getColor(75), '\x1b[38;5;208m');
    // 89 is orange, 90 is red
    assert.equal(getColor(89), '\x1b[38;5;208m');
    assert.equal(getColor(90), '\x1b[31m');
  });
});

describe('buildBar', () => {
  it('builds empty bar at 0%', () => {
    assert.equal(buildBar(0), '\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591');
  });

  it('builds half bar at 50%', () => {
    assert.equal(buildBar(50), '\u2588\u2588\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591');
  });

  it('builds full bar at 100%', () => {
    assert.equal(buildBar(100), '\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588\u2588');
  });

  it('rounds correctly at boundaries', () => {
    // 25% -> 2.5 -> rounds to 3
    assert.equal(buildBar(25), '\u2588\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591');
    // 15% -> 1.5 -> rounds to 2
    assert.equal(buildBar(15), '\u2588\u2588\u2591\u2591\u2591\u2591\u2591\u2591\u2591\u2591');
  });
});

describe('sanitizeForOSC', () => {
  it('strips control characters', () => {
    assert.equal(sanitizeForOSC('hello\x07world'), 'helloworld');
    assert.equal(sanitizeForOSC('test\x1b[31m'), 'test[31m');
    assert.equal(sanitizeForOSC('line\nbreak'), 'linebreak');
    assert.equal(sanitizeForOSC('tab\there'), 'tabhere');
  });

  it('preserves normal text', () => {
    assert.equal(sanitizeForOSC('https://github.com/user/repo'), 'https://github.com/user/repo');
  });

  it('handles empty string', () => {
    assert.equal(sanitizeForOSC(''), '');
  });
});

describe('truncateDir', () => {
  const os = require('os');
  const home = os.homedir();

  it('returns empty string for empty input', () => {
    assert.equal(truncateDir(''), '');
  });

  it('shows short absolute paths as-is', () => {
    assert.equal(truncateDir('/var/tmp'), '/var/tmp');
  });

  it('substitutes ~ for home directory', () => {
    assert.equal(truncateDir(home + '/project'), '~/project');
  });

  it('shows home dir paths with 3 or fewer parts', () => {
    assert.equal(truncateDir(home + '/a/b'), '~/a/b');
  });

  it('truncates to last 3 components with .. prefix', () => {
    assert.equal(truncateDir('/home/user/project/dir1/dir2/dir3/dir4'), '..dir2/dir3/dir4');
  });

  it('truncates home-relative deep paths', () => {
    const deep = home + '/a/b/c/d';
    assert.equal(truncateDir(deep), '..b/c/d');
  });

  it('handles root-level paths', () => {
    assert.equal(truncateDir('/tmp'), '/tmp');
  });

  it('handles exactly 3 components under home', () => {
    assert.equal(truncateDir(home + '/a/b/c'), '~/a/b/c');
  });

  it('truncates when more than 3 components under home', () => {
    const result = truncateDir(home + '/a/b/c/d');
    assert.equal(result, '..b/c/d');
  });

  it('returns ~ for home directory itself', () => {
    assert.equal(truncateDir(home), '~');
  });

  it('handles root path', () => {
    // Root has no meaningful directory name to display
    assert.equal(truncateDir('/'), '');
  });
});

describe('makeOSC8Link', () => {
  it('wraps text in OSC 8 escape sequences', () => {
    const link = makeOSC8Link('https://github.com/user/repo', 'repo');
    assert.equal(link, '\x1b]8;;https://github.com/user/repo\x07repo\x1b]8;;\x07');
  });

  it('sanitizes control characters in URL and text', () => {
    const link = makeOSC8Link('https://example.com/\x07evil', 'repo\x1bname');
    // BEL should be stripped from URL, ESC from text
    assert.ok(!link.includes('\x07evil'));
    assert.ok(link.includes('https://example.com/evil'));
    assert.ok(link.includes('reponame'));
  });
});

describe('getUsername', () => {
  it('returns a string', () => {
    const username = getUsername();
    assert.equal(typeof username, 'string');
  });
});

describe('getHostname', () => {
  it('returns a string', () => {
    const hostname = getHostname();
    assert.equal(typeof hostname, 'string');
  });

  it('returns a non-empty value', () => {
    const hostname = getHostname();
    assert.ok(hostname.length > 0);
  });
});

describe('getGitBranch', () => {
  it('returns a string', () => {
    const branch = getGitBranch();
    assert.equal(typeof branch, 'string');
  });

  it('returns a non-empty value in a git repo (branch or commit hash)', () => {
    // Works in both normal and detached HEAD (e.g. CI checkout)
    const branch = getGitBranch();
    assert.ok(branch.length > 0);
  });
});

describe('getGitChanges', () => {
  it('returns an object with staged and modified counts', () => {
    const changes = getGitChanges();
    assert.equal(typeof changes.staged, 'number');
    assert.equal(typeof changes.modified, 'number');
    assert.ok(changes.staged >= 0);
    assert.ok(changes.modified >= 0);
  });
});

describe('getGitRemoteUrl', () => {
  it('returns a string', () => {
    const url = getGitRemoteUrl();
    assert.equal(typeof url, 'string');
  });
});

describe('getRepoLabel', () => {
  it('extracts owner@repo from standard GitHub URL', () => {
    assert.equal(getRepoLabel('https://github.com/owner/repo'), 'owner@repo');
  });

  it('handles trailing slash', () => {
    assert.equal(getRepoLabel('https://github.com/owner/repo/'), 'owner@repo');
  });

  it('uses last two path segments for nested groups', () => {
    assert.equal(getRepoLabel('https://gitlab.com/group/subgroup/repo'), 'subgroup@repo');
  });

  it('returns just repo name for single-segment path', () => {
    assert.equal(getRepoLabel('https://git.company.com/repo'), 'repo');
  });

  it('does not include hostname as owner', () => {
    const label = getRepoLabel('https://git.company.com/repo');
    assert.ok(!label.includes('git.company.com'));
  });

  it('returns empty string for invalid URL', () => {
    assert.equal(getRepoLabel('not-a-url'), '');
  });

  it('returns empty string for empty string', () => {
    assert.equal(getRepoLabel(''), '');
  });
});

describe('renderLine2', () => {
  it('renders normal state with all fields', () => {
    const data = {
      context_window: {
        used_percentage: 45,
        context_window_size: 1000000,
      },
      model: { display_name: 'Opus 4.6' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[Opus 4.6]'));
    assert.ok(output.includes('[45%]'));
    assert.ok(output.includes('[450K/1M]'));
    assert.ok(output.includes('\x1b[32m')); // green
  });

  it('renders yellow at 60%', () => {
    const data = {
      context_window: { used_percentage: 60, context_window_size: 200000 },
      model: { display_name: 'Sonnet 4.6' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('\x1b[33m')); // yellow
    assert.ok(output.includes('[60%]'));
    assert.ok(output.includes('[120K/200K]'));
  });

  it('renders orange at 80%', () => {
    const data = {
      context_window: { used_percentage: 80, context_window_size: 200000 },
      model: { display_name: 'Haiku' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('\x1b[38;5;208m')); // orange
  });

  it('renders red at 95%', () => {
    const data = {
      context_window: { used_percentage: 95, context_window_size: 1000000 },
      model: { display_name: 'Opus 4.6' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('\x1b[31m')); // red
    assert.ok(output.includes('[95%]'));
    assert.ok(output.includes('[950K/1M]'));
  });

  it('handles null used_percentage (early session)', () => {
    const data = {
      context_window: { used_percentage: null },
      model: { display_name: 'Opus 4.6' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[0%]'));
    assert.ok(output.includes('[waiting...]'));
  });

  it('handles missing context_window', () => {
    const data = { model: { display_name: 'Opus 4.6' } };
    const output = renderLine2(data);
    assert.ok(output.includes('[waiting...]'));
  });

  it('handles completely empty input', () => {
    const output = renderLine2({});
    assert.ok(output.includes('[Claude]'));
    assert.ok(output.includes('[waiting...]'));
  });

  it('handles null input', () => {
    const output = renderLine2(null);
    assert.ok(output.includes('[Claude]'));
    assert.ok(output.includes('[waiting...]'));
  });

  it('defaults model name to Claude', () => {
    const data = {
      context_window: { used_percentage: 50, context_window_size: 200000 },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[Claude]'));
  });

  it('defaults context_window_size to 200000', () => {
    const data = {
      context_window: { used_percentage: 50 },
      model: { display_name: 'Test' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[100K/200K]'));
  });

  it('renders 0% as a number (not waiting state)', () => {
    const data = {
      context_window: { used_percentage: 0, context_window_size: 200000 },
      model: { display_name: 'Test' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[0%]'));
    assert.ok(output.includes('[0/200K]'));
    assert.ok(!output.includes('[waiting...]'));
  });

  it('clamps percentage to 0-100', () => {
    const over = renderLine2({
      context_window: { used_percentage: 150, context_window_size: 100000 },
      model: { display_name: 'Test' },
    });
    assert.ok(over.includes('[100%]'));

    const under = renderLine2({
      context_window: { used_percentage: -10, context_window_size: 100000 },
      model: { display_name: 'Test' },
    });
    assert.ok(under.includes('[0%]'));
  });

  it('includes effort when provided at top level', () => {
    const data = {
      context_window: { used_percentage: 50, context_window_size: 200000 },
      model: { display_name: 'Opus 4.6' },
      effort: 'Medium',
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[Opus 4.6 (Medium)]'));
  });

  it('includes effort when provided on model', () => {
    const data = {
      context_window: { used_percentage: 50, context_window_size: 200000 },
      model: { display_name: 'Opus 4.6', effort: 'High' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[Opus 4.6 (High)]'));
  });

  it('omits effort when not provided', () => {
    const data = {
      context_window: { used_percentage: 50, context_window_size: 200000 },
      model: { display_name: 'Opus 4.6' },
    };
    const output = renderLine2(data);
    assert.ok(output.includes('[Opus 4.6]'));
    assert.ok(!output.includes('('));
  });
});

describe('renderLine1', () => {
  it('includes username with hostname', () => {
    const output = renderLine1({});
    const username = getUsername();
    const hostname = getHostname();
    if (username) {
      const expected = hostname ? `${username}@${hostname}` : username;
      assert.ok(output.includes(`[${'\x1b[36m'}${expected}${'\x1b[0m'}]`));
    }
  });

  it('includes truncated project directory', () => {
    const data = {
      workspace: { current_dir: '/var/tmp' },
    };
    const output = renderLine1(data);
    assert.ok(output.includes('[/var/tmp]'));
  });

  it('handles missing workspace', () => {
    const output = renderLine1({});
    // Should not throw, username should still appear
    assert.equal(typeof output, 'string');
  });

  it('handles null data', () => {
    const output = renderLine1(null);
    assert.equal(typeof output, 'string');
  });

  it('includes git branch when in a repo', () => {
    const output = renderLine1({});
    const branch = getGitBranch();
    if (branch) {
      assert.ok(output.includes(`[${branch}]`));
    }
  });

  it('includes clickable repo link when remote exists', () => {
    const output = renderLine1({});
    const remoteUrl = getGitRemoteUrl();
    if (remoteUrl) {
      // Check for OSC 8 escape sequence
      assert.ok(output.includes('\x1b]8;;'));
      assert.ok(output.includes('\x07'));
    }
  });

  it('uses colon before repo and slash before branch', () => {
    const output = renderLine1({ workspace: { current_dir: '/var/proj' } });
    const remoteUrl = getGitRemoteUrl();
    const branch = getGitBranch();
    if (remoteUrl && branch) {
      // [proj]:[repo]/[branch]
      assert.ok(output.includes(']:['));
      assert.ok(output.includes(']/['));
    }
  });

  it('uses colon between username and directory', () => {
    const output = renderLine1({ workspace: { current_dir: '/var/proj' } });
    const username = getUsername();
    if (username) {
      assert.ok(output.includes(']:[/var/proj]'));
    }
  });
});

describe('renderStatusLine', () => {
  it('returns two lines separated by newline', () => {
    const data = {
      context_window: { used_percentage: 45, context_window_size: 1000000 },
      model: { display_name: 'Opus 4.6' },
      workspace: { current_dir: '/home/user/project' },
    };
    const output = renderStatusLine(data);
    const lines = output.split('\n');
    assert.equal(lines.length, 2);
  });

  it('line 1 contains project info, line 2 contains context bar', () => {
    const data = {
      context_window: { used_percentage: 45, context_window_size: 1000000 },
      model: { display_name: 'Opus 4.6' },
      workspace: { current_dir: '/home/user/my-app' },
    };
    const output = renderStatusLine(data);
    const [line1, line2] = output.split('\n');
    assert.ok(line1.includes('my-app'));
    assert.ok(line2.includes('[Opus 4.6]'));
    assert.ok(line2.includes('[45%]'));
  });

  it('handles null data gracefully', () => {
    const output = renderStatusLine(null);
    const lines = output.split('\n');
    assert.equal(lines.length, 2);
    assert.ok(lines[1].includes('[Claude]'));
    assert.ok(lines[1].includes('[waiting...]'));
  });
});
