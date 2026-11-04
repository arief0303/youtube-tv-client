const { FiltersEngine } = require('@ghostery/adblocker');
const fs = require('node:fs/promises');
const path = require('node:path');

(async () => {
    const engine = await FiltersEngine.fromPrebuiltAdsAndTracking((url, options = {}) =>
        fetch(url, { ...options, signal: AbortSignal.timeout(30000) }));
    const directory = path.join(__dirname, '..', 'resources');
    await fs.mkdir(directory, { recursive: true });
    const data = engine.serialize();
    await fs.writeFile(path.join(directory, 'adblock.bin'), data);
    console.info(`Bundled ${data.length} bytes of ad-blocking filters and resources`);
})().catch(error => { console.error(error); process.exitCode = 1; });
