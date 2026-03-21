const { describe, it } = require('node:test');
const assert = require('node:assert/strict');
const { render, buildBar, getColor, formatTokens } = require('../src/statusline.js');

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

describe('render', () => {
  it('renders normal state with all fields', () => {
    const data = {
      context_window: {
        used_percentage: 45,
        context_window_size: 1000000,
      },
      model: { display_name: 'Opus 4.6' },
    };
    const output = render(data);
    assert.ok(output.includes('Opus 4.6'));
    assert.ok(output.includes('45%'));
    assert.ok(output.includes('450K/1M tokens'));
    assert.ok(output.includes('\x1b[32m')); // green
  });

  it('renders yellow at 60%', () => {
    const data = {
      context_window: { used_percentage: 60, context_window_size: 200000 },
      model: { display_name: 'Sonnet 4.6' },
    };
    const output = render(data);
    assert.ok(output.includes('\x1b[33m')); // yellow
    assert.ok(output.includes('60%'));
    assert.ok(output.includes('120K/200K tokens'));
  });

  it('renders orange at 80%', () => {
    const data = {
      context_window: { used_percentage: 80, context_window_size: 200000 },
      model: { display_name: 'Haiku' },
    };
    const output = render(data);
    assert.ok(output.includes('\x1b[38;5;208m')); // orange
  });

  it('renders red at 95%', () => {
    const data = {
      context_window: { used_percentage: 95, context_window_size: 1000000 },
      model: { display_name: 'Opus 4.6' },
    };
    const output = render(data);
    assert.ok(output.includes('\x1b[31m')); // red
    assert.ok(output.includes('95%'));
    assert.ok(output.includes('950K/1M tokens'));
  });

  it('handles null used_percentage (early session)', () => {
    const data = {
      context_window: { used_percentage: null },
      model: { display_name: 'Opus 4.6' },
    };
    const output = render(data);
    assert.ok(output.includes('0%'));
    assert.ok(output.includes('waiting...'));
  });

  it('handles missing context_window', () => {
    const data = { model: { display_name: 'Opus 4.6' } };
    const output = render(data);
    assert.ok(output.includes('waiting...'));
  });

  it('handles completely empty input', () => {
    const output = render({});
    assert.ok(output.includes('Claude'));
    assert.ok(output.includes('waiting...'));
  });

  it('handles null input', () => {
    const output = render(null);
    assert.ok(output.includes('Claude'));
    assert.ok(output.includes('waiting...'));
  });

  it('defaults model name to Claude', () => {
    const data = {
      context_window: { used_percentage: 50, context_window_size: 200000 },
    };
    const output = render(data);
    assert.ok(output.includes('Claude'));
  });

  it('defaults context_window_size to 200000', () => {
    const data = {
      context_window: { used_percentage: 50 },
      model: { display_name: 'Test' },
    };
    const output = render(data);
    assert.ok(output.includes('100K/200K tokens'));
  });

  it('clamps percentage to 0-100', () => {
    const over = render({
      context_window: { used_percentage: 150, context_window_size: 100000 },
      model: { display_name: 'Test' },
    });
    assert.ok(over.includes('100%'));

    const under = render({
      context_window: { used_percentage: -10, context_window_size: 100000 },
      model: { display_name: 'Test' },
    });
    assert.ok(under.includes('0%'));
  });
});
