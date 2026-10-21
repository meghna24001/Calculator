/**
 * Calyx - Application Logic
 * Integrates single-shell mode switching, UI state, parser, memory, history, theming, and PWA install.
 */

(function () {
    'use strict';

    // ==========================================
    // DOM ELEMENTS
    // ==========================================
    const display = document.getElementById('display');
    const expressionDisplay = document.getElementById('expression-display');
    const keypad = document.getElementById('keypad');
    const calcCard = document.getElementById('calculator-panel');

    // Badges & Labels
    const badgeMemory = document.getElementById('badge-memory');
    const badgeAngle = document.getElementById('badge-angle');
    const badgeInv = document.getElementById('badge-inv');
    const badgeFraction = document.getElementById('badge-fraction');
    const displayModeLabel = document.getElementById('display-mode-label');

    // Mode Toggle Buttons
    const modeBtnBasic = document.getElementById('mode-btn-basic');
    const modeBtnScientific = document.getElementById('mode-btn-scientific');
    const modeBtnConverter = document.getElementById('mode-btn-converter');
    const modeBtnGraph = document.getElementById('mode-btn-graph');

    // Memory Buttons
    const btnMemClear = document.getElementById('memory-clear');
    const btnMemRecall = document.getElementById('memory-recall');
    const btnMemAdd = document.getElementById('memory-add');
    const btnMemSub = document.getElementById('memory-subtract');

    // Header Controls
    const btnThemeToggle = document.getElementById('btn-theme-toggle');
    const btnKeyboardHelp = document.getElementById('btn-keyboard-help');
    const btnHistoryToggle = document.getElementById('btn-history-toggle');

    // History & Steps Panel
    const historyPanel = document.getElementById('history-panel');
    const tabBtnHistory = document.getElementById('tab-btn-history');
    const tabBtnSteps = document.getElementById('tab-btn-steps');
    const historyList = document.getElementById('history-list');
    const stepsList = document.getElementById('steps-list');
    const btnClearHistory = document.getElementById('btn-clear-history');
    const btnExportHistory = document.getElementById('btn-export-history');

    // Natural Language Input
    const smartMathInput = document.getElementById('smart-math-input');
    const smartMathSubmit = document.getElementById('smart-math-submit');

    // Modals
    const keyboardHelpModal = document.getElementById('keyboard-help-modal');
    const iosGuideModal = document.getElementById('ios-guide-modal');

    // ==========================================
    // APP STATE
    // ==========================================
    const STORAGE_KEY_HISTORY = 'modern_calc_history_v1';
    const STORAGE_KEY_THEME = 'modern_calc_theme';
    const STORAGE_KEY_ACCENT = 'modern_calc_accent';

    let currentMode = 'basic'; // 'basic' | 'scientific' | 'converter'
    let angleMode = 'DEG';     // 'DEG' | 'RAD'
    let inverseMode = false;
    let fractionMode = 'decimal'; // 'decimal' | 'improper' | 'mixed'

    let resultDisplayed = false;
    let memoryValue = null;
    let lastResult = null;      // Numeric or string result of last calculation
    let lastFraction = null;    // Fraction object { improper, mixed }
    let lastSteps = [];         // Step-by-step resolution records
    let history = [];
    let currentHistoryFilter = 'all'; // 'all' | 'basic' | 'scientific' | 'converter'

    let deferredInstallPrompt = null;

    let hasError = false;
    const OPERATORS = ['+', '-', '*', '/', '^'];
    const MAX_NUMBER_DIGITS = 15;
    const PLAIN_NUMBER = /^-?\d+(\.\d+)?$/;
    const CONTINUES_RESULT = ['+', '-', '*', '/', '^', '%', '!', '²', 'P', 'C', '^(-1)'];

    const DISPLAY_MIN_FONT_PX = 16;
    const EXPR_MIN_FONT_PX = 10;

    // Safe localStorage wrappers — guard against SecurityError in private browsing
    // and QuotaExceededError on write.
    function safeGet(key) {
        try { return localStorage.getItem(key); } catch (e) { return null; }
    }
    function safeSet(key, value) {
        try { localStorage.setItem(key, value); } catch (e) { /* ignore quota/security errors */ }
    }

    function shrinkToFit(el, minPx) {
        el.style.fontSize = '';                       // back to the CSS size
        let size = parseFloat(getComputedStyle(el).fontSize);
        while (el.scrollWidth > el.clientWidth && size > minPx) {
            size -= 1;
            el.style.fontSize = size + 'px';
        }
    }

    function fitDisplay() {
        display.classList.remove('wrap');
        shrinkToFit(display, DISPLAY_MIN_FONT_PX);
        if (display.scrollWidth > display.clientWidth) display.classList.add('wrap');
        display.scrollTop = display.scrollHeight;
        display.scrollLeft = display.scrollWidth;
    }

    function fitExpression() {
        shrinkToFit(expressionDisplay, EXPR_MIN_FONT_PX);
        expressionDisplay.scrollLeft = expressionDisplay.scrollWidth;
    }

    function setupAutoFit() {
        const opts = { childList: true, characterData: true, subtree: true };
        new MutationObserver(fitDisplay).observe(display, opts);
        new MutationObserver(fitExpression).observe(expressionDisplay, opts);
        const refit = () => { fitDisplay(); fitExpression(); };
        window.addEventListener('resize', refit);
        if (document.fonts && document.fonts.ready) document.fonts.ready.then(refit);
    }

    // Shared trigger for install action (defined early so it's accessible everywhere)
    async function triggerInstall() {
        const btnSidebarInstall = document.getElementById('btn-pwa-install-sidebar');
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        const isAndroid = /Android/.test(navigator.userAgent);
        const isMac = /Macintosh/.test(navigator.userAgent);
        
        if (isIOS) {
            openModal(iosGuideModal);
            return;
        }

        if (deferredInstallPrompt) {
            deferredInstallPrompt.prompt();
            const choice = await deferredInstallPrompt.userChoice;
            if (choice.outcome === 'accepted') {
                if (btnSidebarInstall) btnSidebarInstall.classList.add('installed');
            }
            deferredInstallPrompt = null;
        } else {
            // Fallback for browsers that don't fire beforeinstallprompt (Firefox, Safari, etc.)
            // Show platform-appropriate install guide
            showInstallGuide(isAndroid, isMac);
        }
    }

    function showInstallGuide(isAndroid, isMac) {
        const modal = document.getElementById('ios-guide-modal');
        if (!modal) return;
        
        const title = modal.querySelector('#ios-modal-title');
        const content = modal.querySelector('.modal-card');
        
        if (isAndroid) {
            title.textContent = '📲 Install Calculator App';
            content.innerHTML = `
                <div class="modal-header">
                    <h3 id="ios-modal-title" class="modal-title">📲 Install Calculator App</h3>
                    <button type="button" class="modal-close-btn" data-close="ios-guide-modal" aria-label="Close modal">&#x00D7;</button>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
                    You can install this app directly on your Android device for fast offline use.
                </div>
                <div style="font-weight: 700; font-size: 0.84rem; color: var(--accent-primary); margin-bottom: 8px;">Android (Chrome / Edge / Firefox):</div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">1</span>
                    <span>Open this page in <strong>Chrome</strong> or <strong>Edge</strong> browser.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">2</span>
                    <span>Tap the <strong>⋮ menu</strong> > <strong>Install app</strong> or <strong>Add to Home screen</strong>.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">3</span>
                    <span>Or look for the <strong>Install</strong> icon in the address bar.</span>
                </div>
            `;
        } else if (isMac) {
            title.textContent = '📲 Install Calculator App';
            content.innerHTML = `
                <div class="modal-header">
                    <h3 id="ios-modal-title" class="modal-title">📲 Install Calculator App</h3>
                    <button type="button" class="modal-close-btn" data-close="ios-guide-modal" aria-label="Close modal">&#x00D7;</button>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
                    You can install this app on your Mac for fast offline use.
                </div>
                <div style="font-weight: 700; font-size: 0.84rem; color: var(--accent-primary); margin-bottom: 8px;">macOS (Safari / Chrome / Edge):</div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">1</span>
                    <span>In <strong>Safari</strong>: Tap <strong>Share</strong> > <strong>Add to Dock</strong> or <strong>Add to Home Screen</strong>.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">2</span>
                    <span>In <strong>Chrome/Edge</strong>: Click the <strong>Install</strong> icon in the address bar or ⋮ menu > <strong>Install Calyx</strong>.</span>
                </div>
            `;
        } else {
            title.textContent = '📲 Install Calculator App';
            content.innerHTML = `
                <div class="modal-header">
                    <h3 id="ios-modal-title" class="modal-title">📲 Install Calculator App</h3>
                    <button type="button" class="modal-close-btn" data-close="ios-guide-modal" aria-label="Close modal">&#x00D7;</button>
                </div>
                <div style="font-size: 0.88rem; color: var(--text-secondary); margin-bottom: 14px;">
                    You can install this app directly on your phone, tablet, or PC for fast offline use.
                </div>
                <div style="font-weight: 700; font-size: 0.84rem; color: var(--accent-primary); margin-bottom: 8px;">Windows / Linux (Chrome / Edge / Firefox):</div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">1</span>
                    <span>Open this page in <strong>Chrome</strong> or <strong>Edge</strong>.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">2</span>
                    <span>Click the <strong>Install</strong> icon (⊕) in the address bar, or ⋮ menu > <strong>Install Calyx</strong>.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">3</span>
                    <span>In <strong>Firefox</strong>: Click the <strong>Install</strong> icon in the address bar or ⋮ menu > <strong>Install</strong>.</span>
                </div>
                <div style="font-weight: 700; font-size: 0.84rem; color: var(--accent-primary); margin: 12px 0 8px;">iPhone & iPad (Safari):</div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">1</span>
                    <span>Tap the <strong>Share</strong> button (box with upward arrow) in Safari.</span>
                </div>
                <div class="ios-guide-step">
                    <span class="ios-step-num">2</span>
                    <span>Scroll down and select <strong>Add to Home Screen</strong>.</span>
                </div>
            `;
        }
        
        // Re-attach close button listener
        const closeBtn = modal.querySelector('.modal-close-btn');
        if (closeBtn) {
            closeBtn.onclick = () => modal.classList.remove('show');
        }
        
        modal.classList.add('show');
    }

    // ==========================================
    // INITIALIZATION & LIFECYCLE
    // ==========================================

    function init() {
        // 1. Restore Theme & Accent
        initTheme();

        // 2. Initial Mode: Always show Basic Calculator by default when opening the site
        const urlParams = new URLSearchParams(window.location.search);
        const modeParam = urlParams.get('mode');
        if (modeParam === 'scientific' || modeParam === 'basic' || modeParam === 'converter' || modeParam === 'graph' || modeParam === 'solver') {
            currentMode = modeParam;
        } else {
            currentMode = 'basic';
        }

        // 3. Load calculation history
        loadHistory();

        // 4. Render Mode & Keypad
        setMode(currentMode, false);

        // Ensure history drawer is closed by default per specification
        if (historyPanel) historyPanel.style.display = 'none';

        // 5. Setup Event Listeners
        setupEventListeners();

        // 6. Register Service Worker & PWA Install
        setupPWA();

        setupAutoFit();
    }

    // ==========================================
    // THEME & ACCENT MANAGEMENT
    // ==========================================

    function initTheme() {
        const savedTheme = safeGet(STORAGE_KEY_THEME);
        const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
        const initialTheme = savedTheme || (systemPrefersDark ? 'dark' : 'light');
        applyTheme(initialTheme);

        // Listen for system theme changes (only if user hasn't explicitly chosen a theme)
        const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
        mediaQuery.addEventListener('change', (e) => {
            if (!safeGet(STORAGE_KEY_THEME)) {
                applyTheme(e.matches ? 'dark' : 'light');
            }
        });

        const savedAccent = safeGet(STORAGE_KEY_ACCENT) || 'blue';
        applyAccent(savedAccent);
    }

    // Meta theme-color map for each preset
    const THEME_META_COLORS = {
        'light':         '#f1f5f9',
        'dark':          '#090d16',
        'midnight':      '#080c18',
        'pastel':        '#fdf4ff',
        'high-contrast': '#000000',
        'synthwave':     '#0d0221',
    };

    function applyTheme(theme) {
        document.documentElement.setAttribute('data-theme', theme);
        safeSet(STORAGE_KEY_THEME, theme);

        // Update legacy header theme toggle if it still exists
        if (btnThemeToggle) {
            const isDarkVariant = ['dark', 'midnight', 'synthwave'].includes(theme);
            btnThemeToggle.textContent = isDarkVariant ? '☀️' : '🌙';
            btnThemeToggle.setAttribute('title', isDarkVariant ? 'Switch to Light Theme' : 'Switch to Dark Theme');
        }

        // Update sidebar theme preset buttons active state
        document.querySelectorAll('.theme-preset-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.themePreset === theme);
        });

        // Update meta theme-color for browser chrome / status bar
        const metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (metaThemeColor) {
            metaThemeColor.setAttribute('content', THEME_META_COLORS[theme] || '#f1f5f9');
        }

        // Re-render graph if active so colors update immediately
        if (typeof graphPlotterInstance !== 'undefined' && graphPlotterInstance && typeof graphPlotterInstance.render === 'function') {
            graphPlotterInstance.render();
        }
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'light';
        // Simple toggle cycles between light and dark only (keyboard shortcut)
        const isDark = ['dark', 'midnight', 'synthwave'].includes(currentTheme);
        applyTheme(isDark ? 'light' : 'dark');
    }

    function applyAccent(accent) {
        document.documentElement.setAttribute('data-accent', accent);
        safeSet(STORAGE_KEY_ACCENT, accent);

        // Update active palette swatch in sidebar
        document.querySelectorAll('.sidebar-swatch').forEach(swatch => {
            swatch.classList.toggle('active', swatch.dataset.accentVal === accent);
        });
    }

    // ==========================================
    // MODE SWITCHING (BASIC <-> SCIENTIFIC <-> CONVERTER)
    // ==========================================

    function setMode(mode) {
        currentMode = mode;

        const isConverter = mode === 'converter';
        const isGraph = mode === 'graph';
        const isSolver = mode === 'solver';
        const isScientific = mode === 'scientific';

        // Trigger mode switch animation
        calcCard.classList.add('mode-switching');
        // Force reflow
        void calcCard.offsetWidth;

        // Update Segmented Tab Pills (if present)
        if (modeBtnBasic) {
            modeBtnBasic.classList.toggle('active', mode === 'basic');
            modeBtnBasic.setAttribute('aria-selected', mode === 'basic');
        }
        if (modeBtnScientific) {
            modeBtnScientific.classList.toggle('active', isScientific);
            modeBtnScientific.setAttribute('aria-selected', isScientific);
        }
        if (modeBtnConverter) {
            modeBtnConverter.classList.toggle('active', isConverter);
            modeBtnConverter.setAttribute('aria-selected', isConverter);
        }
        if (modeBtnGraph) {
            modeBtnGraph.classList.toggle('active', isGraph);
            modeBtnGraph.setAttribute('aria-selected', isGraph);
        }

        // Sync sidebar active mode item
        document.querySelectorAll('.sidebar-nav-item.mode-item').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === mode);
        });

        // Update Container Styling
        calcCard.classList.toggle('mode-basic', mode === 'basic');
        calcCard.classList.toggle('mode-scientific', isScientific);
        calcCard.classList.toggle('mode-converter', isConverter);
        calcCard.classList.toggle('mode-graph', isGraph);
        calcCard.classList.toggle('mode-solver', isSolver);

        // In converter, graph and solver mode, hide the standard display, memory bar, and smart query bar
        const displayBox  = document.getElementById('display-container');
        const memToolbar  = document.getElementById('memory-toolbar');
        const smartBar    = document.querySelector('.smart-query-bar');

        const isCustomPanel = isConverter || isGraph || isSolver;
        displayBox.style.display  = isCustomPanel ? 'none' : '';
        memToolbar.style.display  = isCustomPanel ? 'none' : '';
        smartBar.style.display    = isCustomPanel ? 'none' : '';

        // Label in display bar (only relevant for standard calculators)
        if (!isCustomPanel) {
            displayModeLabel.textContent = isScientific ? 'Scientific' : 'Basic';
        }

        // Show DEG/RAD badge only in Scientific mode
        badgeAngle.style.display = isScientific ? 'inline-block' : 'none';

        // Reset inverse mode when switching away from Scientific
        if (!isScientific) {
            inverseMode = false;
            badgeInv.style.display = 'none';
            badgeInv.classList.remove('active');
        }

        // Show graph analysis side panel only if in Graph mode AND user has entered functions
        const graphAnalysisPanel = document.getElementById('graph-analysis-panel');
        if (graphAnalysisPanel) {
            const hasPlottedFns = isGraph && graphFunctions.some(f => f.visible && f.expr && f.expr.trim());
            graphAnalysisPanel.style.display = hasPlottedFns ? 'flex' : 'none';
        }

        // Cleanup plotter when switching away from graph mode
        if (!isGraph && graphPlotterInstance) {
            graphPlotterInstance.destroy();
            graphPlotterInstance = null;
        }

        renderKeypad();
        fitDisplay();
        fitExpression();

        // Remove mode-switching class after animation
        setTimeout(() => calcCard.classList.remove('mode-switching'), 300);
    }

    // ==========================================
    // KEYPAD RENDERING
    // ==========================================

    function renderKeypad() {
        keypad.innerHTML = '';
        keypad.className = `keypad-grid layout-${currentMode}`;

        if (currentMode === 'basic') {
            renderBasicKeypad();
        } else if (currentMode === 'scientific') {
            renderScientificKeypad();
        } else if (currentMode === 'converter') {
            renderConverterUI();
        } else if (currentMode === 'graph') {
            renderGraphUI();
        } else if (currentMode === 'solver') {
            renderSolverUI();
        }
    }

    function createButton(text, classes, action, ariaLabel, dataVal = '') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = `calc-btn ${classes}`;
        btn.textContent = text;
        if (ariaLabel) btn.setAttribute('aria-label', ariaLabel);
        if (dataVal) btn.dataset.val = dataVal;

        btn.addEventListener('click', () => action(btn));
        return btn;
    }

    function renderBasicKeypad() {
        const buttons = [
            // Row 1
            { text: 'Ans', cls: 'scientific-btn', fn: () => insertAns(), label: 'Previous answer' },
            { text: '%', cls: 'operator-btn', fn: () => appendInput('%'), label: 'Percentage' },
            { text: '(', cls: 'operator-btn', fn: () => appendInput('('), label: 'Open parenthesis' },
            { text: ')', cls: 'operator-btn', fn: () => appendInput(')'), label: 'Close parenthesis' },

            // Row 2
            { text: '7', cls: 'number-btn', fn: () => appendInput('7'), label: '7' },
            { text: '8', cls: 'number-btn', fn: () => appendInput('8'), label: '8' },
            { text: '9', cls: 'number-btn', fn: () => appendInput('9'), label: '9' },
            { text: '÷', cls: 'operator-btn', fn: () => appendInput('/'), label: 'Divide' },

            // Row 3
            { text: '4', cls: 'number-btn', fn: () => appendInput('4'), label: '4' },
            { text: '5', cls: 'number-btn', fn: () => appendInput('5'), label: '5' },
            { text: '6', cls: 'number-btn', fn: () => appendInput('6'), label: '6' },
            { text: '×', cls: 'operator-btn', fn: () => appendInput('*'), label: 'Multiply' },

            // Row 4
            { text: '1', cls: 'number-btn', fn: () => appendInput('1'), label: '1' },
            { text: '2', cls: 'number-btn', fn: () => appendInput('2'), label: '2' },
            { text: '3', cls: 'number-btn', fn: () => appendInput('3'), label: '3' },
            { text: '−', cls: 'operator-btn', fn: () => appendInput('-'), label: 'Minus' },

            // Row 5
            { text: '0', cls: 'number-btn', fn: () => appendInput('0'), label: '0' },
            { text: '.', cls: 'number-btn', fn: () => appendInput('.'), label: 'Decimal point' },
            { text: '←', cls: 'backspace-btn', fn: () => backspace(), label: 'Backspace' },
            { text: '+', cls: 'operator-btn', fn: () => appendInput('+'), label: 'Plus' },

            // Row 6
            { text: 'C', cls: 'clear-btn', fn: () => clearAll(), label: 'Clear' },
            { text: '=', cls: 'equal-btn', fn: () => calculate(), label: 'Calculate result' }
        ];

        buttons.forEach(b => {
            keypad.appendChild(createButton(b.text, b.cls, b.fn, b.label));
        });
    }

    function renderScientificKeypad() {
        // Row 1: Angle (DEG/RAD), INV, Median/Mode, LCM/HCF, Rand/RInt, Ans, Clear (C)
        // Row 2: sin/asin, log/10^x, √/x², (, ), %, ÷
        // Row 3: cos/acos, ln/e^x, Mean/Range, 7, 8, 9, ×
        // Row 4: tan/atan, xʸ/ʸ√x, SD/Var, 4, 5, 6, −
        // Row 5: mod, π, e, 1, 2, 3, +
        // Row 6: x!/x⁻¹, aᵇ⁄ᶜ (fraction), nPr/nCr, 0, ., ←, =

        const sciButtons = [
            // Row 1
            { text: angleMode, cls: 'scientific-btn', fn: () => toggleAngleMode(), label: `Angle mode ${angleMode}. Click to toggle.` },
            { text: 'INV', cls: `scientific-btn ${inverseMode ? 'inv-active' : ''}`, fn: () => toggleInverse(), label: 'Inverse functions toggle' },
            { text: inverseMode ? 'Mode' : 'Median', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'mode' : 'median'), label: inverseMode ? 'Mode' : 'Median' },
            { text: inverseMode ? 'HCF' : 'LCM', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'hcf' : 'lcm'), label: inverseMode ? 'Highest Common Factor' : 'Lowest Common Multiple' },
            { text: inverseMode ? 'RInt' : 'Rand', cls: 'scientific-btn', fn: () => handleRand(), label: 'Random Number' },
            { text: 'Ans', cls: 'scientific-btn', fn: () => insertAns(), label: 'Previous Answer' },
            { text: 'C', cls: 'clear-btn', fn: () => clearAll(), label: 'Clear' },

            // Row 2
            { text: inverseMode ? 'sin⁻¹' : 'sin', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'asin' : 'sin'), label: inverseMode ? 'Arcsine' : 'Sine' },
            { text: inverseMode ? '10ˣ' : 'log', cls: 'scientific-btn', fn: () => inverseMode ? appendInput('10^(') : appendFunction('log'), label: inverseMode ? '10 to the power x' : 'Logarithm base 10' },
            { text: inverseMode ? 'x²' : '√', cls: 'scientific-btn', fn: () => inverseMode ? appendInput('²') : appendFunction('sqrt'), label: inverseMode ? 'Square' : 'Square Root' },
            { text: '(', cls: 'operator-btn', fn: () => appendInput('('), label: 'Open bracket' },
            { text: ')', cls: 'operator-btn', fn: () => appendInput(')'), label: 'Close bracket' },
            { text: '%', cls: 'operator-btn', fn: () => appendInput('%'), label: 'Percentage' },
            { text: '÷', cls: 'operator-btn', fn: () => appendInput('/'), label: 'Divide' },

            // Row 3
            { text: inverseMode ? 'cos⁻¹' : 'cos', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'acos' : 'cos'), label: inverseMode ? 'Arccosine' : 'Cosine' },
            { text: inverseMode ? 'eˣ' : 'ln', cls: 'scientific-btn', fn: () => inverseMode ? appendInput('e^(') : appendFunction('ln'), label: inverseMode ? 'e to the power x' : 'Natural Logarithm' },
            { text: inverseMode ? 'Range' : 'Mean', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'range' : 'mean'), label: inverseMode ? 'Range' : 'Mean' },
            { text: '7', cls: 'number-btn', fn: () => appendInput('7'), label: '7' },
            { text: '8', cls: 'number-btn', fn: () => appendInput('8'), label: '8' },
            { text: '9', cls: 'number-btn', fn: () => appendInput('9'), label: '9' },
            { text: '×', cls: 'operator-btn', fn: () => appendInput('*'), label: 'Multiply' },

            // Row 4
            { text: inverseMode ? 'tan⁻¹' : 'tan', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'atan' : 'tan'), label: inverseMode ? 'Arctangent' : 'Tangent' },
            { text: inverseMode ? 'ʸ√x' : 'xʸ', cls: 'scientific-btn', fn: () => inverseMode ? appendFunction('root') : appendInput('^'), label: inverseMode ? 'y-root of x' : 'Power' },
            { text: inverseMode ? 'Var' : 'SD', cls: 'scientific-btn', fn: () => appendFunction(inverseMode ? 'var' : 'sd'), label: inverseMode ? 'Variance' : 'Standard Deviation' },
            { text: '4', cls: 'number-btn', fn: () => appendInput('4'), label: '4' },
            { text: '5', cls: 'number-btn', fn: () => appendInput('5'), label: '5' },
            { text: '6', cls: 'number-btn', fn: () => appendInput('6'), label: '6' },
            { text: '−', cls: 'operator-btn', fn: () => appendInput('-'), label: 'Minus' },

            // Row 5
            { text: 'mod', cls: 'scientific-btn', fn: () => appendFunction('mod'), label: 'Modulo' },
            { text: 'π', cls: 'scientific-btn', fn: () => appendInput('π'), label: 'Pi constant' },
            { text: 'e', cls: 'scientific-btn', fn: () => appendInput('e'), label: "Euler's constant" },
            { text: '1', cls: 'number-btn', fn: () => appendInput('1'), label: '1' },
            { text: '2', cls: 'number-btn', fn: () => appendInput('2'), label: '2' },
            { text: '3', cls: 'number-btn', fn: () => appendInput('3'), label: '3' },
            { text: '+', cls: 'operator-btn', fn: () => appendInput('+'), label: 'Plus' },

            // Row 6
            { text: inverseMode ? 'x⁻¹' : 'x!', cls: 'scientific-btn', fn: () => inverseMode ? appendInput('^(-1)') : appendInput('!'), label: inverseMode ? 'Reciprocal' : 'Factorial' },
            { text: inverseMode ? 'd/c' : 'aᵇ⁄ᶜ', cls: 'scientific-btn', fn: () => toggleFractionMode(), label: 'Toggle fraction display' },
            { text: inverseMode ? 'nCr' : 'nPr', cls: 'scientific-btn', fn: () => appendInput(inverseMode ? 'C' : 'P'), label: inverseMode ? 'Combinations' : 'Permutations' },
            { text: '0', cls: 'number-btn', fn: () => appendInput('0'), label: '0' },
            { text: '.', cls: 'number-btn', fn: () => appendInput('.'), label: 'Decimal' },
            { text: ',', cls: 'number-btn', fn: () => appendInput(','), label: 'Comma' },
            { text: '←', cls: 'backspace-btn', fn: () => backspace(), label: 'Backspace' },
            { text: '=', cls: 'equal-btn', fn: () => calculate(), label: 'Calculate result' }
        ];

        sciButtons.forEach(b => {
            keypad.appendChild(createButton(b.text, b.cls, b.fn, b.label));
        });
    }

    // ==========================================
    // DISPLAY & INPUT OPERATIONS (WITH PRETTY PRINT)
    // ==========================================

    const SUPERSCRIPT_MAP = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '+': '⁺', '-': '⁻', '(': '⁽', ')': '⁾', 'n': 'ⁿ', 'x': 'ˣ', 'y': 'ʸ'
    };

    function toSuperscripts(str) {
        return String(str).split('').map(c => SUPERSCRIPT_MAP[c] || c).join('');
    }

    function prettyPrint(raw) {
        if (!raw) return '';
        let s = String(raw);

        // Auto-format powers/exponents:
        // 1. ^(-1), ^(12), ^(-5)
        s = s.replace(/\^\(([0-9+\-nxy]+)\)/g, (_, exp) => toSuperscripts(exp));
        // 2. ^2, ^3, ^10
        s = s.replace(/\^([0-9]+)/g, (_, exp) => toSuperscripts(exp));
        // 3. ^-(1|2...)
        s = s.replace(/\^(-[0-9]+)/g, (_, exp) => toSuperscripts(exp));

        // Auto-format functions & symbols:
        // sqrt( -> √(
        s = s.replace(/\bsqrt\(/gi, '√(');
        // cbrt( -> ∛(
        s = s.replace(/\bcbrt\(/gi, '∛(');

        // Multiplication operator: * -> ×
        s = s.replace(/\*/g, '×');

        return s;
    }

    let rawExpression = '';

    function getDisplay() {
        if (hasError) return display.textContent || '';
        return rawExpression;
    }

    function setDisplay(val, isError = false) {
        if (isError) {
            rawExpression = '';
            display.textContent = val;
            display.classList.add('error');
            display.classList.remove('wrap');
            display.style.removeProperty('--display-font-size');
            return;
        }

        display.classList.remove('error');
        rawExpression = String(val == null ? '' : val);
        const formatted = prettyPrint(rawExpression);
        display.textContent = formatted;

        // Dynamic font scaling based on displayed text length
        const len = formatted.length;
        let fontSize;
        if      (len <= 10) { fontSize = '2rem';   display.classList.remove('wrap'); }
        else if (len <= 16) { fontSize = '1.6rem';  display.classList.remove('wrap'); }
        else if (len <= 22) { fontSize = '1.3rem';  display.classList.remove('wrap'); }
        else if (len <= 30) { fontSize = '1.1rem';  display.classList.remove('wrap'); }
        else                { fontSize = '0.95rem'; display.classList.add('wrap'); }

        display.style.setProperty('--display-font-size', fontSize);
    }

    function isDigit(c) { return c.length === 1 && c >= '0' && c <= '9'; }
    function lastChar(s) { return s.length ? s[s.length - 1] : ''; }

    function openParenCount(s) {
        let n = 0;
        for (const c of s) {
            if (c === '(') n++;
            else if (c === ')' && n > 0) n--;
        }
        return n;
    }

    function resetIfError() {
        if (!hasError) return;
        setDisplay('');
        expressionDisplay.textContent = '';
        resultDisplayed = false;
        hasError = false;
    }

    function currentNumberSegment(cur) {
        return cur.match(/[0-9.]*$/)[0];
    }

    function inputDigit(d, cur, last) {
        if (/[%!²πe]/.test(last)) return;
        if (last === ')') cur += '*';
        const seg = currentNumberSegment(cur);
        if (seg === '0') { setDisplay(d === '0' ? cur : cur.slice(0, -1) + d); return; }
        if (seg.replace('.', '').length >= MAX_NUMBER_DIGITS) return;
        setDisplay(cur + d);
    }

    function inputDecimal(cur, last) {
        if (/[%!²πe]/.test(last)) return;
        if (last === ')') cur += '*';
        const seg = currentNumberSegment(cur);
        if (seg.includes('.')) return;
        if (seg.length >= MAX_NUMBER_DIGITS) return;
        setDisplay(cur + (seg === '' ? '0.' : '.'));
    }

    function inputOperator(op, cur, last) {
        if (last === 'P' || last === 'C') return;
        if (last === '.') cur = cur.slice(0, -1);
        const trailing = cur.match(/[+\-*\/^]*$/)[0];
        const core = cur.slice(0, cur.length - trailing.length);

        // Nothing before it (or just "("): only a single negative sign is allowed
        if (core === '' || core.endsWith('(')) {
            if (op === '-' && trailing === '') setDisplay(cur + '-');
            return;
        }
        // 5*-3 : negative sign after * / ^
        if (op === '-' && trailing.length === 1 && '*/^'.includes(trailing)) {
            setDisplay(cur + '-');
            return;
        }
        if (op === '-' && trailing.length > 1 && trailing.endsWith('-')) return;
        // Otherwise replace the previous operator
        setDisplay(core + op);
    }

    function appendInput(val) {
        hapticFeedback('light');
        resetIfError();
        if (resultDisplayed && fractionMode !== 'decimal') {
            setDisplay(String(lastResult));
            fractionMode = 'decimal';
            badgeFraction.textContent = 'DEC';
            badgeFraction.style.display = 'none';
        }
        let cur = getDisplay();

        if (resultDisplayed) {
            const keep = PLAIN_NUMBER.test(cur) && CONTINUES_RESULT.includes(val);
            if (!keep) { cur = ''; setDisplay(''); }
            resultDisplayed = false;
        }
        const last = lastChar(cur);

        if (isDigit(val)) return inputDigit(val, cur, last);
        if (val === '.') return inputDecimal(cur, last);
        if (OPERATORS.includes(val)) return inputOperator(val, cur, last);

        if (val === '%') {
            if (isDigit(last)) setDisplay(cur + '%');
            return;
        }
        if (val.endsWith('(')) {                 // "(", "10^(", "e^("
            if (last === '.' || last === '%') return;
            if (isDigit(last) || /[)!²πe]/.test(last)) cur += '*';
            setDisplay(cur + val);
            return;
        }
        if (val === ')') {
            if (openParenCount(cur) === 0) return;
            if (!/[0-9)%!²πe]/.test(last)) return;
            setDisplay(cur + ')');
            return;
        }
        if (val === 'π' || val === 'e') {
            if (last === '.' || last === '%') return;
            if (last === 'π' || last === 'e') cur += '*';
            setDisplay(cur + val);
            return;
        }
        if (val === '!' || val === 'P' || val === 'C') {
            if (isDigit(last) || last === ')') setDisplay(cur + val);
            return;
        }
        if (val === '²' || val === '^(-1)') {
            if (isDigit(last) || /[)πe]/.test(last)) setDisplay(cur + val);
            return;
        }
        if (val === ',') {
            if (cur === '') return;
            if (last === '(' || last === ',' || OPERATORS.includes(last) || last === '.') return;
            setDisplay(cur + ',');
            return;
        }
        setDisplay(cur + val);
    }

    function appendFunction(funcName) {
        resetIfError();
        if (resultDisplayed) {
            setDisplay('');
            resultDisplayed = false;
        }
        setDisplay(getDisplay() + `${funcName}(`);
    }

    function handleRand() {
        if (inverseMode) {
            // RInt: rand(1, 100)
            setDisplay(getDisplay() + 'rand(1, 100)');
        } else {
            // Rand: rand()
            setDisplay(getDisplay() + 'rand()');
        }
        resultDisplayed = false;
    }

    // Haptic feedback for mobile
    function hapticFeedback(type = 'light') {
        if ('vibrate' in navigator) {
            const patterns = {
                light: 10,
                medium: 20,
                heavy: 30,
                selection: [5, 5, 5],
                success: [10, 10, 10],
                error: [50, 30, 50]
            };
            navigator.vibrate(patterns[type] || patterns.light);
        }
    }

    function backspace() {
        hapticFeedback('light');
        if (resultDisplayed) {
            clearAll();
            return;
        }
        const cur = getDisplay();
        if (cur.length > 0) {
            // Check if deleting a trailing function like "sin(" or "root("
            const matchFn = cur.match(/([a-zA-Z]+|\u221A)\($/);
            if (matchFn) {
                setDisplay(cur.slice(0, -matchFn[0].length));
            } else {
                setDisplay(cur.slice(0, -1));
            }
        }
    }

    function clearAll() {
        hapticFeedback('medium');
        setDisplay('');
        expressionDisplay.textContent = '';
        resultDisplayed = false;
        fractionMode = 'decimal';
        badgeFraction.style.display = 'none';
        hasError = false;
    }

    function toPlainNumber(n) {
        const s = String(n);
        if (!/e/i.test(s)) return s;
        if (Math.abs(n) >= 1) return BigInt(n).toString();
        const f = n.toFixed(20).replace(/0+$/, '').replace(/\.$/, '');
        return Number(f) === 0 ? null : f;
    }

    function insertValue(value) {
        resetIfError();
        if (typeof value !== 'number' || !Number.isFinite(value)) return;
        const plain = toPlainNumber(value);
        if (plain === null) return;

        const cur = getDisplay();
        const last = lastChar(cur);

        if (cur === '' || resultDisplayed) {
            setDisplay(plain);
            resultDisplayed = false;
            return;
        }
        if (last === '.' || last === '%') return;

        const text = value < 0 ? `(${plain})` : plain;
        if (last === '(' || OPERATORS.includes(last)) setDisplay(cur + text);
        else setDisplay(cur + '*' + text);
    }

    function insertAns() { insertValue(lastResult); }

    // ==========================================
    // SCIENTIFIC TOGGLES (DEG/RAD, INV, FRACTION)
    // ==========================================

    function toggleAngleMode(mode = null) {
        angleMode = mode || (angleMode === 'DEG' ? 'RAD' : 'DEG');
        badgeAngle.textContent = angleMode;
        if (currentMode === 'scientific') {
            renderKeypad(); // clears innerHTML before re-rendering
        }
    }

    function toggleInverse() {
        inverseMode = !inverseMode;
        badgeInv.style.display = inverseMode ? 'inline-block' : 'none';
        badgeInv.classList.toggle('active', inverseMode);
        renderKeypad(); // clears innerHTML before re-rendering — prevents button stacking
    }

    function toggleFractionMode() {
        if (!resultDisplayed || !lastFraction || lastResult === null || typeof lastResult !== 'number') {
            return;
        }

        if (fractionMode === 'decimal') {
            fractionMode = 'improper';
            setDisplay(lastFraction.improper);
            badgeFraction.textContent = 'a/b';
            badgeFraction.style.display = 'inline-block';
        } else if (fractionMode === 'improper') {
            fractionMode = 'mixed';
            setDisplay(lastFraction.mixed);
            badgeFraction.textContent = 'a b/c';
            badgeFraction.style.display = 'inline-block';
        } else {
            fractionMode = 'decimal';
            setDisplay(String(lastResult));
            badgeFraction.textContent = 'DEC';
            badgeFraction.style.display = 'none';
        }
    }

    // ==========================================
    // CALCULATION & PARSER EXECUTION
    // ==========================================

    function prepareExpression(raw) {
        // drop dangling operators / "(" / "." / "," and auto-close open brackets
        const expr = raw.trim().replace(/[\s+\-*\/^(.,PC]+$/, '');
        if (!expr) return '';
        return expr + ')'.repeat(openParenCount(expr));
    }

    const ERROR_RULES = [
        [/divide by zero|mod by zero/i, "Can't divide by Zero"],
        [/factorial overflow/i, 'Too large: Factorial works up to 170!'],
        [/invalid factorial/i, 'Factorial needs a whole number, 0 or more'],
        [/permutation|combination/i, 'nPr / nCr need whole numbers with r ≤ n'],
        [/square root of negative/i, "Can't take the square root of a negative number"],
        [/even root of negative/i, "Can't take an even root of a negative number"],
        [/0th root/i, 'Root degree cannot be 0'],
        [/logarithm/i, 'Logarithm needs a number greater than 0'],
        [/asin|acos/i, 'Inverse sin/cos need a value from -1 to 1'],
        [/undefined tangent/i, 'Tangent is undefined at this angle'],
        [/complex result/i, "Result isn't a real number"],
        [/overflow in exponentiation|invalid calculation/i, 'Result is out of range'],
        [/percentage/i, 'Invalid use of %'],
        [/Unknown function(?: or variable)?: (.+)/i, (h) => `"${h[1]}" is not a known function`],
        [/Unexpected character: "(.+)"/i, (h) => `Unsupported character "${h[1]}"`],
        [/unexpected end|expected token|expected "|unexpected token|unexpected extra/i, 'Invalid Expression'],
    ];

    function friendlyError(msg) {
        const m = String(msg || '');
        for (const [re, out] of ERROR_RULES) {
            const hit = m.match(re);
            if (hit) return typeof out === 'function' ? out(hit) : out;
        }
        return m || 'Something went wrong';
    }
    
    function calculate() {
        hapticFeedback('medium');
        if (hasError) return;
        const shown = getDisplay().trim();
        if (!shown) return;
        if (resultDisplayed && fractionMode !== 'decimal') return;
        if (resultDisplayed && PLAIN_NUMBER.test(shown)) return; // already a result
        const rawExpr = getDisplay().trim();
        if (!rawExpr) return;

        // Fix #1: Auto-close unclosed parentheses before evaluation
        const closedExpr = prepareExpression(rawExpr);
        if (!closedExpr) return;

        try {
            // Run through our standalone MathParser module (Zero eval!)
            const parseResult = MathParser.evaluate(closedExpr, {
                angleMode: angleMode,
                trackSteps: true
            });

            if (parseResult.error || parseResult.result === null) {
                expressionDisplay.textContent = prettyPrint(closedExpr) + ' =';
                setDisplay(friendlyError(parseResult.error || 'Error'), true);
                resultDisplayed = true;
                hasError = true;
                return;
            }
            hasError = false;
            // Success: update displays and states
            // Show balanced expression (with auto-added closing brackets) in expression line
            expressionDisplay.textContent = prettyPrint(closedExpr) + ' =';
            setDisplay(parseResult.formatted);
            resultDisplayed = true;

            lastResult = parseResult.numericResult !== null ? parseResult.numericResult : parseResult.result;
            lastFraction = parseResult.fraction;
            lastSteps = parseResult.steps || [];

            // Fraction indicator update
            if (lastFraction && typeof lastResult === 'number' && !Number.isInteger(lastResult)) {
                badgeFraction.textContent = 'DEC';
                badgeFraction.style.display = 'inline-block';
            } else {
                badgeFraction.style.display = 'none';
            }

            fractionMode = 'decimal';

            // Save to persistent history
            saveHistory(closedExpr, parseResult.formatted, lastSteps);

            // Render Steps view if visible
            renderSteps(lastSteps, closedExpr, parseResult.formatted);

        } catch (err) {
            expressionDisplay.textContent = prettyPrint(closedExpr) + ' =';
            setDisplay('Something went wrong', true);
            resultDisplayed = true;
            hasError = true;
        }
    }

    // Natural Language Input Submission
    function handleSmartSubmit() {
        const query = smartMathInput.value.trim();
        if (!query) return;
        resetIfError();
        resultDisplayed = false;
        setDisplay(query);
        smartMathInput.value = '';
        calculate();
    }

    // ==========================================
    // MEMORY OPERATIONS
    // ==========================================

    function getEvaluatedDisplayValue() {
        if (hasError) return null;
        if (resultDisplayed && fractionMode !== 'decimal' && typeof lastResult === 'number' && Number.isFinite(lastResult)) {
            return lastResult;
        }
        const cur = getDisplay().trim();
        if (!cur) return null;

        const res = MathParser.evaluate(prepareExpression(cur), { angleMode: angleMode });
        if (res.error || typeof res.numericResult !== 'number') {
            expressionDisplay.textContent = res.error ? friendlyError(res.error) : 'Nothing to add';
            return null;
        }
        return res.numericResult;
    }

    function updateMemoryBadge() {
        badgeMemory.style.display = memoryValue !== null ? 'inline-block' : 'none';
        badgeMemory.classList.toggle('active', memoryValue !== null);
    }

    function memoryClear() {
        hapticFeedback('medium');
        if (memoryValue === null) return;
        memoryValue = null;
        updateMemoryBadge();
        expressionDisplay.textContent = 'MC (Memory Cleared)';
    }

    function memoryRecall() {
        hapticFeedback('light');
        if (memoryValue === null) return;
        insertValue(memoryValue);
    }

    function memoryAdd() {
        hapticFeedback('light');
        const val = getEvaluatedDisplayValue();
        if (val === null) return;

        memoryValue = (memoryValue || 0) + val;
        updateMemoryBadge();
        expressionDisplay.textContent = `M+ ${val}`;
    }

    function memorySubtract() {
        hapticFeedback('light');
        const val = getEvaluatedDisplayValue();
        if (val === null) return;

        memoryValue = (memoryValue || 0) - val;
        updateMemoryBadge();
        expressionDisplay.textContent = `M− ${val}`;
    }

    // ==========================================
    // HISTORY & STEP-BY-STEP WORK
    // ==========================================

    function getHistoryItemMode(item) {
        if (item.mode) return item.mode;
        if (item.expr && item.expr.startsWith('Solve:')) return 'solver';
        if (item.expr && item.expr.includes('→')) return 'converter';
        if (item.expr && (item.expr.includes('📈') || item.expr.startsWith('f(') || item.expr.startsWith('y='))) return 'graph';
        if (/sin|cos|tan|log|ln|root|√|π|\^|!|nPr|nCr|mean|median|sd|var|lcm|hcf|mod/i.test(item.expr || '')) {
            return 'scientific';
        }
        return 'basic';
    }

    function saveHistory(expr, res, steps, itemMode = null, meta = {}) {
        // De-duplicate exact expression
        history = history.filter(item => item.expr !== expr);

        history.unshift({
            id: Date.now(),
            expr: expr,
            res: res,
            steps: steps || [],
            mode: itemMode || currentMode || 'basic',
            meta: meta || {},
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        });

        if (history.length > 50) {
            history = history.slice(0, 50);
        }

        safeSet(STORAGE_KEY_HISTORY, JSON.stringify(history));

        renderHistory();
    }

    function restoreGraphFromHistory(item) {
        setMode('graph');

        let restoredFns = [];
        if (item.meta && Array.isArray(item.meta.graphFunctions) && item.meta.graphFunctions.length > 0) {
            restoredFns = item.meta.graphFunctions.map((f, i) => ({
                id: `fn_${Date.now()}_${i + 1}`,
                expr: f.expr,
                color: f.color || GRAPH_PALETTE[i % GRAPH_PALETTE.length],
                visible: f.visible !== false
            }));
        } else if (item.expr) {
            const raw = item.expr.replace(/^📈\s*/, '').trim();
            const parts = raw.split(/,\s*(?=f\d*\(x\)\s*=)/i);
            restoredFns = parts.map((part, i) => {
                const clean = part.replace(/^f\d*\(x\)\s*=\s*/i, '').trim();
                return {
                    id: `fn_${Date.now()}_${i + 1}`,
                    expr: clean,
                    color: GRAPH_PALETTE[i % GRAPH_PALETTE.length],
                    visible: true
                };
            }).filter(f => f.expr);
        }

        if (restoredFns.length > 0) {
            graphFunctions = restoredFns;
            activeGraphFnId = graphFunctions[0].id;
        }

        renderKeypad();

        // Close history panel so user is directed to the graph
        if (historyPanel) historyPanel.style.display = 'none';
        if (btnHistoryToggle) btnHistoryToggle.classList.remove('active');

        // Direct user to Function Analysis panel
        const analysisPanel = document.getElementById('graph-analysis-panel');
        if (analysisPanel) {
            analysisPanel.style.display = 'flex';
            setTimeout(() => {
                analysisPanel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
            }, 80);
        }
    }

    function loadHistory() {
        try {
            const saved = safeGet(STORAGE_KEY_HISTORY);
            if (saved) {
                history = JSON.parse(saved);
            }
        } catch (e) {
            history = [];
        }
        renderHistory();
    }

    function clearAllHistory() {
        if (history.length === 0) return;
        const confirmMsg = currentHistoryFilter === 'all'
            ? "Clear all calculation history?"
            : `Clear all ${currentHistoryFilter} history entries?`;

        if (confirm(confirmMsg)) {
            if (currentHistoryFilter === 'all') {
                history = [];
            } else {
                history = history.filter(item => getHistoryItemMode(item) !== currentHistoryFilter);
            }
            safeSet(STORAGE_KEY_HISTORY, JSON.stringify(history));
            renderHistory();
            renderSteps([], '', '');
        }
    }

    function renderHistory() {
        historyList.innerHTML = '';

        if (history.length === 0) {
            historyList.innerHTML = '<p class="empty-state">No calculations yet.</p>';
            return;
        }

        const filtered = history.filter(item => {
            if (currentHistoryFilter === 'all') return true;
            return getHistoryItemMode(item) === currentHistoryFilter;
        });

        if (filtered.length === 0) {
            const filterLabel = currentHistoryFilter === 'converter' ? 'conversion' : currentHistoryFilter;
            historyList.innerHTML = `<p class="empty-state">No ${filterLabel} calculations yet.</p>`;
            return;
        }

        filtered.forEach(item => {
            const itemMode = getHistoryItemMode(item);
            const card = document.createElement('div');
            card.className = `history-item hist-mode-${itemMode}`;

            // Header containing expression and mode badge
            const headerEl = document.createElement('div');
            headerEl.className = 'hist-item-header';

            const exprEl = document.createElement('div');
            exprEl.className = 'hist-expr';
            const isCustomExpr = itemMode === 'converter' || itemMode === 'graph' || itemMode === 'solver';
            exprEl.textContent = isCustomExpr ? item.expr : `${prettyPrint(item.expr)} =`;

            const modeTag = document.createElement('span');
            modeTag.className = `hist-mode-tag mode-${itemMode}`;
            modeTag.textContent = itemMode === 'converter' ? 'Convert' : (itemMode === 'graph' ? 'Graph' : (itemMode === 'solver' ? 'Solver' : (itemMode === 'scientific' ? 'Scientific' : 'Basic')));

            headerEl.appendChild(exprEl);
            headerEl.appendChild(modeTag);

            const resEl = document.createElement('div');
            resEl.className = 'hist-res';
            resEl.textContent = item.res;

            const actions = document.createElement('div');
            actions.className = 'hist-buttons';

            // Replay Button
            const replayBtn = document.createElement('button');
            replayBtn.type = 'button';
            replayBtn.className = 'hist-action';
            replayBtn.textContent = isCustomExpr ? '↻ Open' : '↻ Replay';
            replayBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                if (itemMode === 'converter') {
                    setMode('converter');
                } else if (itemMode === 'graph') {
                    restoreGraphFromHistory(item);
                } else if (itemMode === 'solver') {
                    restoreSolverFromHistory(item);
                } else {
                    if (currentMode !== itemMode && (itemMode === 'basic' || itemMode === 'scientific')) {
                        setMode(itemMode);
                    }
                    setDisplay(item.expr);
                    expressionDisplay.textContent = '';
                    resultDisplayed = false;
                }
            });

            // Copy Button
            const copyBtn = document.createElement('button');
            copyBtn.type = 'button';
            copyBtn.className = 'hist-action';
            copyBtn.textContent = '📋 Copy';
            copyBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                try {
                    const copyText = (itemMode === 'converter' || itemMode === 'solver') ? `${item.expr} : ${item.res}` : (itemMode === 'graph' ? item.expr : String(item.res));
                    await navigator.clipboard.writeText(copyText);
                    copyBtn.textContent = '✓ Copied';
                    setTimeout(() => copyBtn.textContent = '📋 Copy', 1200);
                } catch (err) {
                    copyBtn.textContent = 'Failed';
                }
            });

            actions.appendChild(replayBtn);
            actions.appendChild(copyBtn);

            card.appendChild(headerEl);
            card.appendChild(resEl);
            card.appendChild(actions);

            // Clicking card body
            card.addEventListener('click', () => {
                if (itemMode === 'converter') {
                    setMode('converter');
                } else if (itemMode === 'graph') {
                    restoreGraphFromHistory(item);
                } else if (itemMode === 'solver') {
                    restoreSolverFromHistory(item);
                } else {
                    if (currentMode !== itemMode && (itemMode === 'basic' || itemMode === 'scientific')) {
                        setMode(itemMode);
                    }
                    expressionDisplay.textContent = prettyPrint(item.expr) + ' =';
                    setDisplay(String(item.res));
                    resultDisplayed = true;
                    const n = Number(item.res);
                    lastResult = Number.isFinite(n) ? n : item.res;
                    lastFraction = Number.isFinite(n) ? MathParser.decimalToFraction(n) : null;
                    if (item.steps && item.steps.length > 0) {
                        renderSteps(item.steps, item.expr, item.res);
                    }
                }
            });

            historyList.appendChild(card);
        });
    }

    function renderSteps(steps, originalExpr, finalRes) {
        stepsList.innerHTML = '';

        if (!steps || steps.length === 0) {
            stepsList.innerHTML = '<p class="empty-state">Perform a multi-step calculation to view step-by-step operations.</p>';
            return;
        }

        const intro = document.createElement('div');
        intro.style.fontSize = '0.82rem';
        intro.style.color = 'var(--text-secondary)';
        intro.style.marginBottom = '6px';
        intro.textContent = `Evaluating: ${prettyPrint(originalExpr)}`;
        stepsList.appendChild(intro);

        steps.forEach((s, idx) => {
            const card = document.createElement('div');
            card.className = 'step-card';

            const header = document.createElement('div');
            header.className = 'step-header';
            header.textContent = typeof s === 'string' ? `Step ${idx + 1}` : `Step ${s.step}`;

            const detail = document.createElement('div');
            detail.textContent = typeof s === 'string' ? s : `${prettyPrint(s.expression)}  ➜  ${prettyPrint(String(s.result))}`;

            card.appendChild(header);
            card.appendChild(detail);
            stepsList.appendChild(card);
        });

        const finalCard = document.createElement('div');
        finalCard.className = 'step-card';
        finalCard.style.borderLeftColor = 'var(--text-primary)';
        finalCard.style.fontWeight = '700';
        finalCard.innerHTML = `<span style="color: var(--text-secondary);">Final Result:</span> ${prettyPrint(String(finalRes))}`;
        stepsList.appendChild(finalCard);
    }

    function exportHistory() {
        const filtered = history.filter(item => {
            if (currentHistoryFilter === 'all') return true;
            return getHistoryItemMode(item) === currentHistoryFilter;
        });

        if (filtered.length === 0) {
            alert("No calculation history to export.");
            return;
        }

        // Format history as clean plain text
        const textSummary = filtered.map(h => {
            const m = getHistoryItemMode(h);
            if (m === 'converter') return `[Convert] ${h.expr} : ${h.res}`;
            if (m === 'graph') return `[GRAPH] ${h.expr} : ${h.res}`;
            return `[${m.toUpperCase()}] ${h.expr} = ${h.res}`;
        }).join('\n');

        // Copy directly or offer prompt
        if (navigator.clipboard) {
            navigator.clipboard.writeText(textSummary).then(() => {
                alert("✓ Calculation history copied to clipboard!");
            }).catch(() => {
                prompt("Copy calculation history:", textSummary);
            });
        } else {
            prompt("Copy calculation history:", textSummary);
        }
    }

    // ==========================================
    // KEYBOARD NAVIGATION & SHORTCUTS
    // ==========================================

    function handleKeyDown(e) {
        // Ignore if focus is in an input field
        if (e.target && e.target.tagName === 'INPUT') {
            if (e.key === 'Enter') {
                if (e.target.closest('.solver-panel')) {
                    executeSolver();
                } else {
                    handleSmartSubmit();
                }
            }
            return;
        }

        if (e.ctrlKey || e.metaKey || e.altKey) return;

        // Also ignore when target is a SELECT, TEXTAREA or BUTTON
        if (e.target && ['SELECT', 'TEXTAREA', 'BUTTON'].includes(e.target.tagName)) {
            return;
        }

        // Ignore while any modal or formula sheet drawer is open
        if (document.querySelector('.modal-backdrop.show') || document.querySelector('.formula-sheet-drawer.open')) {
            return;
        }

        const key = e.key;

        // Numbers 0-9
        if (/^[0-9]$/.test(key)) {
            e.preventDefault();
            appendInput(key);
            return;
        }

        // Decimal point
        if (key === '.') {
            e.preventDefault();
            appendInput('.');
            return;
        }

        // Comma
        if (key === ',') {
            e.preventDefault();
            appendInput(',');
            return;
        }

        // Basic Operators
        if (key === '+' || key === '-' || key === '*' || key === '/') {
            e.preventDefault();
            appendInput(key);
            return;
        }

        // Enter or equals
        if (key === 'Enter' || key === '=') {
            e.preventDefault();
            calculate();
            return;
        }

        // Backspace
        if (key === 'Backspace') {
            e.preventDefault();
            backspace();
            return;
        }

        // Clear (Escape or c / C)
        if (key === 'Escape' || key === 'c' || key === 'C') {
            e.preventDefault();
            clearAll();
            return;
        }

        // Parentheses
        if (key === '(' || key === ')') {
            e.preventDefault();
            appendInput(key);
            return;
        }

        // Percentage
        if (key === '%') {
            e.preventDefault();
            appendInput('%');
            return;
        }

        // Powers / exponents
        if (key === '^') {
            e.preventDefault();
            appendInput('^');
            return;
        }

        // Factorial
        if (key === '!') {
            e.preventDefault();
            appendInput('!');
            return;
        }

        // Scientific Quick Shortcuts (s, t, l, n, p, e, m, r)
        if (currentMode === 'scientific') {
            const lower = key.toLowerCase();
            if (lower === 's') { e.preventDefault(); appendFunction('sin'); return; }
            if (lower === 't') { e.preventDefault(); appendFunction('tan'); return; }
            if (lower === 'l') { e.preventDefault(); appendFunction('log'); return; }
            if (lower === 'n') { e.preventDefault(); appendFunction('ln'); return; }
            if (lower === 'p') { e.preventDefault(); appendInput('π'); return; }
            if (lower === 'e') { e.preventDefault(); appendInput('e'); return; }
        }

        // Memory Shortcuts: 'm' -> M+, 'r' -> MR
        if (key.toLowerCase() === 'm' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            memoryAdd();
            return;
        }
        if (key.toLowerCase() === 'r' && !e.ctrlKey && !e.metaKey) {
            e.preventDefault();
            memoryRecall();
            return;
        }
    }

    // ==========================================
    // PROGRESSIVE WEB APP (PWA) & SERVICE WORKER
    // ==========================================

    function setupPWA() {
        // Register Service Worker for offline caching
        if ('serviceWorker' in navigator) {
            window.addEventListener('load', () => {
                navigator.serviceWorker.register('./sw.js').then((reg) => {
                    console.log('ServiceWorker registered with scope:', reg.scope);
                    // Check for updates periodically
                    setInterval(() => reg.update(), 60 * 60 * 1000); // Check hourly
                }).catch((err) => {
                    console.warn('ServiceWorker registration failed:', err);
                });
            });
        }

        const btnSidebarInstall = document.getElementById('btn-pwa-install-sidebar');
        const isStandalone = (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches)
            || navigator.standalone === true;

        // Check if iOS
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        // If already running in standalone installed mode, hide install button
        if (isStandalone) {
            if (btnSidebarInstall) btnSidebarInstall.classList.add('installed');
        }

        // Listen for beforeinstallprompt event (Chromium, Android, Edge, Desktop Chrome)
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            deferredInstallPrompt = e;
            // Show install button when prompt is available
            if (btnSidebarInstall) btnSidebarInstall.classList.add('show');
        });

        // App installed event
        window.addEventListener('appinstalled', () => {
            if (btnSidebarInstall) btnSidebarInstall.classList.add('installed');
            deferredInstallPrompt = null;
            console.log('Calculator PWA installed successfully');
        });

        // Check if PWA is installable after a delay (for browsers that don't fire beforeinstallprompt immediately)
        setTimeout(() => {
            if (!deferredInstallPrompt && !isStandalone && !isIOS) {
                // Show install button anyway - user can click to trigger native browser install
                if (btnSidebarInstall) btnSidebarInstall.classList.add('show');
            }
        }, 3000);
    }

    // ==========================================
    // MODAL DIALOG CONTROLS
    // ==========================================

    function openModal(modal) {
        if (modal) modal.classList.add('show');
    }

    function closeModal(modal) {
        if (modal) modal.classList.remove('show');
    }

    // ==========================================
    // UNIT CONVERTER UI
    // ==========================================

    // Converter state (persisted across mode switches within a session)
    let convCategory = 'length';
    let convFromUnit = 'km';
    let convToUnit   = 'm';
    let convInputVal = '';

    function renderConverterUI() {
        // The keypad div is repurposed as the converter container in this mode.
        // We give it a dedicated class for styling.
        keypad.className = 'converter-panel';
        keypad.innerHTML = '';

        // ---- Category selector row ----
        const catRow = document.createElement('div');
        catRow.className = 'conv-category-row';
        catRow.setAttribute('role', 'tablist');
        catRow.setAttribute('aria-label', 'Unit categories');

        UnitConverter.getCategoryKeys().forEach(key => {
            const cat = UnitConverter.getCategory(key);
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'conv-cat-btn' + (key === convCategory ? ' active' : '');
            btn.setAttribute('role', 'tab');
            btn.setAttribute('aria-selected', key === convCategory);
            btn.setAttribute('title', cat.label);
            btn.innerHTML = `<span class="conv-cat-icon">${cat.icon}</span><span class="conv-cat-label">${cat.label}</span>`;
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                convCategory = key;
                // Reset units to first two of the new category
                const unitKeys = UnitConverter.getUnitKeys(key);
                convFromUnit = unitKeys[0];
                convToUnit   = unitKeys[1] || unitKeys[0];
                convInputVal = '';
                renderConverterUI();
            });
            catRow.appendChild(btn);
        });
        keypad.appendChild(catRow);

        // ---- Main conversion card ----
        const card = document.createElement('div');
        card.className = 'conv-card';

        const cat = UnitConverter.getCategory(convCategory);
        const unitKeys = UnitConverter.getUnitKeys(convCategory);

        // FROM row
        const fromRow = document.createElement('div');
        fromRow.className = 'conv-row';

        const fromLabel = document.createElement('label');
        fromLabel.className = 'conv-field-label';
        fromLabel.textContent = 'From';
        fromLabel.setAttribute('for', 'conv-from-select');

        const fromSelect = document.createElement('select');
        fromSelect.id = 'conv-from-select';
        fromSelect.className = 'conv-select';
        fromSelect.setAttribute('aria-label', 'Convert from unit');
        unitKeys.forEach(uk => {
            const u = UnitConverter.getUnit(convCategory, uk);
            const opt = document.createElement('option');
            opt.value = uk;
            opt.textContent = `${u.label} (${u.symbol})`;
            if (uk === convFromUnit) opt.selected = true;
            fromSelect.appendChild(opt);
        });

        const fromInput = document.createElement('input');
        fromInput.id = 'conv-from-input';
        fromInput.type = 'text';
        fromInput.inputMode = 'decimal';
        fromInput.className = 'conv-input';
        fromInput.placeholder = 'Enter value…';
        fromInput.value = convInputVal;
        fromInput.setAttribute('aria-label', 'Value to convert');
        fromInput.setAttribute('autocomplete', 'off');

        fromRow.appendChild(fromLabel);
        fromRow.appendChild(fromSelect);
        fromRow.appendChild(fromInput);

        // Swap button
        const swapBtn = document.createElement('button');
        swapBtn.type = 'button';
        swapBtn.className = 'conv-swap-btn';
        swapBtn.setAttribute('aria-label', 'Swap from and to units');
        swapBtn.title = 'Swap units';
        swapBtn.innerHTML = '⇅';

        // TO row
        const toRow = document.createElement('div');
        toRow.className = 'conv-row';

        const toLabel = document.createElement('label');
        toLabel.className = 'conv-field-label';
        toLabel.textContent = 'To';
        toLabel.setAttribute('for', 'conv-to-select');

        const toSelect = document.createElement('select');
        toSelect.id = 'conv-to-select';
        toSelect.className = 'conv-select';
        toSelect.setAttribute('aria-label', 'Convert to unit');
        unitKeys.forEach(uk => {
            const u = UnitConverter.getUnit(convCategory, uk);
            const opt = document.createElement('option');
            opt.value = uk;
            opt.textContent = `${u.label} (${u.symbol})`;
            if (uk === convToUnit) opt.selected = true;
            toSelect.appendChild(opt);
        });

        const toResult = document.createElement('div');
        toResult.id = 'conv-result';
        toResult.className = 'conv-result';
        toResult.setAttribute('aria-live', 'polite');
        toResult.setAttribute('aria-label', 'Conversion result');
        toResult.textContent = '—';

        toRow.appendChild(toLabel);
        toRow.appendChild(toSelect);
        toRow.appendChild(toResult);

        // Formula / explanation line
        const formulaLine = document.createElement('div');
        formulaLine.id = 'conv-formula';
        formulaLine.className = 'conv-formula';

        // Copy result button
        const copyBtn = document.createElement('button');
        copyBtn.type = 'button';
        copyBtn.className = 'conv-copy-btn';
        copyBtn.setAttribute('aria-label', 'Copy result to clipboard');
        copyBtn.title = 'Copy result';
        copyBtn.innerHTML = '📋 Copy result';

        card.appendChild(fromRow);
        card.appendChild(swapBtn);
        card.appendChild(toRow);
        card.appendChild(formulaLine);
        card.appendChild(copyBtn);
        keypad.appendChild(card);

        // ---- Number Pad for the converter ----
        if (convCategory === 'numeral') {
            const hexRow = document.createElement('div');
            hexRow.className = 'conv-hex-row';
            const hexKeys = ['A', 'B', 'C', 'D', 'E', 'F'];
            hexKeys.forEach(hk => {
                const hBtn = document.createElement('button');
                hBtn.type = 'button';
                hBtn.textContent = hk;
                hBtn.className = 'conv-hex-btn';
                if (convFromUnit !== 'hex') {
                    hBtn.disabled = true;
                }
                hBtn.addEventListener('click', () => {
                    handleConvNumpad(hk, fromInput, toResult, formulaLine);
                });
                hexRow.appendChild(hBtn);
            });
            keypad.appendChild(hexRow);
        }

        const numpad = document.createElement('div');
        numpad.className = 'conv-numpad';

        const numpadKeys = [
            '7','8','9','⌫',
            '4','5','6','C',
            '1','2','3','+/-',
            '0','.','','='
        ];

        function isKeyAllowed(k) {
            if (convCategory !== 'numeral') return true;
            if (k === 'C' || k === '⌫' || k === '=' || k === '') return true;
            if (k === '.' || k === '+/-') return false; // Numeral systems are whole non-negative in this converter
            if (convFromUnit === 'bin') {
                return k === '0' || k === '1';
            }
            if (convFromUnit === 'oct') {
                return /^[0-7]$/.test(k);
            }
            if (convFromUnit === 'dec') {
                return /^[0-9]$/.test(k);
            }
            if (convFromUnit === 'hex') {
                return /^[0-9A-Fa-f]$/.test(k);
            }
            return true;
        }

        numpadKeys.forEach(k => {
            if (k === '') {
                const spacer = document.createElement('span');
                spacer.className = 'conv-num-btn conv-num-btn--empty';
                spacer.setAttribute('aria-hidden', 'true');
                numpad.appendChild(spacer);
                return;
            }

            const btn = document.createElement('button');
            btn.type = 'button';
            btn.textContent = k;
            btn.className = 'conv-num-btn';
            if (k === '=') btn.className += ' conv-num-btn--equal';
            if (k === 'C') btn.className += ' conv-num-btn--clear';
            if (k === '⌫') btn.className += ' conv-num-btn--back';
            if (!isKeyAllowed(k)) { btn.disabled = true; }

            btn.addEventListener('click', () => {
                handleConvNumpad(k, fromInput, toResult, formulaLine);
            });
            numpad.appendChild(btn);
        });
        keypad.appendChild(numpad);

        // ---- Wire up live events ----

        // Live convert as user types in the from input
        fromInput.addEventListener('input', () => {
            if (convCategory === 'numeral') {
                fromInput.value = fromInput.value.toUpperCase();
            }
            convInputVal = fromInput.value;
            runConversion(fromInput, toResult, formulaLine);
        });

        fromInput.addEventListener('keydown', e => {
            if (e.key === 'Enter') runConversion(fromInput, toResult, formulaLine);
        });

        fromSelect.addEventListener('change', () => {
            hapticFeedback('light');
            convFromUnit = fromSelect.value;
            if (convCategory === 'numeral') {
                renderConverterUI();
            } else {
                runConversion(fromInput, toResult, formulaLine);
            }
        });

        toSelect.addEventListener('change', () => {
            hapticFeedback('light');
            convToUnit = toSelect.value;
            runConversion(fromInput, toResult, formulaLine);
        });

        swapBtn.addEventListener('click', () => {
            hapticFeedback('light');
            const prevFrom = convFromUnit;
            const prevTo   = convToUnit;
            // If there's already a result, swap and use result as new input
            const resultEl = document.getElementById('conv-result');
            const resultText = resultEl ? resultEl.dataset.rawValue : '';

            convFromUnit = prevTo;
            convToUnit   = prevFrom;
            if (resultText && resultText !== '' && resultText !== '—') {
                convInputVal = resultText;
            }
            renderConverterUI();
        });

        copyBtn.addEventListener('click', () => {
            hapticFeedback('light');
            const resultEl = document.getElementById('conv-result');
            if (!resultEl || !resultEl.dataset.rawValue) return;
            const fromUnitDef = UnitConverter.getUnit(convCategory, convFromUnit);
            const toUnitDef   = UnitConverter.getUnit(convCategory, convToUnit);
            const text = `${convInputVal} ${fromUnitDef ? fromUnitDef.symbol : convFromUnit} = ${resultEl.dataset.rawValue} ${toUnitDef ? toUnitDef.symbol : convToUnit}`;
            navigator.clipboard.writeText(text).then(() => {
                copyBtn.innerHTML = '✅ Copied!';
                setTimeout(() => { copyBtn.innerHTML = '📋 Copy result'; }, 1800);
            }).catch(() => {
                copyBtn.innerHTML = '⚠ Failed';
                setTimeout(() => { copyBtn.innerHTML = '📋 Copy result'; }, 1800);
            });
        });

        // Focus from input for immediate typing
        setTimeout(() => fromInput.focus(), 50);

        // Run initial conversion if there's a value
        if (convInputVal !== '') {
            runConversion(fromInput, toResult, formulaLine);
        }
    }

    /**
     * Run a conversion and update the result and formula elements.
     */
    function runConversion(fromInput, toResult, formulaLine) {
        const rawVal = fromInput.value.trim();

        if (rawVal === '') {
            toResult.textContent = '—';
            toResult.dataset.rawValue = '';
            toResult.classList.remove('conv-result--error');
            formulaLine.textContent = '';
            return;
        }

        const isNumeral = convCategory === 'numeral';
        const num = isNumeral ? rawVal : parseFloat(rawVal);

        if (!isNumeral && isNaN(num)) {
            toResult.textContent = '—';
            toResult.dataset.rawValue = '';
            toResult.classList.remove('conv-result--error');
            formulaLine.textContent = '';
            return;
        }

        const fromUnitDef = UnitConverter.getUnit(convCategory, convFromUnit);
        const toUnitDef   = UnitConverter.getUnit(convCategory, convToUnit);
        const conv = UnitConverter.convert(num, convCategory, convFromUnit, convToUnit);

        if (conv.error) {
            toResult.textContent = conv.error;
            toResult.dataset.rawValue = '';
            toResult.classList.add('conv-result--error');
            formulaLine.textContent = '';
            return;
        }

        toResult.classList.remove('conv-result--error');
        toResult.textContent = `${conv.formatted} ${toUnitDef ? toUnitDef.symbol : convToUnit}`;
        toResult.dataset.rawValue = conv.formatted;

        // Formula line: show the conversion expression
        if (fromUnitDef && toUnitDef) {
            formulaLine.textContent = `${rawVal} ${fromUnitDef.symbol} = ${conv.formatted} ${toUnitDef.symbol}`;
        }

        // Log to history panel
        logConversionToHistory(rawVal, fromUnitDef, conv.formatted, toUnitDef);
    }

    /**
     * Handle numpad button presses for the converter input.
     */
    function handleConvNumpad(key, fromInput, toResult, formulaLine) {
        hapticFeedback('light');
        let val = fromInput.value;

        if (key === 'C') {
            val = '';
            convInputVal = '';
        } else if (key === '⌫') {
            val = val.slice(0, -1);
            convInputVal = val;
        } else if (key === '+/-') {
            if (val.startsWith('-')) {
                val = val.slice(1);
            } else if (val !== '' && val !== '0') {
                val = '-' + val;
            }
            convInputVal = val;
        } else if (key === '=') {
            // Just run the conversion (same as Enter)
            runConversion(fromInput, toResult, formulaLine);
            return;
        } else if (key === '.') {
            if (!val.includes('.')) {
                val = val === '' ? '0.' : val + '.';
            }
            convInputVal = val;
        } else if (/^[0-9]$/.test(key)) {
            if (val === '0') {
                val = key; // Replace leading zero
            } else {
                val = val + key;
            }
            convInputVal = val;
        } else if (/^[A-Fa-f]$/.test(key)) {
            val = val + key.toUpperCase();
            convInputVal = val;
        }

        fromInput.value = val;
        runConversion(fromInput, toResult, formulaLine);
    }

    /**
     * Log a converter result to the history panel (distinct style from calculator history).
     */
    let lastLoggedConversion = '';
    function logConversionToHistory(num, fromUnitDef, resultFormatted, toUnitDef) {
        if (!fromUnitDef || !toUnitDef) return;
        const key = `${num}${fromUnitDef.symbol}${toUnitDef.symbol}`;
        if (key === lastLoggedConversion) return; // Debounce identical logs
        lastLoggedConversion = key;

        saveHistory(
            `${cat_icon(convCategory)} ${fromUnitDef.label} → ${toUnitDef.label}`,
            `${num} ${fromUnitDef.symbol} = ${resultFormatted} ${toUnitDef.symbol}`,
            [],
            'converter'
        );
    }

    function cat_icon(catKey) {
        const cat = UnitConverter.getCategory(catKey);
        return cat ? cat.icon : '⇄';
    }

    // ==========================================
    // GRAPHING MODE CONTROLLER
    // ==========================================

    const GRAPH_PALETTE = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ec4899', '#f97316'];
    let graphPlotterInstance = null;
    let graphFunctions = [
        { id: 'fn_1', expr: '', color: '#2563eb', visible: true }
    ];
    let activeGraphFnId = 'fn_1';
    let graphAngleSetting = 'RAD';

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function renderGraphUI() {
        keypad.className = 'graph-panel';
        keypad.innerHTML = `
            <!-- Viewport & Canvas -->
            <div class="graph-viewport-wrap" id="graph-viewport-wrap">
                <canvas id="graph-canvas" class="graph-canvas" aria-label="Interactive 2D function graph"></canvas>
                <div class="graph-floating-controls">
                    <button type="button" class="graph-tool-btn" id="graph-zoom-in" title="Zoom In (+)" aria-label="Zoom in">+</button>
                    <button type="button" class="graph-tool-btn" id="graph-zoom-out" title="Zoom Out (−)" aria-label="Zoom out">−</button>
                    <button type="button" class="graph-tool-btn" id="graph-reset" title="Reset View (⟲)" aria-label="Reset view">⟲</button>
                    <button type="button" class="graph-tool-btn" id="graph-toggle-table" title="Table of Values (📊)" aria-label="Table of values">📊</button>
                    <button type="button" class="graph-tool-btn" id="graph-export-img" title="Save Graph Image (📸)" aria-label="Export image">📸</button>
                </div>
                <button type="button" class="graph-angle-badge" id="graph-angle-toggle" title="Click to toggle RAD/DEG">${graphAngleSetting}</button>
            </div>

            <!-- Table of Values Drawer -->
            <div class="graph-table-drawer" id="graph-table-drawer">
                <table class="graph-table" id="graph-table">
                    <!-- Injected dynamically -->
                </table>
            </div>

            <!-- Dynamic Function Input Fields -->
            <div class="graph-inputs-list" id="graph-inputs-list">
                <!-- Rendered dynamically -->
            </div>

            <!-- Quick Presets -->
            <div class="graph-presets-bar">
                <span class="graph-preset-label">Presets:</span>
                <button type="button" class="graph-preset-chip" data-preset="x^2 - 4">x² − 4</button>
                <button type="button" class="graph-preset-chip" data-preset="sin(x)">sin(x)</button>
                <button type="button" class="graph-preset-chip" data-preset="cos(x)">cos(x)</button>
                <button type="button" class="graph-preset-chip" data-preset="1/x">1/x</button>
                <button type="button" class="graph-preset-chip" data-preset="x^3 - 3x">x³ − 3x</button>
                <button type="button" class="graph-preset-chip" data-preset="sqrt(x)">√x</button>
                <button type="button" class="graph-preset-chip" data-preset="abs(x)">|x|</button>
                <button type="button" class="graph-preset-chip" data-preset="2^x">2ˣ</button>
                <button type="button" class="graph-preset-chip" data-preset="tan(x)">tan(x)</button>
                <button type="button" class="graph-preset-chip" data-preset="2x + y >= 30">2x + y ≥ 30</button>
                <button type="button" class="graph-preset-chip" data-preset="x^2 + y^2 = 25">x² + y² = 25</button>
                <button type="button" class="graph-preset-chip" data-preset="y <= x^2 - 4">y ≤ x²−4</button>
                <button type="button" class="graph-preset-chip" data-preset="x <= 2">x ≤ 2</button>
            </div>

            <!-- On-Screen Graph Keypad -->
            <div class="graph-keypad" role="group" aria-label="Graphing calculator keypad">
                <button type="button" class="graph-key-btn key-var" data-key="x">x</button>
                <button type="button" class="graph-key-btn" data-key="^">^</button>
                <button type="button" class="graph-key-btn" data-key="²">x²</button>
                <button type="button" class="graph-key-btn" data-key="sqrt(">√</button>
                <button type="button" class="graph-key-btn" data-key="(">(</button>
                <button type="button" class="graph-key-btn" data-key=")">)</button>

                <button type="button" class="graph-key-btn" data-key="sin(">sin</button>
                <button type="button" class="graph-key-btn" data-key="cos(">cos</button>
                <button type="button" class="graph-key-btn" data-key="tan(">tan</button>
                <button type="button" class="graph-key-btn" data-key="π">π</button>
                <button type="button" class="graph-key-btn" data-key="e">e</button>
                <button type="button" class="graph-key-btn" data-key="⌫">⌫</button>

                <button type="button" class="graph-key-btn" data-key="7">7</button>
                <button type="button" class="graph-key-btn" data-key="8">8</button>
                <button type="button" class="graph-key-btn" data-key="9">9</button>
                <button type="button" class="graph-key-btn" data-key="/">÷</button>
                <button type="button" class="graph-key-btn" data-key="*">×</button>
                <button type="button" class="graph-key-btn" data-key="C">C</button>

                <button type="button" class="graph-key-btn" data-key="4">4</button>
                <button type="button" class="graph-key-btn" data-key="5">5</button>
                <button type="button" class="graph-key-btn" data-key="6">6</button>
                <button type="button" class="graph-key-btn" data-key="-">−</button>
                <button type="button" class="graph-key-btn" data-key="+">+</button>
                <button type="button" class="graph-key-btn key-plot" data-key="plot">Graph</button>

                <button type="button" class="graph-key-btn" data-key="1">1</button>
                <button type="button" class="graph-key-btn" data-key="2">2</button>
                <button type="button" class="graph-key-btn" data-key="3">3</button>
                <button type="button" class="graph-key-btn" data-key="0">0</button>
                <button type="button" class="graph-key-btn" data-key=".">.</button>
                <button type="button" class="graph-key-btn" data-key="switch_fn" title="Cycle focus between active functions">fₙ</button>

                <button type="button" class="graph-key-btn key-var" data-key="y">y</button>
                <button type="button" class="graph-key-btn" data-key="<">&lt;</button>
                <button type="button" class="graph-key-btn" data-key="<=">&le;</button>
                <button type="button" class="graph-key-btn" data-key=">">&gt;</button>
                <button type="button" class="graph-key-btn" data-key=">=">&ge;</button>
                <button type="button" class="graph-key-btn" data-key=",">,</button>
            </div>
        `;

        setupGraphControls();
    }

    function setupGraphControls() {
        const canvas = document.getElementById('graph-canvas');
        if (!canvas || typeof Grapher === 'undefined') return;

        if (graphPlotterInstance) {
            graphPlotterInstance.destroy();
        }

        graphPlotterInstance = new Grapher.Plotter(canvas, {
            angleMode: graphAngleSetting,
            onKeyPointsUpdated: (keyPoints, domainNotes) => {
                updateAnalysisPanel(keyPoints, domainNotes);
            }
        });

        const angleToggleBadge = document.getElementById('graph-angle-toggle');
        const tableDrawer = document.getElementById('graph-table-drawer');
        const tableEl = document.getElementById('graph-table');

        function updatePlot(saveToHistory = false) {
            let hasValidFn = false;

            graphFunctions.forEach(fn => {
                const errEl = document.getElementById(`graph-error-${fn.id}`);
                if (fn.expr.trim() && fn.visible) {
                    const compiled = MathParser.compile(fn.expr, { angleMode: graphAngleSetting });
                    if (compiled.error) {
                        if (errEl) {
                            errEl.textContent = compiled.error;
                            errEl.style.display = 'block';
                        }
                    } else {
                        if (errEl) errEl.style.display = 'none';
                        hasValidFn = true;
                    }
                } else {
                    if (errEl) errEl.style.display = 'none';
                }
            });

            graphPlotterInstance.setFunctions(graphFunctions);

            // Conditionally show/hide Function Analysis based on whether user has inputted functions
            const graphAnalysisPanel = document.getElementById('graph-analysis-panel');
            if (graphAnalysisPanel) {
                graphAnalysisPanel.style.display = (currentMode === 'graph' && hasValidFn) ? 'flex' : 'none';
            }

            if (saveToHistory && hasValidFn) {
                const visibleFns = graphFunctions.filter(f => f.visible && f.expr.trim());
                if (visibleFns.length > 0) {
                    const fnLabels = visibleFns.map((f) => `f${graphFunctions.indexOf(f) + 1} = ${f.expr}`).join(', ');
                    const resSummary = `${visibleFns.length} function${visibleFns.length > 1 ? 's' : ''} plotted`;
                    saveHistory(
                        `📈 ${fnLabels}`,
                        resSummary,
                        [],
                        'graph',
                        {
                            graphFunctions: visibleFns.map(f => ({ expr: f.expr, color: f.color, visible: true }))
                        }
                    );
                }
            }

            if (tableDrawer && tableDrawer.classList.contains('active')) {
                renderValueTable();
            }
        }

        renderGraphInputsList(updatePlot);

        function renderValueTable() {
            const rows = graphPlotterInstance.generateTable(-5, 5, 1);
            const activeFns = graphPlotterInstance.functions.filter(f => f.visible && !f.compiled.error);

            let html = `<thead><tr><th>x</th>`;
            activeFns.forEach((fn) => {
                const fullIdx = graphPlotterInstance.functions.indexOf(fn);
                html += `<th>f${fullIdx + 1}</th>`;
            });
            html += `</tr></thead><tbody>`;

            rows.forEach(r => {
                html += `<tr><td><strong>${r.x}</strong></td>`;
                r.values.forEach(v => {
                    html += `<td>${v}</td>`;
                });
                html += `</tr>`;
            });
            html += `</tbody>`;
            tableEl.innerHTML = html;
        }

        // Floating Tools
        document.getElementById('graph-zoom-in').addEventListener('click', () => graphPlotterInstance.zoomIn());
        document.getElementById('graph-zoom-out').addEventListener('click', () => graphPlotterInstance.zoomOut());
        document.getElementById('graph-reset').addEventListener('click', () => graphPlotterInstance.resetView());

        document.getElementById('graph-toggle-table').addEventListener('click', function () {
            const isActive = tableDrawer.classList.toggle('active');
            this.classList.toggle('active', isActive);
            if (isActive) {
                renderValueTable();
            }
        });

        document.getElementById('graph-export-img').addEventListener('click', () => {
            const dataUrl = graphPlotterInstance.exportImage();
            const link = document.createElement('a');
            link.download = `graph-${Date.now()}.png`;
            link.href = dataUrl;
            document.body.appendChild(link);
            link.click();
            link.remove();
        });

        // Angle Badge Toggle
        angleToggleBadge.addEventListener('click', () => {
            graphAngleSetting = graphAngleSetting === 'RAD' ? 'DEG' : 'RAD';
            angleToggleBadge.textContent = graphAngleSetting;
            graphPlotterInstance.setAngleMode(graphAngleSetting);
            updatePlot();
        });

        // Presets Chips
        document.querySelectorAll('.graph-preset-chip').forEach(chip => {
            chip.addEventListener('click', () => {
                const preset = chip.dataset.preset;
                let targetFn = graphFunctions.find(f => f.id === activeGraphFnId);
                if (!targetFn) targetFn = graphFunctions[0];
                targetFn.expr = preset;
                targetFn.visible = true;

                const inputEl = document.querySelector(`.graph-fn-input[data-fn-id="${targetFn.id}"]`);
                if (inputEl) {
                    inputEl.value = preset;
                    inputEl.focus();
                }
                updatePlot(true);
            });
        });

        // On-Screen Keypad Handling
        document.querySelectorAll('.graph-key-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                const key = btn.dataset.key;
                let targetFn = graphFunctions.find(f => f.id === activeGraphFnId);
                if (!targetFn) targetFn = graphFunctions[0];
                const targetInput = document.querySelector(`.graph-fn-input[data-fn-id="${targetFn.id}"]`);
                if (!targetInput) return;

                if (key === 'plot') {
                    updatePlot(true);
                    return;
                }

                if (key === 'switch_fn') {
                    const curIdx = graphFunctions.findIndex(f => f.id === activeGraphFnId);
                    const nextIdx = (curIdx + 1) % graphFunctions.length;
                    activeGraphFnId = graphFunctions[nextIdx].id;
                    const nextInput = document.querySelector(`.graph-fn-input[data-fn-id="${activeGraphFnId}"]`);
                    if (nextInput) nextInput.focus();
                    return;
                }

                if (key === 'C') {
                    targetInput.value = '';
                } else if (key === '⌫') {
                    const start = targetInput.selectionStart || targetInput.value.length;
                    const end = targetInput.selectionEnd || targetInput.value.length;
                    if (start === end && start > 0) {
                        targetInput.value = targetInput.value.slice(0, start - 1) + targetInput.value.slice(end);
                        targetInput.setSelectionRange(start - 1, start - 1);
                    } else if (start !== end) {
                        targetInput.value = targetInput.value.slice(0, start) + targetInput.value.slice(end);
                        targetInput.setSelectionRange(start, start);
                    }
                } else {
                    const insertVal = key;
                    const start = targetInput.selectionStart || targetInput.value.length;
                    const end = targetInput.selectionEnd || targetInput.value.length;
                    targetInput.value = targetInput.value.slice(0, start) + insertVal + targetInput.value.slice(end);
                    const newPos = start + insertVal.length;
                    targetInput.setSelectionRange(newPos, newPos);
                }

                targetFn.expr = targetInput.value;
                targetInput.focus();
                updatePlot();
            });
        });

        // Initial Plot Render
        updatePlot();
    }

    function renderGraphInputsList(updatePlotFn) {
        const container = document.getElementById('graph-inputs-list');
        if (!container) return;

        let html = '';
        graphFunctions.forEach((fn, idx) => {
            const fnLabel = `f${idx + 1}`;
            html += `
                <div class="graph-fn-item-wrap" data-fn-id="${fn.id}">
                    <div class="graph-fn-row ${fn.visible ? '' : 'hidden-fn'}" id="graph-row-${fn.id}">
                        <span class="graph-fn-label">
                            <span class="graph-fn-dot" style="background: ${fn.visible ? fn.color : '#94a3b8'};"></span>
                            ${fnLabel}
                        </span>
                        <input type="text" class="graph-fn-input" data-fn-id="${fn.id}" value="${escapeHtml(fn.expr)}" placeholder="e.g. 2x + y >= 30, sin(x), or x^2 - 4" autocomplete="off" spellcheck="false" />
                        <div class="graph-fn-actions">
                            <button type="button" class="graph-fn-visibility-btn ${fn.visible ? '' : 'hidden'}" data-toggle-visibility="${fn.id}" title="${fn.visible ? 'Hide curve' : 'Show curve'}">
                                ${fn.visible ? '👁️' : '🚫'}
                            </button>
                            <button type="button" class="graph-fn-toggle-btn" data-remove-fn="${fn.id}" title="${graphFunctions.length > 1 ? 'Delete function' : 'Clear input'}">✕</button>
                        </div>
                    </div>
                    <div class="graph-fn-error" id="graph-error-${fn.id}" style="display: none;"></div>
                </div>
            `;
        });

        html += `
            <button type="button" class="graph-add-fn-btn" id="graph-btn-add-fn">
                + Add Function (${`f${graphFunctions.length + 1}`})
            </button>
        `;

        container.innerHTML = html;
        bindGraphInputEvents(updatePlotFn);
    }

    function bindGraphInputEvents(updatePlotFn) {
        const container = document.getElementById('graph-inputs-list');
        if (!container) return;

        container.querySelectorAll('.graph-fn-input').forEach(input => {
            input.addEventListener('focus', () => {
                activeGraphFnId = input.dataset.fnId;
            });
            input.addEventListener('input', () => {
                const fn = graphFunctions.find(f => f.id === input.dataset.fnId);
                if (fn) {
                    fn.expr = input.value;
                    if (updatePlotFn) updatePlotFn(false);
                }
            });
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') {
                    if (updatePlotFn) updatePlotFn(true);
                }
            });
        });

        container.querySelectorAll('[data-toggle-visibility]').forEach(btn => {
            btn.addEventListener('click', () => {
                const fn = graphFunctions.find(f => f.id === btn.dataset.toggleVisibility);
                if (fn) {
                    fn.visible = !fn.visible;
                    renderGraphInputsList(updatePlotFn);
                    if (updatePlotFn) updatePlotFn(false);
                }
            });
        });

        container.querySelectorAll('[data-remove-fn]').forEach(btn => {
            btn.addEventListener('click', () => {
                const targetId = btn.dataset.removeFn;
                if (graphFunctions.length > 1) {
                    graphFunctions = graphFunctions.filter(f => f.id !== targetId);
                    if (activeGraphFnId === targetId) {
                        activeGraphFnId = graphFunctions[0].id;
                    }
                } else {
                    graphFunctions[0].expr = '';
                }
                renderGraphInputsList(updatePlotFn);
                if (updatePlotFn) updatePlotFn(false);
            });
        });

        const addBtn = document.getElementById('graph-btn-add-fn');
        if (addBtn) {
            addBtn.addEventListener('click', () => {
                const newId = `fn_${Date.now()}`;
                const nextColor = GRAPH_PALETTE[graphFunctions.length % GRAPH_PALETTE.length];
                graphFunctions.push({
                    id: newId,
                    expr: '',
                    color: nextColor,
                    visible: true
                });
                activeGraphFnId = newId;
                renderGraphInputsList(updatePlotFn);
                if (updatePlotFn) updatePlotFn(false);
                const newInput = container.querySelector(`.graph-fn-input[data-fn-id="${newId}"]`);
                if (newInput) newInput.focus();
            });
        }
    }

    function updateAnalysisPanel(keyPoints, domainNotes) {
        const kpList = document.getElementById('analysis-kp-list');
        const countBadge = document.getElementById('analysis-kp-count');
        const notesList = document.getElementById('analysis-domain-notes');

        if (countBadge) {
            countBadge.textContent = keyPoints.length;
        }

        if (kpList) {
            if (keyPoints.length === 0) {
                kpList.innerHTML = '<p class="empty-state">No critical points in visible viewport range. Zoom or pan to inspect.</p>';
            } else {
                kpList.innerHTML = keyPoints.map(kp => {
                    const typeLabel = kp.type === 'root' ? 'Root (X-Int)' :
                                     (kp.type === 'intercept' ? 'Y-Intercept' :
                                     (kp.type === 'intersection' ? 'Intersection' :
                                     (kp.type === 'max' ? 'Local Max' : 'Local Min')));

                    return `
                        <div class="analysis-kp-item" data-kp-x="${kp.x}" data-kp-y="${kp.y}" title="Click to center on point">
                            <div class="analysis-kp-tag">
                                <span class="analysis-kp-dot ${kp.type}"></span>
                                <span>${typeLabel}</span>
                            </div>
                            <span class="analysis-kp-coords">(${kp.x}, ${kp.y})</span>
                        </div>
                    `;
                }).join('');

                // Clicking any critical point centers the graph on it!
                kpList.querySelectorAll('.analysis-kp-item').forEach(item => {
                    item.addEventListener('click', () => {
                        const x = parseFloat(item.dataset.kpX);
                        const y = parseFloat(item.dataset.kpY);
                        if (Number.isFinite(x) && Number.isFinite(y) && graphPlotterInstance) {
                            graphPlotterInstance.centerAt(x, y);
                        }
                    });
                });
            }
        }

        if (notesList) {
            if (!domainNotes || domainNotes.length === 0) {
                notesList.innerHTML = '<p class="empty-state">No active functions to analyze.</p>';
            } else {
                notesList.innerHTML = domainNotes.map(note => `
                    <div class="analysis-note-card ${note.type === 'asymptote' ? 'asymptote-warning' : ''}">
                        <strong>${escapeHtml(note.fnName)}: ${escapeHtml(note.title)}</strong>
                        <span>${escapeHtml(note.message)}</span>
                    </div>
                `).join('');
            }
        }
    }

    // ==========================================
    // ALGEBRAIC EQUATION SOLVER UI & CONTROLS
    // ==========================================

    let solverSubTab = 'single'; // 'single' | 'system2' | 'system3'
    let solverInputs = {
        single: '',
        system2_1: '',
        system2_2: '',
        system3_1: '',
        system3_2: '',
        system3_3: ''
    };
    let solverLastResult = null;
    let solverShowSteps = true;
    let executeSolver = () => {};

    function restoreSolverFromHistory(item) {
        setMode('solver');
        if (item.meta && item.meta.subTab) {
            solverSubTab = item.meta.subTab;
            if (item.meta.inputs) {
                solverInputs = Object.assign(solverInputs, item.meta.inputs);
            }
        } else if (item.expr) {
            const clean = item.expr.replace(/^Solve:\s*/, '').trim();
            if (clean.includes(';')) {
                const parts = clean.split(';').map(p => p.trim());
                if (parts.length === 2) {
                    solverSubTab = 'system2';
                    solverInputs.system2_1 = parts[0];
                    solverInputs.system2_2 = parts[1];
                } else if (parts.length === 3) {
                    solverSubTab = 'system3';
                    solverInputs.system3_1 = parts[0];
                    solverInputs.system3_2 = parts[1];
                    solverInputs.system3_3 = parts[2];
                }
            } else {
                solverSubTab = 'single';
                solverInputs.single = clean;
            }
        }
        renderKeypad();
        executeSolver(false);
        if (historyPanel) historyPanel.style.display = 'none';
        if (btnHistoryToggle) btnHistoryToggle.classList.remove('active');
    }

    function renderSolverUI() {
        keypad.className = 'solver-panel';
        keypad.innerHTML = `
            <div class="solver-container">
                <!-- Solver Sub-Tabs -->
                <div class="solver-tabs-wrap">
                    <div class="solver-tabs" role="tablist" aria-label="Equation solver categories">
                        <button type="button" class="solver-tab-btn ${solverSubTab === 'single' ? 'active' : ''}" data-solver-tab="single" role="tab" aria-selected="${solverSubTab === 'single'}">
                            <span class="solver-tab-main">1-Var</span>
                            <span class="solver-tab-sub">Single (x)</span>
                        </button>
                        <button type="button" class="solver-tab-btn ${solverSubTab === 'system2' ? 'active' : ''}" data-solver-tab="system2" role="tab" aria-selected="${solverSubTab === 'system2'}">
                            <span class="solver-tab-main">2×2 System</span>
                            <span class="solver-tab-sub">(x, y)</span>
                        </button>
                        <button type="button" class="solver-tab-btn ${solverSubTab === 'system3' ? 'active' : ''}" data-solver-tab="system3" role="tab" aria-selected="${solverSubTab === 'system3'}">
                            <span class="solver-tab-main">3×3 System</span>
                            <span class="solver-tab-sub">(x, y, z)</span>
                        </button>
                    </div>
                </div>

                <!-- Input Card -->
                <div class="solver-card">
                    <div id="solver-inputs-container" class="solver-inputs-container"></div>

                    <!-- Action Controls -->
                    <div class="solver-action-row">
                        <button type="button" id="btn-solver-solve" class="solver-solve-btn" aria-label="Solve equation">
                            <span>🧮</span> Solve Equation
                        </button>
                        <button type="button" id="btn-solver-clear" class="solver-clear-btn" aria-label="Clear equation inputs">
                            Clear
                        </button>
                    </div>
                </div>

                <!-- Solution Result Output Card -->
                <div id="solver-result-container" class="solver-result-container" aria-live="polite"></div>
            </div>
        `;

        setupSolverControls();
    }

    function setupSolverControls() {
        const inputsContainer = document.getElementById('solver-inputs-container');
        const resultContainer = document.getElementById('solver-result-container');
        const btnSolve = document.getElementById('btn-solver-solve');
        const btnClear = document.getElementById('btn-solver-clear');

        // 1. Render Inputs Based on Current Sub-Tab
        function renderInputs() {
            if (!inputsContainer) return;
            if (solverSubTab === 'single') {
                inputsContainer.innerHTML = `
                    <div class="solver-input-row">
                        <label for="solver-input-single" class="solver-input-label">Equation (in x):</label>
                        <input type="text" id="solver-input-single" class="solver-input" placeholder="e.g. x^2 - 5x + 6 = 0 or 2x + 7 = 15" value="${escapeHtml(solverInputs.single)}" autocomplete="off" spellcheck="false">
                    </div>
                `;
            } else if (solverSubTab === 'system2') {
                inputsContainer.innerHTML = `
                    <div class="solver-input-row">
                        <label for="solver-input-sys2-1" class="solver-input-label">Equation 1:</label>
                        <input type="text" id="solver-input-sys2-1" class="solver-input" placeholder="e.g. 2x + 3y = 8" value="${escapeHtml(solverInputs.system2_1)}" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="solver-input-row">
                        <label for="solver-input-sys2-2" class="solver-input-label">Equation 2:</label>
                        <input type="text" id="solver-input-sys2-2" class="solver-input" placeholder="e.g. 3x - y = 1" value="${escapeHtml(solverInputs.system2_2)}" autocomplete="off" spellcheck="false">
                    </div>
                `;
            } else if (solverSubTab === 'system3') {
                inputsContainer.innerHTML = `
                    <div class="solver-input-row">
                        <label for="solver-input-sys3-1" class="solver-input-label">Equation 1:</label>
                        <input type="text" id="solver-input-sys3-1" class="solver-input" placeholder="e.g. x + y + z = 6" value="${escapeHtml(solverInputs.system3_1)}" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="solver-input-row">
                        <label for="solver-input-sys3-2" class="solver-input-label">Equation 2:</label>
                        <input type="text" id="solver-input-sys3-2" class="solver-input" placeholder="e.g. 2y + 5z = -4" value="${escapeHtml(solverInputs.system3_2)}" autocomplete="off" spellcheck="false">
                    </div>
                    <div class="solver-input-row">
                        <label for="solver-input-sys3-3" class="solver-input-label">Equation 3:</label>
                        <input type="text" id="solver-input-sys3-3" class="solver-input" placeholder="e.g. 2x + 5y - z = 27" value="${escapeHtml(solverInputs.system3_3)}" autocomplete="off" spellcheck="false">
                    </div>
                `;
            }

            // Sync inputs on typing
            inputsContainer.querySelectorAll('.solver-input').forEach(inp => {
                inp.addEventListener('input', () => {
                    syncInputsFromDOM();
                });
            });
        }

        function syncInputsFromDOM() {
            if (solverSubTab === 'single') {
                const el = document.getElementById('solver-input-single');
                if (el) solverInputs.single = el.value;
            } else if (solverSubTab === 'system2') {
                const el1 = document.getElementById('solver-input-sys2-1');
                const el2 = document.getElementById('solver-input-sys2-2');
                if (el1) solverInputs.system2_1 = el1.value;
                if (el2) solverInputs.system2_2 = el2.value;
            } else if (solverSubTab === 'system3') {
                const el1 = document.getElementById('solver-input-sys3-1');
                const el2 = document.getElementById('solver-input-sys3-2');
                const el3 = document.getElementById('solver-input-sys3-3');
                if (el1) solverInputs.system3_1 = el1.value;
                if (el2) solverInputs.system3_2 = el2.value;
                if (el3) solverInputs.system3_3 = el3.value;
            }
        }

        // 3. Tab switching listeners
        document.querySelectorAll('.solver-tab-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                const tab = btn.dataset.solverTab;
                if (tab && tab !== solverSubTab) {
                    solverSubTab = tab;
                    document.querySelectorAll('.solver-tab-btn').forEach(b => {
                        const isActive = b.dataset.solverTab === solverSubTab;
                        b.classList.toggle('active', isActive);
                        b.setAttribute('aria-selected', String(isActive));
                    });
                    renderInputs();
                    if (resultContainer) resultContainer.innerHTML = '';
                }
            });
        });

        // 4. Execution Logic
        executeSolver = function (saveToHistoryFlag = true) {
            hapticFeedback('medium');
            syncInputsFromDOM();
            if (typeof AlgebraicSolver === 'undefined') {
                if (resultContainer) {
                    resultContainer.innerHTML = '<div class="solver-error-card">Equation Solver module not loaded.</div>';
                }
                return;
            }

            let result = null;
            let exprSummary = '';

            if (solverSubTab === 'single') {
                exprSummary = solverInputs.single.trim();
                result = AlgebraicSolver.solveEquation(exprSummary, { angleMode: angleMode || 'RAD' });
            } else if (solverSubTab === 'system2') {
                exprSummary = `${solverInputs.system2_1.trim()} ; ${solverInputs.system2_2.trim()}`;
                result = AlgebraicSolver.solveSystem2(solverInputs.system2_1, solverInputs.system2_2);
            } else if (solverSubTab === 'system3') {
                exprSummary = `${solverInputs.system3_1.trim()} ; ${solverInputs.system3_2.trim()} ; ${solverInputs.system3_3.trim()}`;
                result = AlgebraicSolver.solveSystem3(solverInputs.system3_1, solverInputs.system3_2, solverInputs.system3_3);
            }

            solverLastResult = result;
            renderResultCard(result, exprSummary);

            if (saveToHistoryFlag && result && !result.error) {
                saveHistory(
                    `Solve: ${exprSummary}`,
                    result.summary,
                    result.steps || [],
                    'solver',
                    { subTab: solverSubTab, inputs: Object.assign({}, solverInputs) }
                );
            }
        };

        function renderResultCard(res, exprSummary) {
            if (!resultContainer) return;

            if (!res) {
                resultContainer.innerHTML = '';
                return;
            }

            if (res.error) {
                resultContainer.innerHTML = `
                    <div class="solver-error-card" role="alert">
                        <span class="solver-error-icon">⚠️</span>
                        <div class="solver-error-text">
                            <strong>Unable to Solve:</strong>
                            <span>${escapeHtml(res.error)}</span>
                        </div>
                    </div>
                `;
                return;
            }

            // Solutions List
            let solutionsHtml = '';
            if (res.solutions && res.solutions.length > 0) {
                solutionsHtml = `
                    <div class="solver-solutions-grid">
                        ${res.solutions.map(sol => `
                            <div class="solver-sol-box">
                                <span class="solver-sol-label">${escapeHtml(sol.label)} =</span>
                                <span class="solver-sol-val">${escapeHtml(sol.formatted)}</span>
                            </div>
                        `).join('')}
                    </div>
                `;
            } else {
                solutionsHtml = `
                    <div class="solver-sol-summary-text">
                        ${escapeHtml(res.summary)}
                    </div>
                `;
            }

            // Steps section
            let stepsHtml = '';
            if (res.steps && res.steps.length > 0) {
                stepsHtml = `
                    <div class="solver-steps-wrapper">
                        <button type="button" class="solver-steps-toggle" id="btn-solver-steps-toggle" aria-expanded="${solverShowSteps}">
                            <span>${solverShowSteps ? '▾ Hide Step-by-Step Resolution' : '▸ Show Step-by-Step Resolution'}</span>
                        </button>
                        <div class="solver-steps-box" id="solver-steps-box" style="display: ${solverShowSteps ? 'flex' : 'none'};">
                            ${res.steps.map((st, i) => `
                                <div class="solver-step-item">
                                    <span class="solver-step-num">${i + 1}</span>
                                    <span class="solver-step-text">${escapeHtml(st)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                `;
            }

            resultContainer.innerHTML = `
                <div class="solver-result-card">
                    <div class="solver-result-header">
                        <span class="solver-badge">${escapeHtml(res.category || 'Solution')}</span>
                        <span class="solver-eq-tag">${escapeHtml(exprSummary)}</span>
                    </div>

                    ${solutionsHtml}

                    ${stepsHtml}
                </div>
            `;

            // Toggle steps event
            const btnToggleSteps = document.getElementById('btn-solver-steps-toggle');
            const stepsBox = document.getElementById('solver-steps-box');
            if (btnToggleSteps && stepsBox) {
                btnToggleSteps.addEventListener('click', () => {
                    solverShowSteps = !solverShowSteps;
                    stepsBox.style.display = solverShowSteps ? 'flex' : 'none';
                    btnToggleSteps.setAttribute('aria-expanded', String(solverShowSteps));
                    btnToggleSteps.querySelector('span').textContent = solverShowSteps
                        ? '▾ Hide Step-by-Step Resolution'
                        : '▸ Show Step-by-Step Resolution';
                });
            }
        }

        // 5. Button click events
        if (btnSolve) {
            btnSolve.addEventListener('click', () => {
                hapticFeedback('medium');
                executeSolver(true);
            });
        }

        if (btnClear) {
            btnClear.addEventListener('click', () => {
                hapticFeedback('light');
                if (solverSubTab === 'single') {
                    solverInputs.single = '';
                } else if (solverSubTab === 'system2') {
                    solverInputs.system2_1 = '';
                    solverInputs.system2_2 = '';
                } else if (solverSubTab === 'system3') {
                    solverInputs.system3_1 = '';
                    solverInputs.system3_2 = '';
                    solverInputs.system3_3 = '';
                }
                renderInputs();
                if (resultContainer) resultContainer.innerHTML = '';
                const firstInput = inputsContainer ? inputsContainer.querySelector('input') : null;
                if (firstInput) firstInput.focus();
            });
        }

        // Initial render
        renderInputs();
        if (solverLastResult) {
            let expr = '';
            if (solverSubTab === 'single') expr = solverInputs.single;
            else if (solverSubTab === 'system2') expr = `${solverInputs.system2_1} ; ${solverInputs.system2_2}`;
            else if (solverSubTab === 'system3') expr = `${solverInputs.system3_1} ; ${solverInputs.system3_2} ; ${solverInputs.system3_3}`;
            renderResultCard(solverLastResult, expr);
        }
    }

    // ==========================================
    // EVENT LISTENERS SETUP
    // ==========================================

    function setupEventListeners() {
        // Mode Switches (if present in DOM)
        if (modeBtnBasic) modeBtnBasic.addEventListener('click', () => setMode('basic'));
        if (modeBtnScientific) modeBtnScientific.addEventListener('click', () => setMode('scientific'));
        if (modeBtnConverter) modeBtnConverter.addEventListener('click', () => setMode('converter'));
        if (modeBtnGraph) modeBtnGraph.addEventListener('click', () => setMode('graph'));

        // Theme Toggle (if present)
        if (btnThemeToggle) btnThemeToggle.addEventListener('click', toggleTheme);

        // Memory Toolbar
        btnMemClear.addEventListener('click', memoryClear);
        btnMemRecall.addEventListener('click', memoryRecall);
        btnMemAdd.addEventListener('click', memoryAdd);
        btnMemSub.addEventListener('click', memorySubtract);

        // Badge DEG/RAD toggle on click
        badgeAngle.addEventListener('click', () => toggleAngleMode());

        // Keyboard Shortcuts
        window.addEventListener('keydown', handleKeyDown);

        // Modals
        if (btnKeyboardHelp) btnKeyboardHelp.addEventListener('click', () => {
            hapticFeedback('light');
            openModal(keyboardHelpModal);
        });

        // Close modal on click background or close buttons
        document.querySelectorAll('.modal-backdrop').forEach(modal => {
            modal.addEventListener('click', (e) => {
                if (e.target === modal || e.target.classList.contains('modal-close-btn')) {
                    hapticFeedback('light');
                    closeModal(modal);
                }
            });
        });

        // History / Steps Toggle Drawer
        btnHistoryToggle.addEventListener('click', () => {
            hapticFeedback('light');
            const isVisible = historyPanel.style.display === 'flex';
            historyPanel.style.display = isVisible ? 'none' : 'flex';
            btnHistoryToggle.classList.toggle('active', !isVisible);
        });

        // Close button inside history header
        const btnCloseHistory = document.getElementById('btn-close-history');
        if (btnCloseHistory) {
            btnCloseHistory.addEventListener('click', () => {
                hapticFeedback('light');
                historyPanel.style.display = 'none';
                btnHistoryToggle.classList.remove('active');
            });
        }

        // Close button inside graph analysis header
        const btnCloseAnalysis = document.getElementById('btn-close-analysis');
        if (btnCloseAnalysis) {
            btnCloseAnalysis.addEventListener('click', () => {
                hapticFeedback('light');
                const analysisPanel = document.getElementById('graph-analysis-panel');
                if (analysisPanel) analysisPanel.style.display = 'none';
            });
        }

        const historyFilterBar = document.getElementById('history-filter-bar');

        tabBtnHistory.addEventListener('click', () => {
            tabBtnHistory.classList.add('active');
            tabBtnSteps.classList.remove('active');
            historyList.style.display = 'flex';
            if (historyFilterBar) historyFilterBar.style.display = 'flex';
            stepsList.classList.remove('active');
        });

        tabBtnSteps.addEventListener('click', () => {
            tabBtnSteps.classList.add('active');
            tabBtnHistory.classList.remove('active');
            historyList.style.display = 'none';
            if (historyFilterBar) historyFilterBar.style.display = 'none';
            stepsList.classList.add('active');
        });

        // History Mode Filter Buttons
        const filterBtns = document.querySelectorAll('.hist-filter-btn');
        filterBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                filterBtns.forEach(b => {
                    b.classList.remove('active');
                    b.setAttribute('aria-pressed', 'false');
                });
                btn.classList.add('active');
                btn.setAttribute('aria-pressed', 'true');
                currentHistoryFilter = btn.dataset.filter || 'all';
                renderHistory();
            });
        });

        btnClearHistory.addEventListener('click', () => {
            hapticFeedback('medium');
            clearAllHistory();
        });
        btnExportHistory.addEventListener('click', () => {
            hapticFeedback('light');
            exportHistory();
        });

        // Natural Language Input
        smartMathSubmit.addEventListener('click', () => {
            hapticFeedback('medium');
            handleSmartSubmit();
        });

        // ---- Sidebar ----
        setupSidebar();

        // ---- Formula Sheet ----
        setupFormulaSheet();
    }

    // ==========================================
    // SIDEBAR
    // ==========================================

    function setupSidebar() {
        const sidebar        = document.getElementById('app-sidebar');
        const sidebarOverlay = document.getElementById('sidebar-overlay');
        const btnOpen        = document.getElementById('btn-sidebar-toggle');
        const btnClose       = document.getElementById('btn-sidebar-close');

        if (!sidebar || !sidebarOverlay || !btnOpen) return;

        const desktopQuery = window.matchMedia('(min-width: 900px)');

        function syncSidebarVisibility() {
            const isHidden = !desktopQuery.matches && !sidebar.classList.contains('open');
            sidebar.setAttribute('aria-hidden', String(isHidden));
            sidebar.toggleAttribute('inert', isHidden);
            sidebarOverlay.setAttribute('aria-hidden', String(!sidebar.classList.contains('open')));
            btnOpen.setAttribute('aria-expanded', String(!isHidden && !desktopQuery.matches));
        }

        function handleSidebarBreakpointChange() {
            if (desktopQuery.matches) {
                sidebar.classList.remove('open');
                sidebarOverlay.classList.remove('show');
                document.body.style.overflow = '';
            }
            syncSidebarVisibility();
        }

        function openSidebar() {
            sidebar.classList.add('open');
            sidebarOverlay.classList.add('show');
            syncSidebarVisibility();
            document.body.style.overflow = 'hidden';
        }

        function closeSidebar() {
            sidebar.classList.remove('open');
            sidebarOverlay.classList.remove('show');
            syncSidebarVisibility();
            document.body.style.overflow = '';
            if (!desktopQuery.matches) btnOpen.focus();
        }

        syncSidebarVisibility();
        if (desktopQuery.addEventListener) {
            desktopQuery.addEventListener('change', handleSidebarBreakpointChange);
        } else {
            desktopQuery.addListener(handleSidebarBreakpointChange);
        }
        window.addEventListener('resize', handleSidebarBreakpointChange);

        btnOpen.addEventListener('click', () => {
            hapticFeedback('light');
            openSidebar();
        });
        if (btnClose) btnClose.addEventListener('click', () => {
            hapticFeedback('light');
            closeSidebar();
        });
        sidebarOverlay.addEventListener('click', () => {
            hapticFeedback('light');
            closeSidebar();
        });

        // Sidebar theme preset buttons
        document.querySelectorAll('.theme-preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                const preset = btn.dataset.themePreset;
                if (preset) {
                    applyTheme(preset);
                }
            });
        });

        // Sync legacy sidebar theme button if present
        function syncSidebarTheme() {
            const current = document.documentElement.getAttribute('data-theme') || 'light';
            const isDark = ['dark', 'midnight', 'synthwave'].includes(current);
            const icon  = document.getElementById('sidebar-theme-icon');
            const label = document.getElementById('sidebar-theme-label');
            if (icon)  icon.textContent  = isDark ? '☀️' : '🌙';
            if (label) label.textContent = isDark ? 'Switch to Light Mode' : 'Switch to Dark Mode';
        }

const btnSidebarTheme = document.getElementById('btn-sidebar-theme');
        if (btnSidebarTheme) {
            btnSidebarTheme.addEventListener('click', () => {
                hapticFeedback('light');
                toggleTheme();
                syncSidebarTheme();
            });
        }

        // Sync sidebar accent swatches
        function syncSidebarAccent(accent) {
            document.querySelectorAll('.sidebar-swatch').forEach(sw => {
                sw.classList.toggle('active', sw.dataset.accentVal === accent);
            });
        }

        document.querySelectorAll('.sidebar-swatch').forEach(sw => {
            sw.addEventListener('click', () => {
                hapticFeedback('light');
                applyAccent(sw.dataset.accentVal);
                syncSidebarAccent(sw.dataset.accentVal);
            });
        });

        // Sidebar mode items
        document.querySelectorAll('.sidebar-nav-item.mode-item').forEach(btn => {
            btn.addEventListener('click', () => {
                hapticFeedback('light');
                const mode = btn.dataset.mode;
                if (mode) {
                    setMode(mode);
                    document.querySelectorAll('.sidebar-nav-item.mode-item').forEach(b => {
                        b.classList.toggle('active', b.dataset.mode === mode);
                    });
                    closeSidebar();
                }
            });
        });

        // Sidebar history button
        const btnSidebarHistory = document.getElementById('btn-sidebar-history');
        if (btnSidebarHistory) {
            btnSidebarHistory.addEventListener('click', () => {
                hapticFeedback('light');
                closeSidebar();
                const isVisible = historyPanel.style.display === 'flex';
                if (!isVisible) {
                    historyPanel.style.display = 'flex';
                    btnHistoryToggle.classList.add('active');
                }
            });
        }

        // Sidebar keyboard shortcuts button
        const btnSidebarKeyboard = document.getElementById('btn-sidebar-keyboard');
        if (btnSidebarKeyboard) {
            btnSidebarKeyboard.addEventListener('click', () => {
                hapticFeedback('light');
                closeSidebar();
                openModal(keyboardHelpModal);
            });
        }

        // Sidebar formula sheet button
        const btnOpenFormula = document.getElementById('btn-open-formula-sheet');
        if (btnOpenFormula) {
            btnOpenFormula.addEventListener('click', () => {
                hapticFeedback('light');
                closeSidebar();
                openFormulaSheet();
            });
        }

        // Sidebar PWA install
        const btnSidebarInstall = document.getElementById('btn-pwa-install-sidebar');
        if (btnSidebarInstall) {
            btnSidebarInstall.addEventListener('click', () => {
                hapticFeedback('medium');
                closeSidebar();
                triggerInstall();
            });
        }

        // Initial sync
        syncSidebarTheme();
        const currentAccent = safeGet(STORAGE_KEY_ACCENT) || 'blue';
        syncSidebarAccent(currentAccent);
        document.querySelectorAll('.sidebar-nav-item.mode-item').forEach(b => {
            b.classList.toggle('active', b.dataset.mode === currentMode);
        });

        // Escape key closes sidebar
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && sidebar.classList.contains('open')) {
                closeSidebar();
            }
        });
    }

    // ==========================================
    // FORMULA SHEET
    // ==========================================

    let formulaSheetReturnFocus = null;

    const FORMULA_DATA = {
        algebra: [
            {
                section: 'Exponents & Powers',
                formulas: [
                    { name: 'Product Rule',           math: 'aᵐ · aⁿ = aᵐ⁺ⁿ' },
                    { name: 'Quotient Rule',          math: 'aᵐ / aⁿ = aᵐ⁻ⁿ' },
                    { name: 'Power of a Power',       math: '(aᵐ)ⁿ = aᵐⁿ' },
                    { name: 'Power of a Product',     math: '(ab)ⁿ = aⁿbⁿ' },
                    { name: 'Zero Exponent',          math: 'a⁰ = 1',               note: 'a ≠ 0' },
                    { name: 'Negative Exponent',      math: 'a⁻ⁿ = 1 / aⁿ',         note: 'a ≠ 0' },
                    { name: 'Fractional Exponent',    math: 'a^(m/n) = ⁿ√(aᵐ)' }
                ]
            },
            {
                section: 'Logarithms',
                formulas: [
                    { name: 'Definition',             math: 'logₐ(x) = y  ⟺  aʸ = x' },
                    { name: 'Product Rule',           math: 'logₐ(xy) = logₐ(x) + logₐ(y)' },
                    { name: 'Quotient Rule',          math: 'logₐ(x/y) = logₐ(x) − logₐ(y)' },
                    { name: 'Power Rule',             math: 'logₐ(xⁿ) = n · logₐ(x)' },
                    { name: 'Change of Base',         math: 'logₐ(x) = ln(x) / ln(a)' },
                    { name: 'Natural Log',            math: 'ln(x) = logₑ(x)' },
                    { name: 'Log of 1',               math: 'logₐ(1) = 0' },
                    { name: 'Log of Base',            math: 'logₐ(a) = 1' },
                    { name: 'Inverse',                math: 'logₐ(aˣ) = x  and  a^(logₐ x) = x' }
                ]
            },
            {
                section: 'Quadratic Equations',
                formulas: [
                    { name: 'Standard Form',          math: 'ax² + bx + c = 0' },
                    { name: 'Quadratic Formula',      math: 'x = (−b ± √(b²−4ac)) / (2a)' },
                    { name: 'Discriminant',           math: 'Δ = b² − 4ac', note: 'Δ > 0: 2 real roots | Δ = 0: 1 real root | Δ < 0: complex roots' },
                    { name: 'Sum of Roots',           math: 'x₁ + x₂ = −b / a' },
                    { name: 'Product of Roots',       math: 'x₁ · x₂ = c / a' },
                    { name: 'Vertex',                 math: '(h, k) = (−b / (2a),  c − b² / (4a))' }
                ]
            },
            {
                section: 'Algebraic Identities',
                formulas: [
                    { name: 'Perfect Square (+)',      math: '(a+b)² = a² + 2ab + b²' },
                    { name: 'Perfect Square (−)',      math: '(a−b)² = a² − 2ab + b²' },
                    { name: 'Difference of Squares',  math: 'a² − b² = (a+b)(a−b)' },
                    { name: 'Sum of Cubes',           math: 'a³ + b³ = (a+b)(a² − ab + b²)' },
                    { name: 'Difference of Cubes',    math: 'a³ − b³ = (a−b)(a² + ab + b²)' },
                    { name: 'Cube of Sum',            math: '(a+b)³ = a³ + 3a²b + 3ab² + b³' },
                    { name: 'Cube of Difference',     math: '(a−b)³ = a³ − 3a²b + 3ab² − b³' }
                ]
            },
            {
                section: 'Sequences & Series',
                formulas: [
                    { name: 'AP: nth Term',           math: 'aₙ = a + (n−1)d' },
                    { name: 'AP: Sum of n Terms',     math: 'Sₙ = (n/2) · [2a + (n−1)d]' },
                    { name: 'GP: nth Term',           math: 'aₙ = a · rⁿ⁻¹' },
                    { name: 'GP: Sum of n Terms',     math: 'Sₙ = a(1−rⁿ) / (1−r)', note: 'r ≠ 1' },
                    { name: 'GP: Sum to Infinity',    math: 'S∞ = a / (1−r)',        note: '|r| < 1' },
                    { name: 'Sum of First n Integers',math: '1 + 2 + … + n = n(n+1) / 2' },
                    { name: 'Sum of First n Squares', math: 'Σ k² = n(n+1)(2n+1) / 6' },
                    { name: 'Sum of First n Cubes',   math: 'Σ k³ = [n(n+1) / 2]²' }
                ]
            },
            {
                section: 'Permutations & Combinations',
                formulas: [
                    { name: 'Factorial',              math: 'n! = n × (n−1) × … × 2 × 1' },
                    { name: 'Permutations',           math: 'P(n,r) = n! / (n−r)!' },
                    { name: 'Combinations',           math: 'C(n,r) = n! / [r!(n−r)!]' },
                    { name: "Pascal's Identity",      math: 'C(n,r) = C(n−1,r−1) + C(n−1,r)' },
                    { name: 'Binomial Theorem',       math: '(a+b)ⁿ = Σ C(n,k) aⁿ⁻ᵏ bᵏ' }
                ]
            }
        ],

        trigonometry: [
            {
                section: 'Basic Ratios (Right Triangle)',
                formulas: [
                    { name: 'Sine',                   math: 'sin θ = Opposite / Hypotenuse' },
                    { name: 'Cosine',                 math: 'cos θ = Adjacent / Hypotenuse' },
                    { name: 'Tangent',                math: 'tan θ = Opposite / Adjacent = sin θ / cos θ' },
                    { name: 'Cosecant',               math: 'cosec θ = 1 / sin θ' },
                    { name: 'Secant',                 math: 'sec θ = 1 / cos θ' },
                    { name: 'Cotangent',              math: 'cot θ = 1 / tan θ = cos θ / sin θ' }
                ]
            },
            {
                section: 'Pythagorean Identities',
                formulas: [
                    { name: 'Fundamental',            math: 'sin²θ + cos²θ = 1' },
                    { name: 'Tangent Form',           math: '1 + tan²θ = sec²θ' },
                    { name: 'Cotangent Form',         math: '1 + cot²θ = cosec²θ' }
                ]
            },
            {
                section: 'Angle Addition & Subtraction',
                formulas: [
                    { name: 'sin(A ± B)',             math: 'sin(A ± B) = sin A cos B ± cos A sin B' },
                    { name: 'cos(A ± B)',             math: 'cos(A ± B) = cos A cos B ∓ sin A sin B' },
                    { name: 'tan(A + B)',             math: 'tan(A + B) = (tan A + tan B) / (1 − tan A tan B)' },
                    { name: 'tan(A − B)',             math: 'tan(A − B) = (tan A − tan B) / (1 + tan A tan B)' }
                ]
            },
            {
                section: 'Double & Half Angle',
                formulas: [
                    { name: 'sin 2A',                 math: 'sin 2A = 2 sin A cos A' },
                    { name: 'cos 2A',                 math: 'cos 2A = cos²A − sin²A = 1 − 2sin²A = 2cos²A − 1' },
                    { name: 'tan 2A',                 math: 'tan 2A = 2 tan A / (1 − tan²A)' },
                    { name: 'sin(A / 2)',             math: 'sin(A / 2) = ±√((1 − cos A) / 2)' },
                    { name: 'cos(A / 2)',             math: 'cos(A / 2) = ±√((1 + cos A) / 2)' },
                    { name: 'tan(A / 2)',             math: 'tan(A / 2) = sin A / (1 + cos A) = (1 − cos A) / sin A' }
                ]
            },
            {
                section: 'Product-to-Sum & Sum-to-Product',
                formulas: [
                    { name: 'sin A sin B',            math: 'sin A sin B = ½ [cos(A−B) − cos(A+B)]' },
                    { name: 'cos A cos B',            math: 'cos A cos B = ½ [cos(A−B) + cos(A+B)]' },
                    { name: 'sin A cos B',            math: 'sin A cos B = ½ [sin(A+B) + sin(A−B)]' },
                    { name: 'sin A + sin B',          math: 'sin A + sin B = 2 sin((A+B)/2) cos((A−B)/2)' },
                    { name: 'sin A − sin B',          math: 'sin A − sin B = 2 cos((A+B)/2) sin((A−B)/2)' },
                    { name: 'cos A + cos B',          math: 'cos A + cos B = 2 cos((A+B)/2) cos((A−B)/2)' },
                    { name: 'cos A − cos B',          math: 'cos A − cos B = −2 sin((A+B)/2) sin((A−B)/2)' }
                ]
            },
            {
                section: 'Triangle Laws & Inverses',
                formulas: [
                    { name: 'Law of Sines',           math: 'a / sin A = b / sin B = c / sin C = 2R' },
                    { name: 'Law of Cosines',         math: 'c² = a² + b² − 2ab cos C' },
                    { name: 'Area of Triangle',       math: 'Area = ½ ab sin C' },
                    { name: 'arcsin range',           math: 'arcsin(x) ∈ [−π/2, π/2]' },
                    { name: 'arccos range',           math: 'arccos(x) ∈ [0, π]' },
                    { name: 'arctan range',           math: 'arctan(x) ∈ (−π/2, π/2)' }
                ]
            },
            {
                section: 'Common Exact Angles',
                formulas: [
                    { name: '0° (0 rad)',             math: 'sin=0,  cos=1,  tan=0' },
                    { name: '30° (π/6 rad)',          math: 'sin=1/2,  cos=√3/2,  tan=1/√3' },
                    { name: '45° (π/4 rad)',          math: 'sin=√2/2,  cos=√2/2,  tan=1' },
                    { name: '60° (π/3 rad)',          math: 'sin=√3/2,  cos=1/2,  tan=√3' },
                    { name: '90° (π/2 rad)',          math: 'sin=1,  cos=0,  tan=undefined' },
                    { name: '180° (π rad)',           math: 'sin=0,  cos=−1,  tan=0' }
                ]
            }
        ],

        calculus: [
            {
                section: 'Limits',
                formulas: [
                    { name: "L'Hôpital's Rule",       math: "lim [f(x)/g(x)] = lim [f'(x)/g'(x)]", note: "Valid for 0/0 or ∞/∞ indeterminate forms" },
                    { name: 'Fundamental Trig Limit',math: 'lim(x→0) [sin(x) / x] = 1' },
                    { name: 'Euler Definition',       math: 'lim(n→∞) (1 + 1/n)ⁿ = e' },
                    { name: 'Continuous Growth Limit',math: 'lim(x→0) (1 + x)^(1/x) = e' }
                ]
            },
            {
                section: 'Differentiation Rules',
                formulas: [
                    { name: 'Constant Rule',          math: 'd/dx [c] = 0' },
                    { name: 'Power Rule',             math: 'd/dx [xⁿ] = n xⁿ⁻¹' },
                    { name: 'Sum / Difference Rule',  math: "d/dx [f ± g] = f' ± g'" },
                    { name: 'Product Rule',           math: "d/dx [fg] = f'g + fg'" },
                    { name: 'Quotient Rule',          math: "d/dx [f / g] = (f'g − fg') / g²" },
                    { name: 'Chain Rule',             math: "d/dx [f(g(x))] = f'(g(x)) · g'(x)" },
                    { name: 'Constant Multiple',      math: "d/dx [c · f(x)] = c · f'(x)" }
                ]
            },
            {
                section: 'Common Derivatives',
                formulas: [
                    { name: 'sin x',                  math: 'd/dx [sin x] = cos x' },
                    { name: 'cos x',                  math: 'd/dx [cos x] = −sin x' },
                    { name: 'tan x',                  math: 'd/dx [tan x] = sec²x' },
                    { name: 'sec x',                  math: 'd/dx [sec x] = sec x tan x' },
                    { name: 'cosec x',                math: 'd/dx [cosec x] = −cosec x cot x' },
                    { name: 'cot x',                  math: 'd/dx [cot x] = −cosec²x' },
                    { name: 'eˣ',                     math: 'd/dx [eˣ] = eˣ' },
                    { name: 'aˣ',                     math: 'd/dx [aˣ] = aˣ ln a' },
                    { name: 'ln x',                   math: 'd/dx [ln x] = 1 / x' },
                    { name: 'logₐ x',                 math: 'd/dx [logₐ x] = 1 / (x ln a)' },
                    { name: 'arcsin x',               math: 'd/dx [arcsin x] = 1 / √(1 − x²)' },
                    { name: 'arccos x',               math: 'd/dx [arccos x] = −1 / √(1 − x²)' },
                    { name: 'arctan x',               math: 'd/dx [arctan x] = 1 / (1 + x²)' }
                ]
            },
            {
                section: 'Integration Rules',
                formulas: [
                    { name: 'Power Rule',             math: '∫ xⁿ dx = xⁿ⁺¹ / (n+1) + C', note: 'n ≠ −1' },
                    { name: 'Reciprocal (1/x)',       math: '∫ (1/x) dx = ln|x| + C' },
                    { name: 'Exponential eˣ',         math: '∫ eˣ dx = eˣ + C' },
                    { name: 'Exponential aˣ',         math: '∫ aˣ dx = aˣ / ln a + C' },
                    { name: 'sin x',                  math: '∫ sin x dx = −cos x + C' },
                    { name: 'cos x',                  math: '∫ cos x dx = sin x + C' },
                    { name: 'sec²x',                  math: '∫ sec²x dx = tan x + C' },
                    { name: 'Inverse Sine Form',      math: '∫ 1/√(1−x²) dx = arcsin x + C' },
                    { name: 'Inverse Tangent Form',   math: '∫ 1/(1+x²) dx = arctan x + C' }
                ]
            },
            {
                section: 'Techniques & Theorems',
                formulas: [
                    { name: 'Fundamental Theorem (FTC)', math: "∫ₐᵇ f(x) dx = F(b) − F(a), where F' = f" },
                    { name: 'Integration by Parts',   math: '∫ u dv = uv − ∫ v du' },
                    { name: 'U-Substitution',         math: "∫ f(g(x)) g'(x) dx = ∫ f(u) du" },
                    { name: 'Taylor Series',          math: 'f(x) = Σ [f⁽ⁿ⁾(a) / n!] · (x−a)ⁿ' }
                ]
            }
        ],

        statistics: [
            {
                section: 'Measures of Central Tendency',
                formulas: [
                    { name: 'Sample Mean',            math: 'x̄ = (Σ xᵢ) / n' },
                    { name: 'Population Mean',        math: 'μ = (Σ Xᵢ) / N' },
                    { name: 'Weighted Mean',          math: 'x̄_w = (Σ wᵢ xᵢ) / (Σ wᵢ)' },
                    { name: 'Median',                 math: 'Middle value of ordered dataset' },
                    { name: 'Mode',                   math: 'Most frequently observed observation(s)' }
                ]
            },
            {
                section: 'Measures of Dispersion',
                formulas: [
                    { name: 'Range',                  math: 'R = Max − Min' },
                    { name: 'Population Variance',    math: 'σ² = Σ (xᵢ − μ)² / N' },
                    { name: 'Sample Variance',        math: 's² = Σ (xᵢ − x̄)² / (n − 1)' },
                    { name: 'Population SD',          math: 'σ = √(Σ (xᵢ − μ)² / N)' },
                    { name: 'Sample SD',              math: 's = √(Σ (xᵢ − x̄)² / (n − 1))' },
                    { name: 'Interquartile Range',    math: 'IQR = Q₃ − Q₁' },
                    { name: 'Coefficient of Variation', math: 'CV = (s / x̄) × 100%' }
                ]
            },
            {
                section: 'Probability & Distributions',
                formulas: [
                    { name: 'Probability of Event',   math: 'P(A) = n(A) / n(S)' },
                    { name: 'Complement Rule',        math: "P(A') = 1 − P(A)" },
                    { name: 'Addition Rule',          math: 'P(A ∪ B) = P(A) + P(B) − P(A ∩ B)' },
                    { name: 'Conditional Probability',math: 'P(A|B) = P(A ∩ B) / P(B)' },
                    { name: "Bayes' Theorem",         math: 'P(A|B) = [P(B|A) · P(A)] / P(B)' },
                    { name: 'Binomial Probability',   math: 'P(X = k) = C(n,k) · pᵏ · (1−p)ⁿ⁻ᵏ' },
                    { name: 'Standard Normal (Z)',    math: 'Z = (X − μ) / σ' }
                ]
            },
            {
                section: 'Correlation & Regression',
                formulas: [
                    { name: 'Pearson Correlation (r)', math: 'r = Σ[(x−x̄)(y−ȳ)] / √[Σ(x−x̄)² · Σ(y−ȳ)²]' },
                    { name: 'Linear Regression Slope', math: 'b = Σ[(x−x̄)(y−ȳ)] / Σ(x−x̄)²' },
                    { name: 'Regression Intercept',   math: 'a = ȳ − b·x̄' },
                    { name: 'Linear Regression Line', math: 'ŷ = a + bx' }
                ]
            }
        ],

        geometry: [
            {
                section: '2D Shapes — Area & Perimeter',
                formulas: [
                    { name: 'Square',                 math: 'A = s²,  P = 4s' },
                    { name: 'Rectangle',              math: 'A = l · w,  P = 2(l + w)' },
                    { name: 'Triangle',               math: 'A = ½ · b · h' },
                    { name: "Heron's Formula",        math: 'A = √[s(s−a)(s−b)(s−c)], where s = (a+b+c)/2' },
                    { name: 'Circle',                 math: 'A = πr²,  Circumference = 2πr = πd' },
                    { name: 'Trapezoid',              math: 'A = ½ · (a + b) · h' },
                    { name: 'Parallelogram',          math: 'A = b · h' },
                    { name: 'Sector of Circle',       math: 'A = ½ r² θ,  Arc Length = rθ (θ in rad)' }
                ]
            },
            {
                section: '3D Shapes — Volume & Surface Area',
                formulas: [
                    { name: 'Cube',                   math: 'V = s³,  SA = 6s²' },
                    { name: 'Rectangular Prism',      math: 'V = l · w · h,  SA = 2(lw + lh + wh)' },
                    { name: 'Cylinder',               math: 'V = πr²h,  SA = 2πr² + 2πrh' },
                    { name: 'Cone',                   math: 'V = ⅓ πr²h,  SA = πr² + πrl (l = √(r²+h²))' },
                    { name: 'Sphere',                 math: 'V = (4/3) πr³,  SA = 4πr²' }
                ]
            },
            {
                section: 'Coordinate Geometry',
                formulas: [
                    { name: 'Distance Formula',       math: 'd = √[(x₂ − x₁)² + (y₂ − y₁)²]' },
                    { name: 'Midpoint Formula',       math: 'M = ((x₁ + x₂) / 2,  (y₁ + y₂) / 2)' },
                    { name: 'Slope (m)',              math: 'm = (y₂ − y₁) / (x₂ − x₁)' },
                    { name: 'Slope-Intercept Form',   math: 'y = mx + b' },
                    { name: 'Point-Slope Form',       math: 'y − y₁ = m(x − x₁)' },
                    { name: 'Equation of Circle',     math: '(x − h)² + (y − k)² = r²' }
                ]
            }
        ]
    };

    let activeFormulaTab = 'algebra';

    function renderFormulaMath(element, formula) {
        const overbarPattern = /x̄_w|x̄|ȳ/g;
        let cursor = 0;
        let match;

        while ((match = overbarPattern.exec(formula)) !== null) {
            element.appendChild(document.createTextNode(formula.slice(cursor, match.index)));

            const overbar = document.createElement('span');
            overbar.className = 'formula-overbar';
            overbar.textContent = match[0] === 'ȳ' ? 'y' : 'x';
            element.appendChild(overbar);

            if (match[0] === 'x̄_w') {
                const subscript = document.createElement('sub');
                subscript.textContent = 'w';
                element.appendChild(subscript);
            }

            cursor = match.index + match[0].length;
        }

        element.appendChild(document.createTextNode(formula.slice(cursor)));
    }

    function openFormulaSheet() {
        const drawer  = document.getElementById('formula-sheet-drawer');
        const overlay = document.getElementById('formula-sheet-overlay');
        if (!drawer || !overlay) return;
        formulaSheetReturnFocus = document.activeElement;
        drawer.removeAttribute('inert');
        drawer.classList.add('open');
        drawer.setAttribute('aria-hidden', 'false');
        overlay.classList.add('show');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.style.overflow = 'hidden';
        document.getElementById('btn-close-formula-sheet')?.focus();
        renderFormulaTab(activeFormulaTab);
    }

    function closeFormulaSheet() {
        const drawer  = document.getElementById('formula-sheet-drawer');
        const overlay = document.getElementById('formula-sheet-overlay');
        if (!drawer || !overlay) return;
        drawer.classList.remove('open');
        drawer.setAttribute('aria-hidden', 'true');
        drawer.setAttribute('inert', '');
        overlay.classList.remove('show');
        overlay.setAttribute('aria-hidden', 'true');
        document.body.style.overflow = '';
        if (formulaSheetReturnFocus instanceof HTMLElement && document.contains(formulaSheetReturnFocus)) {
            formulaSheetReturnFocus.focus();
        }
        formulaSheetReturnFocus = null;
    }

    function renderFormulaTab(tabKey) {
        const content = document.getElementById('formula-content');
        if (!content) return;
        content.innerHTML = '';

        const sections = FORMULA_DATA[tabKey];
        if (!sections) return;

        sections.forEach(sec => {
            const secEl = document.createElement('div');
            secEl.className = 'formula-section';

            const titleEl = document.createElement('div');
            titleEl.className = 'formula-section-title';
            titleEl.textContent = sec.section;
            secEl.appendChild(titleEl);

            sec.formulas.forEach(f => {
                const card = document.createElement('div');
                card.className = 'formula-card';
                card.setAttribute('title', 'Click to copy formula');

                const nameEl = document.createElement('div');
                nameEl.className = 'formula-name';
                nameEl.textContent = f.name;

                const mathEl = document.createElement('div');
                mathEl.className = 'formula-math';
                renderFormulaMath(mathEl, f.math);

                const badge = document.createElement('span');
                badge.className = 'formula-copy-badge';
                badge.textContent = '📋 Copy';

                card.appendChild(nameEl);
                card.appendChild(mathEl);

                if (f.note) {
                    const noteEl = document.createElement('div');
                    noteEl.className = 'formula-note';
                    noteEl.textContent = f.note;
                    card.appendChild(noteEl);
                }

                card.appendChild(badge);

                // Click to copy the formula text
                card.addEventListener('click', () => {
                    const copyText = `${f.name}: ${f.math}${f.note ? ' (' + f.note + ')' : ''}`;
                    if (navigator.clipboard) {
                        navigator.clipboard.writeText(copyText).then(() => {
                            badge.textContent = '✓ Copied!';
                            card.classList.add('copied');
                            setTimeout(() => {
                                badge.textContent = '📋 Copy';
                                card.classList.remove('copied');
                            }, 1600);
                        }).catch(() => {});
                    }
                });

                secEl.appendChild(card);
            });

            content.appendChild(secEl);
        });
    }

    function setupFormulaSheet() {
        const btnClose = document.getElementById('btn-close-formula-sheet');
        const overlay  = document.getElementById('formula-sheet-overlay');

        if (btnClose) btnClose.addEventListener('click', () => {
            hapticFeedback('light');
            closeFormulaSheet();
        });
        if (overlay)  overlay.addEventListener('click', () => {
            hapticFeedback('light');
            closeFormulaSheet();
        });

        // Tab switching
        document.querySelectorAll('.formula-tab').forEach(tab => {
            tab.addEventListener('click', () => {
                hapticFeedback('light');
                document.querySelectorAll('.formula-tab').forEach(t => {
                    t.classList.remove('active');
                    t.setAttribute('aria-selected', 'false');
                });
                tab.classList.add('active');
                tab.setAttribute('aria-selected', 'true');
                activeFormulaTab = tab.dataset.tab;
                renderFormulaTab(activeFormulaTab);
            });
        });

        // Escape key closes formula sheet
        document.addEventListener('keydown', (e) => {
            const drawer = document.getElementById('formula-sheet-drawer');
            if (e.key === 'Escape' && drawer && drawer.classList.contains('open')) {
                closeFormulaSheet();
            }
        });
    }

    // Launch App
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
