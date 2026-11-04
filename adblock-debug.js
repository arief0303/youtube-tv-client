const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');

function startAdblockDebug(blocker, electronSession, {
    enabled = false, logPath, intervalMs = 10000, maxBytes = 256 * 1024
} = {}) {
    if (!enabled) return () => {};
    const session = randomUUID();
    const counts = { blockedRequests: 0, redirectedRequests: 0, clientCancelledRequests: 0 };
    let stopped = false, failed = false, dirty = false, firstActivity = true;

    function record(event) {
        if (failed) return;
        const line = JSON.stringify({ timestamp: new Date().toISOString(), session, event, ...counts }) + '\n';
        try {
            fs.mkdirSync(path.dirname(logPath), { recursive: true, mode: 0o700 });
            if (fs.existsSync(logPath)) {
                fs.chmodSync(logPath, 0o600);
                if (fs.statSync(logPath).size + Buffer.byteLength(line) > maxBytes) {
                    fs.renameSync(logPath, logPath + '.1');
                }
            }
            fs.appendFileSync(logPath, line, { mode: 0o600 });
            console.info('[adblock-dev]', line.trim());
            dirty = false;
        } catch {
            failed = true;
            console.warn('[adblock-dev] Diagnostic log unavailable; normal filtering is unchanged.');
        }
    }

    record('session-start');
    if (failed) return () => {};
    function increment(key) {
        if (stopped) return;
        counts[key]++;
        dirty = true;
        if (firstActivity) { firstActivity = false; record('counts'); }
    }
    const blocked = () => increment('blockedRequests');
    const redirected = () => increment('redirectedRequests');
    const cancelled = details => {
        if (details.error === 'net::ERR_BLOCKED_BY_CLIENT') increment('clientCancelledRequests');
    };
    blocker.on('request-blocked', blocked);
    blocker.on('request-redirected', redirected);
    // Ghostery owns onBeforeRequest/onHeadersReceived; this independent event observes actual cancellations.
    electronSession.webRequest.onErrorOccurred(cancelled);
    const timer = setInterval(() => { if (dirty) record('counts'); }, intervalMs);
    timer.unref();
    return () => {
        if (stopped) return;
        stopped = true;
        clearInterval(timer);
        blocker.unsubscribe('request-blocked', blocked);
        blocker.unsubscribe('request-redirected', redirected);
        electronSession.webRequest.onErrorOccurred(null);
        record('session-end');
    };
}

module.exports = { startAdblockDebug };
