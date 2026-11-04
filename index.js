const { app, BrowserWindow, dialog, session } = require('electron');
const { ElectronBlocker } = require('@ghostery/adblocker-electron');
const { startAdblockDebug } = require('./adblock-debug');
const fs = require('node:fs');
const path = require('node:path');

const TV_URL = 'https://www.youtube.com/tv';
const TV_UA = 'Mozilla/5.0 (PS4; Leanback Shell) Gecko/20100101 Firefox/65.0 LeanbackShell/01.00.01.75 Sony PS4/ (PS4, , no, CH)';
let blockingReady = false;

app.setPath('userData', path.join(app.getPath('appData'), 'youtube-tv-client'));

function trustedNavigation(url) {
    try {
        const parsed = new URL(url);
        return parsed.protocol === 'https:' && (
            parsed.hostname === 'youtube.com' || parsed.hostname.endsWith('.youtube.com') ||
            ['accounts.google.com', 'consent.google.com'].includes(parsed.hostname)
        );
    } catch {
        return false;
    }
}

async function enableAdBlocking() {
    let blocker;
    try {
        // Refresh subscriptions each launch; a bundled copy covers download failures.
        blocker = await ElectronBlocker.fromPrebuiltAdsAndTracking((url, options = {}) =>
            fetch(url, { ...options, signal: AbortSignal.timeout(10000) }));
    } catch (error) {
        console.warn('Filter download unavailable; using bundled filters:', error.message);
        blocker = ElectronBlocker.deserialize(
            fs.readFileSync(path.join(__dirname, 'resources', 'adblock.bin')));
    }

    // Electron evaluates scripts in a shared scope. Keep uBlock helper declarations local.
    const getCosmeticsFilters = blocker.getCosmeticsFilters.bind(blocker);
    blocker.getCosmeticsFilters = (...args) => {
        const result = getCosmeticsFilters(...args);
        return { ...result, scripts: result.scripts.map(script => `(() => {\n${script}\n})();`) };
    };
    blocker.enableBlockingInSession(session.defaultSession);
    const directory = app.getPath('userData');
    const stopDebugLogging = startAdblockDebug(blocker, session.defaultSession, {
        enabled: process.argv.includes('--adblock-debug') ||
            fs.existsSync(path.join(directory, 'adblock-debug.enabled')),
        logPath: path.join(directory, 'adblock-debug.jsonl')
    });
    app.once('before-quit', stopDebugLogging);
    console.info('Ad blocking enabled');
}

function createWindow() {
    const win = new BrowserWindow({
        fullscreen: true,
        autoHideMenuBar: true,
        webPreferences: { nodeIntegration: false, contextIsolation: true, sandbox: true }
    });
    win.setMenu(null);
    win.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
    for (const event of ['will-navigate', 'will-redirect']) {
        win.webContents.on(event, (e, url) => {
            if (!trustedNavigation(url)) e.preventDefault();
        });
    }
    win.webContents.on('did-finish-load', () => win.webContents.setZoomFactor(0.5));
    win.loadURL(TV_URL, { userAgent: TV_UA }).catch(error => {
        if (!win.isDestroyed()) dialog.showErrorBox('YouTube TV', error.message);
    });
}

if (!app.requestSingleInstanceLock()) {
    app.quit();
} else {
    app.on('second-instance', () => {
        const win = BrowserWindow.getAllWindows()[0];
        if (win) { if (win.isMinimized()) win.restore(); win.focus(); }
    });
    app.whenReady().then(async () => {
        session.defaultSession.setPermissionRequestHandler((_contents, _permission, callback) => callback(false));
        await enableAdBlocking();
        blockingReady = true;
        createWindow();
    }).catch(error => {
        dialog.showErrorBox('YouTube TV could not start ad blocking', error.message);
        app.quit();
    });
    app.on('activate', () => {
        if (blockingReady && BrowserWindow.getAllWindows().length === 0) createWindow();
    });
}
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
