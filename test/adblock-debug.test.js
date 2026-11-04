const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { setImmediate: nextTick } = require('node:timers/promises');
const { FiltersEngine } = require('@ghostery/adblocker');

function fixture(t) {
    t.mock.method(console, 'info', () => {});
    const base = process.env.TMPDIR || path.join(os.homedir(), '.hermes', 'cache', 'scratch');
    const dir = fs.mkdtempSync(path.join(base, 'youtube-tv-debug-unit-'));
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    const blocker = FiltersEngine.empty();
    const session = { webRequest: { onErrorOccurred(handler) { this.handler = handler; } } };
    return { blocker, session, logPath: path.join(dir, 'debug.jsonl'), dir };
}
function logger() { return require('../adblock-debug').startAdblockDebug; }
function records(p) { return fs.readFileSync(p, 'utf8').trim().split('\n').map(JSON.parse); }

test('disabled diagnostics create no log and register no error observer', t => {
    const f = fixture(t);
    const stop = logger()(f.blocker, f.session, { logPath: f.logPath });
    stop();
    assert.equal(fs.existsSync(f.logPath), false);
    assert.equal(f.session.webRequest.handler, undefined);
});

test('synthetic unit events produce private counts, never URLs or video identifiers', async t => {
    const f = fixture(t);
    const stop = logger()(f.blocker, f.session, { enabled: true, logPath: f.logPath });
    t.after(stop);
    // These are synthetic logger fixtures, NOT evidence of real blocked traffic.
    const fixtureRequest = { url: 'https://example.invalid/watch?v=UNIT_FIXTURE_PRIVATE_ID' };
    f.blocker.emit('request-blocked', fixtureRequest, { filter: 'PRIVATE_FILTER_FIXTURE' });
    f.blocker.emit('request-blocked', fixtureRequest, {});
    f.blocker.emit('request-redirected', fixtureRequest, {});
    f.session.webRequest.handler({ ...fixtureRequest, error: 'net::ERR_BLOCKED_BY_CLIENT' });
    f.session.webRequest.handler({ ...fixtureRequest, error: 'net::ERR_ABORTED' });
    await nextTick();
    stop();
    const data = records(f.logPath), final = data.at(-1);
    assert.equal(final.event, 'session-end');
    assert.equal(final.blockedRequests, 2);
    assert.equal(final.redirectedRequests, 1);
    assert.equal(final.clientCancelledRequests, 1);
    assert.equal(new Set(data.map(r => r.session)).size, 1);
    const raw = fs.readFileSync(f.logPath, 'utf8');
    assert.doesNotMatch(raw, /example\.invalid|UNIT_FIXTURE_PRIVATE_ID|PRIVATE_FILTER_FIXTURE|https?:/);
    assert.equal(fs.statSync(f.logPath).mode & 0o777, 0o600);
    f.blocker.emit('request-blocked', fixtureRequest, {});
    await nextTick();
    stop();
    assert.equal(fs.readFileSync(f.logPath, 'utf8'), raw);
    assert.equal(f.session.webRequest.handler, null);
});

test('diagnostic records rotate with one backup', async t => {
    const f = fixture(t), limit = 250;
    const stop = logger()(f.blocker, f.session, { enabled: true, logPath: f.logPath, maxBytes: limit });
    t.after(stop);
    f.blocker.emit('request-blocked', { url: 'https://example.invalid/unit-fixture' }, {});
    await nextTick();
    stop();
    assert.equal(fs.existsSync(f.logPath + '.1'), true);
    assert.ok(fs.statSync(f.logPath).size <= limit);
    assert.ok(fs.statSync(f.logPath + '.1').size <= limit);
    assert.equal(records(f.logPath).at(-1).event, 'session-end');
});

test('an unavailable diagnostic path cannot stop normal blocking', t => {
    const f = fixture(t);
    const warn = t.mock.method(console, 'warn', () => {});
    fs.writeFileSync(path.join(f.dir, 'not-a-directory'), 'unit fixture');
    const stop = logger()(f.blocker, f.session, {
        enabled: true, logPath: path.join(f.dir, 'not-a-directory', 'debug.jsonl')
    });
    assert.doesNotThrow(stop);
    assert.equal(warn.mock.calls.length, 1);
    assert.equal(f.session.webRequest.handler, undefined);
});
