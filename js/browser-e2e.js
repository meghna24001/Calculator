/**
 * Calyx - Browser End-to-End Test Suite (CDP)
 * Drives the real UI using Chrome DevTools Protocol without third-party dependencies.
 * Requires Node.js 22+ (for built-in WebSocket and fetch).
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const http = require('http');
const { spawn } = require('child_process');

if (typeof WebSocket === 'undefined') {
    console.error('Error: Global WebSocket is missing. Please run with Node.js 22+ which includes built-in WebSocket support.');
    process.exit(1);
}

function getChromePath() {
    if (process.env.CHROME_PATH) {
        return process.env.CHROME_PATH;
    }
    const platform = process.platform;
    if (platform === 'win32') {
        const candidates = [
            'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
            'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe',
            path.join(process.env.LOCALAPPDATA || '', 'Google\\Chrome\\Application\\chrome.exe')
        ];
        for (const c of candidates) {
            if (fs.existsSync(c)) return c;
        }
        return 'chrome.exe';
    } else if (platform === 'darwin') {
        return '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
    } else {
        return 'google-chrome';
    }
}

const DEBUG_PORT = process.env.REMOTE_DEBUGGING_PORT || '9222';
const APP_PORT = process.env.APP_PORT || '3000';
const CHROME_BIN = getChromePath();

let passedCount = 0;
function assert(name, condition, details = '') {
    if (condition) {
        console.log(`  ✓ ${name}`);
        passedCount++;
    } else {
        console.error(`  ✗ ${name} — ${details}`);
        throw new Error(`Assertion failed: ${name} (${details})`);
    }
}

async function run() {
    console.log('=== RUNNING BROWSER END-TO-END TESTS ===');
    console.log(`Using Chrome binary: ${CHROME_BIN}`);
    console.log(`Debug Port: ${DEBUG_PORT}`);

    // Ensure local server is running, or start a static server for this test
    let localServer = null;
    let isServerReady = false;
    try {
        const ping = await fetch(`http://127.0.0.1:${APP_PORT}/index.html`);
        if (ping.ok) isServerReady = true;
    } catch (e) {
        // Start minimal static server
        const root = path.resolve(__dirname, '..');
        localServer = http.createServer((req, res) => {
            let p = path.normalize(path.join(root, decodeURIComponent(req.url.split('?')[0])));
            if (p === root || p === path.join(root, path.sep)) p = path.join(root, 'index.html');
            fs.readFile(p, (err, data) => {
                if (err) { res.writeHead(404); res.end('Not Found'); return; }
                const ext = path.extname(p);
                const mimes = { '.html': 'text/html', '.css': 'text/css', '.js': 'application/javascript', '.json': 'application/json' };
                res.writeHead(200, { 'Content-Type': mimes[ext] || 'application/octet-stream' });
                res.end(data);
            });
        });
        await new Promise(r => localServer.listen(Number(APP_PORT), '127.0.0.1', r));
        isServerReady = true;
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-calyx-e2e-'));
    let browser = null;

    try {
        browser = spawn(CHROME_BIN, [
            '--headless=new',
            `--remote-debugging-port=${DEBUG_PORT}`,
            '--disable-gpu',
            '--no-first-run',
            `--user-data-dir=${tmpDir}`
        ], { stdio: 'ignore' });

        // Wait for debugging port
        let versionData = null;
        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise(r => setTimeout(r, 300));
            try {
                const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
                if (res.ok) {
                    versionData = await res.json();
                    break;
                }
            } catch (e) {}
        }
        if (!versionData) {
            throw new Error(`Failed to connect to Chrome remote debugging at port ${DEBUG_PORT}`);
        }
        console.log(`Connected to Chrome: ${versionData.Browser}`);

        // Open target page
        const newPageRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://127.0.0.1:${APP_PORT}/index.html`, { method: 'PUT' });
        const pageTarget = await newPageRes.json();
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();
        const uncaughtExceptions = [];

        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.method === 'Runtime.exceptionThrown') {
                const desc = data.params?.exceptionDetails?.exception?.description || data.params?.exceptionDetails?.text || 'Unknown error';
                console.error('  [Browser Uncaught Exception]', desc);
                uncaughtExceptions.push(desc);
            }
            if (data.id && pending.has(data.id)) {
                pending.get(data.id)(data.result);
                pending.delete(data.id);
            }
        };

        await new Promise(r => ws.onopen = r);

        function send(method, params = {}) {
            return new Promise((resolve) => {
                const reqId = id++;
                pending.set(reqId, resolve);
                ws.send(JSON.stringify({ id: reqId, method, params }));
            });
        }

        await send('Page.enable');
        await send('Runtime.enable');

        let pageLoaded = false;
        const origMsg = ws.onmessage;
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.method === 'Page.loadEventFired') pageLoaded = true;
            origMsg(event);
        };

        await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/index.html` });
        for (let i = 0; i < 50 && !pageLoaded; i++) {
            await new Promise(r => setTimeout(r, 100));
        }
        await new Promise(r => setTimeout(r, 600)); // allow DOM setup

        // 1. Assert Title is "Calyx"
        const titleRes = await send('Runtime.evaluate', { expression: 'document.title' });
        assert('Title is "Calyx"', titleRes.result?.value === 'Calyx', `got: "${titleRes.result?.value}"`);

        // Helper to click keypad button by text or aria-label
        async function clickKey(labelOrText) {
            const clickRes = await send('Runtime.evaluate', {
                expression: `
                    (function() {
                        const btns = Array.from(document.querySelectorAll('.calc-btn'));
                        const b = btns.find(btn => btn.textContent.trim() === ${JSON.stringify(labelOrText)} || btn.getAttribute('aria-label') === ${JSON.stringify(labelOrText)});
                        if (!b) return { success: false, error: 'Button not found: ' + ${JSON.stringify(labelOrText)} };
                        b.click();
                        return { success: true };
                    })()
                `,
                returnByValue: true
            });
            if (!clickRes.result?.value?.success) {
                throw new Error(clickRes.result?.value?.error || 'Click failed');
            }
        }

        async function getDisplayValues() {
            const res = await send('Runtime.evaluate', {
                expression: `
                    ({
                        display: document.getElementById('display')?.textContent || '',
                        expr: document.getElementById('expression-display')?.textContent || ''
                    })
                `,
                returnByValue: true
            });
            return res.result?.value;
        }

        // 2. Perform basic calculation: 200 + 10% - 5% =
        console.log('Testing basic calculation: 200 + 10% - 5% =');
        await clickKey('C'); // Clear first
        await clickKey('2');
        await clickKey('0');
        await clickKey('0');
        await clickKey('+');
        await clickKey('1');
        await clickKey('0');
        await clickKey('%');
        await clickKey('−');
        await clickKey('5');
        await clickKey('%');
        await clickKey('=');

        await new Promise(r => setTimeout(r, 200));
        const basicResult = await getDisplayValues();
        assert('Basic calculation 200+10%-5% shows 209', basicResult.display.trim() === '209', `got display: "${basicResult.display}"`);

        // 3. Switch to Scientific Mode via sidebar
        console.log('Testing mode switch to Scientific...');
        const modeSwitchRes = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const sciBtn = document.querySelector('.sidebar-nav-item[data-mode="scientific"]');
                    if (!sciBtn) return { success: false, error: 'Sidebar scientific mode button not found' };
                    sciBtn.click();
                    return {
                        success: true,
                        modeLabel: document.getElementById('display-mode-label')?.textContent || '',
                        btnCount: document.querySelectorAll('.calc-btn').length
                    };
                })()
            `,
            returnByValue: true
        });
        assert('Switched to scientific mode via sidebar', modeSwitchRes.result?.value?.success === true);

        // Ensure angle mode is DEG
        await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const angleBtn = document.querySelector('.calc-btn[aria-label*="Angle mode"]');
                    if (angleBtn && angleBtn.textContent.trim() !== 'DEG') {
                        angleBtn.click();
                    }
                })()
            `
        });

        // 4. Test Scientific Calculation: 2 cos(60) = in DEG -> 1
        console.log('Testing scientific calculation: 2 cos( 60 ) = in DEG');
        await clickKey('C');
        await clickKey('2');
        await clickKey('cos');
        await clickKey('6');
        await clickKey('0');
        await clickKey(')');
        await clickKey('=');

        await new Promise(r => setTimeout(r, 200));
        const sciResult = await getDisplayValues();
        assert('Scientific 2 cos(60) in DEG shows 1', sciResult.display.trim() === '1', `got display: "${sciResult.display}"`);

        // 5. Test Theme preset application
        console.log('Testing theme preset switching...');
        const themeRes = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const darkBtn = document.querySelector('.theme-preset-btn[data-theme-preset="dark"]');
                    if (!darkBtn) return { success: false, error: 'Dark theme button not found' };
                    darkBtn.click();
                    return {
                        success: true,
                        theme: document.documentElement.getAttribute('data-theme')
                    };
                })()
            `,
            returnByValue: true
        });
        assert('Theme preset switches to dark', themeRes.result?.value?.theme === 'dark', `got theme: "${themeRes.result?.value?.theme}"`);

        // 6. Assert no uncaught exceptions occurred during tests
        assert('No uncaught exceptions were logged', uncaughtExceptions.length === 0, `caught: ${uncaughtExceptions.join('; ')}`);

        console.log(`\nAll ${passedCount} browser E2E assertions passed successfully!`);
        ws.close();
    } finally {
        if (browser) {
            browser.kill();
        }
        if (localServer) {
            localServer.close();
        }
        try {
            fs.rmSync(tmpDir, { recursive: true, force: true });
        } catch (e) {}
    }
}

run().catch((err) => {
    console.error('\nE2E TEST FAILURE:', err);
    process.exit(1);
});
