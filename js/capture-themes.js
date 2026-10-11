const fs = require('fs');

async function captureThemesAndModes() {
    const os = require('os');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-themes-'));

    const { spawn } = require('child_process');
    const browser = spawn("C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe", [
        '--headless=new',
        '--remote-debugging-port=9222',
        '--disable-gpu',
        '--no-first-run',
        '--user-data-dir=' + tmpDir
    ], { stdio: 'ignore' });

    let listRes = null;
    for (let attempt = 0; attempt < 10; attempt++) {
        await new Promise(r => setTimeout(r, 500));
        try {
            listRes = await fetch('http://127.0.0.1:9222/json/version');
            if (listRes.ok) break;
        } catch (e) {}
    }
    const versionData = await listRes.json();

    const newPageRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:3000/index.html?mode=basic', { method: 'PUT' });
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

    // Wait for load
    await new Promise(r => setTimeout(r, 1200));

    // 1. Basic Mode - Light Theme
    await send('Runtime.evaluate', {
        expression: `
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.setAttribute('data-accent', 'blue');
            const disp = document.getElementById('display');
            disp.textContent = '1,250 * (1 + 15%)';
            document.querySelector('.equal-btn').click();
        `
    });

    await send('Emulation.setDeviceMetricsOverride', {
        width: 1000,
        height: 750,
        deviceScaleFactor: 1,
        mobile: false
    });

    const shot1 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_basic_light.png', Buffer.from(shot1.data, 'base64'));
    console.log("Saved screenshot_basic_light.png");

    // 2. Scientific Mode - Purple Accent in Dark Theme
    await send('Runtime.evaluate', {
        expression: `
            document.getElementById('mode-btn-scientific').click();
            document.documentElement.setAttribute('data-theme', 'dark');
            document.documentElement.setAttribute('data-accent', 'purple');
            const disp = document.getElementById('display');
            disp.textContent = '5! / (2! * 3!)';
            document.querySelector('.equal-btn').click();
            document.getElementById('tab-btn-history').click();
        `
    });

    const shot2 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_scientific_purple_dark.png', Buffer.from(shot2.data, 'base64'));
    console.log("Saved screenshot_scientific_purple_dark.png");

    // 3. iPhone Basic Mode Light Theme
    await send('Runtime.evaluate', {
        expression: `
            document.getElementById('mode-btn-basic').click();
            document.documentElement.setAttribute('data-theme', 'light');
            document.documentElement.setAttribute('data-accent', 'emerald');
            const disp = document.getElementById('display');
            disp.textContent = '200 + 10% - 5%';
            document.querySelector('.equal-btn').click();
        `
    });

    await send('Emulation.setDeviceMetricsOverride', {
        width: 390,
        height: 844,
        deviceScaleFactor: 3,
        mobile: true
    });

    const shot3 = await send('Page.captureScreenshot', { format: 'png' });
    fs.writeFileSync('screenshot_iphone_basic_light.png', Buffer.from(shot3.data, 'base64'));
    console.log("Saved screenshot_iphone_basic_light.png");

    ws.close();
    browser.kill();
}

captureThemesAndModes().catch(console.error);
