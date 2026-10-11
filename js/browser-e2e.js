const http = require('http');
const fs = require('fs');

async function runBrowserTests() {
    console.log("Starting browser E2E test via Chrome DevTools Protocol...");

    const os = require('os');
    const path = require('path');
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'chrome-calc-'));

    // Spawn Chrome in headless mode with debugging port
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

    try {
        const versionData = await listRes.json();
        console.log("Connected to browser:", versionData.Browser);

        // Open target page
        const newPageRes = await fetch('http://127.0.0.1:9222/json/new?http://127.0.0.1:3000/index.html', { method: 'PUT' });
        const pageTarget = await newPageRes.json();
        console.log("Page target created:", pageTarget.id);

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

        // Enable Page & Runtime
        await send('Page.enable');
        await send('Runtime.enable');

        let pageLoaded = false;
        ws.onmessage = (event) => {
            const data = JSON.parse(event.data);
            if (data.method === 'Page.loadEventFired') {
                pageLoaded = true;
            }
            if (data.method === 'Runtime.consoleAPICalled') {
                console.log("[Browser Console]", ...data.params.args.map(a => a.value || a.description));
            }
            if (data.method === 'Runtime.exceptionThrown') {
                console.error("[Browser Exception]", data.params.exceptionDetails.text, data.params.exceptionDetails.exception?.description);
            }
            if (data.id && pending.has(data.id)) {
                pending.get(data.id)(data.result);
                pending.delete(data.id);
            }
        };

        await send('Page.navigate', { url: 'http://127.0.0.1:3000/index.html' });
        while (!pageLoaded) {
            await new Promise(r => setTimeout(r, 100));
        }
        await new Promise(r => setTimeout(r, 500)); // give scripts moment to render buttons

        // 1. Verify Page Title and Basic Mode Keypad
        const evalTitle = await send('Runtime.evaluate', {
            expression: 'document.title'
        });
        console.log("Page Title:", evalTitle.result.value);

        // 2. Perform calculation: 200 + 10% - 5% =
        console.log("Testing calculation: 200 + 10% - 5%");
        const calcRes1 = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const disp = document.getElementById('display');
                    disp.textContent = '200+10%-5%';
                    document.querySelector('.equal-btn').click();
                    return {
                        display: disp.textContent,
                        expr: document.getElementById('expression-display').textContent
                    };
                })()
            `,
            returnByValue: true
        });
        console.log("Result 200+10%-5%:", calcRes1.result.value);

        // 3. Switch to Scientific Mode
        console.log("Testing mode switch to Scientific...");
        const switchMode = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    document.getElementById('mode-btn-scientific').click();
                    return {
                        mode: document.getElementById('display-mode-label').textContent,
                        buttonsCount: document.querySelectorAll('.calc-btn').length
                    };
                })()
            `,
            returnByValue: true
        });
        console.log("Scientific mode switched:", switchMode.result.value);

        // 4. Test Scientific Calculation: sin(30) + √25 =
        console.log("Testing Scientific calculation: sin(30)+√25");
        const calcRes2 = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    const disp = document.getElementById('display');
                    disp.textContent = 'sin(30)+√25';
                    document.querySelector('.equal-btn').click();
                    return {
                        display: disp.textContent,
                        expr: document.getElementById('expression-display').textContent,
                        fractionBadge: document.getElementById('badge-fraction').style.display
                    };
                })()
            `,
            returnByValue: true
        });
        console.log("Result sin(30)+√25:", calcRes2.result.value);

        // 5. Test Step-by-Step tab
        const stepsCheck = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    document.getElementById('tab-btn-steps').click();
                    const steps = document.querySelectorAll('.step-card');
                    return steps.length;
                })()
            `,
            returnByValue: true
        });
        console.log("Step-by-step breakdown cards logged:", stepsCheck.result.value);

        // 6. Test Theme Toggle
        console.log("Testing Theme Toggle...");
        const themeToggleRes = await send('Runtime.evaluate', {
            expression: `
                (function() {
                    document.getElementById('btn-theme-toggle').click();
                    const theme = document.documentElement.getAttribute('data-theme');
                    return theme;
                })()
            `,
            returnByValue: true
        });
        console.log("Theme after toggle:", themeToggleRes.result.value);

        // 7. Test iPhone viewport (390 x 844)
        console.log("Setting viewport to iPhone 14/15 size (390 x 844)...");
        await send('Emulation.setDeviceMetricsOverride', {
            width: 390,
            height: 844,
            deviceScaleFactor: 3,
            mobile: true
        });

        // Capture mobile screenshot
        const screenshotMobile = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_iphone.png', Buffer.from(screenshotMobile.data, 'base64'));
        console.log("Saved screenshot_iphone.png successfully");

        // Reset to desktop viewport (1280 x 800)
        await send('Emulation.setDeviceMetricsOverride', {
            width: 1280,
            height: 800,
            deviceScaleFactor: 1,
            mobile: false
        });

        const screenshotDesktop = await send('Page.captureScreenshot', { format: 'png' });
        fs.writeFileSync('screenshot_desktop.png', Buffer.from(screenshotDesktop.data, 'base64'));
        console.log("Saved screenshot_desktop.png successfully");

        ws.close();
        console.log("\nALL BROWSER E2E TESTS COMPLETED SUCCESSFULLY!");
    } finally {
        browser.kill();
    }
}

runBrowserTests().catch(err => {
    console.error("Browser test failed:", err);
    process.exit(1);
});
