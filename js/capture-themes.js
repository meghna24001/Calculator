/**
 * Calyx - Automated Theme & Mode Screenshot Capture Tool
 * Captures clean high-resolution screenshots of theme presets and layout modes.
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

async function capture() {
    console.log('=== RUNNING THEME CAPTURE ===');

    let localServer = null;
    try {
        const ping = await fetch(`http://127.0.0.1:${APP_PORT}/index.html`);
        if (!ping.ok) throw new Error('Not ready');
    } catch (e) {
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
    }

    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-calyx-themes-'));
    let browser = null;

    try {
        browser = spawn(CHROME_BIN, [
            '--headless=new',
            `--remote-debugging-port=${DEBUG_PORT}`,
            '--disable-gpu',
            '--no-first-run',
            `--user-data-dir=${tmpDir}`
        ], { stdio: 'ignore' });

        for (let attempt = 0; attempt < 20; attempt++) {
            await new Promise(r => setTimeout(r, 300));
            try {
                const res = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/version`);
                if (res.ok) break;
            } catch (e) {}
        }

        const newPageRes = await fetch(`http://127.0.0.1:${DEBUG_PORT}/json/new?http://127.0.0.1:${APP_PORT}/index.html`, { method: 'PUT' });
        const pageTarget = await newPageRes.json();
        const ws = new WebSocket(pageTarget.webSocketDebuggerUrl);

        let id = 1;
        const pending = new Map();
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
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
        await send('Page.navigate', { url: `http://127.0.0.1:${APP_PORT}/index.html` });
        await new Promise(r => setTimeout(r, 800));

        // 1. Basic Mode - Light Theme
        await send('Runtime.evaluate', {
            expression: `
                (function() {
                    document.querySelector('.theme-preset-btn[data-theme-preset="light"]')?.click();
                    const b = Array.from(document.querySelectorAll('.calc-btn'));
                    const click = (txt) => { const el = b.find(x => x.textContent.trim() === txt); if (el) el.click(); };
                    click('C'); click('2'); click('5'); click('0'); click('+'); click('1'); click('0'); click('%'); click('=');
                })()
            `
        });

        await send('Emulation.setDeviceMetricsOverride', { width: 1000, height: 750, deviceScaleFactor: 1, mobile: false });
        const shot1 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_basic_light.png', Buffer.from(shot1.data, 'base64'));
        console.log('Saved screenshot_basic_light.png');

        // 2. Scientific Mode - Dark Theme
        await send('Runtime.evaluate', {
            expression: `
                (function() {
                    document.querySelector('.sidebar-nav-item[data-mode="scientific"]')?.click();
                    document.querySelector('.theme-preset-btn[data-theme-preset="dark"]')?.click();
                })()
            `
        });
        await new Promise(r => setTimeout(r, 400));
        const shot2 = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_scientific_dark.png', Buffer.from(shot2.data, 'base64'));
        console.log('Saved screenshot_scientific_dark.png');

        console.log('Theme capture complete.');
        ws.close();
    } finally {
        if (browser) browser.kill();
        if (localServer) localServer.close();
        try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (e) {}
    }
}

capture().catch(err => {
    console.error('Capture error:', err);
    process.exit(1);
});
