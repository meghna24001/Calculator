/**
 * grapher.js — Interactive 2D Function Plotter & Graphing Engine
 * Pure static JavaScript & HTML5 Canvas. Zero external dependencies.
 * Uses MathParser.compile() for high-performance deterministic AST evaluation (zero eval).
 */

const Grapher = (function () {
    'use strict';

    class GraphPlotter {
        constructor(canvas, options = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.options = Object.assign({
                xMin: -10,
                xMax: 10,
                yMin: -10,
                yMax: 10,
                angleMode: 'RAD', // Graphing standard is radians
                showGrid: true,
                showTrace: true,
                showKeyPoints: true,
                onKeyPointsUpdated: null
            }, options);

            this.viewport = {
                xMin: this.options.xMin,
                xMax: this.options.xMax,
                yMin: this.options.yMin,
                yMax: this.options.yMax
            };

            // Dynamic list of functions: array of { id, expr, color, compiled, visible }
            this.functions = [];
            this.tracePoint = null; // { screenX, screenY, worldX, worldY, label, color, isCritical }
            this.keyPoints = [];   // Array of { x, y, type: 'root'|'intercept'|'min'|'max'|'intersection', fnIndex, label }

            // Interaction states
            this.isDragging = false;
            this.dragStart = { x: 0, y: 0 };
            this.lastTouchDist = null;

            this.setupCanvas();
            this.bindEvents();
        }

        setupCanvas() {
            this.dpr = window.devicePixelRatio || 1;
            this.resize();

            // ResizeObserver for automatic high-DPI scaling
            if (window.ResizeObserver) {
                this.resizeObserver = new ResizeObserver(() => this.resize());
                this.resizeObserver.observe(this.canvas);
            }
        }

        resize() {
            const rect = this.canvas.getBoundingClientRect();
            const width = rect.width || 360;
            const height = rect.height || 360;

            this.width = width;
            this.height = height;
            this.canvas.width = Math.round(width * this.dpr);
            this.canvas.height = Math.round(height * this.dpr);

            this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
            this.render();
        }

        destroy() {
            if (this.resizeObserver) {
                this.resizeObserver.disconnect();
            }
        }

        // ==========================================
        // COORDINATE CONVERSIONS
        // ==========================================

        toScreenX(worldX) {
            return (worldX - this.viewport.xMin) / (this.viewport.xMax - this.viewport.xMin) * this.width;
        }

        toScreenY(worldY) {
            return this.height - (worldY - this.viewport.yMin) / (this.viewport.yMax - this.viewport.yMin) * this.height;
        }

        toWorldX(screenX) {
            return this.viewport.xMin + (screenX / this.width) * (this.viewport.xMax - this.viewport.xMin);
        }

        toWorldY(screenY) {
            return this.viewport.yMin + ((this.height - screenY) / this.height) * (this.viewport.yMax - this.viewport.yMin);
        }

        centerAt(worldX, worldY) {
            const xSpan = this.viewport.xMax - this.viewport.xMin;
            const ySpan = this.viewport.yMax - this.viewport.yMin;

            this.viewport.xMin = worldX - xSpan / 2;
            this.viewport.xMax = worldX + xSpan / 2;
            this.viewport.yMin = worldY - ySpan / 2;
            this.viewport.yMax = worldY + ySpan / 2;

            this.calculateKeyPoints();
            this.render();
        }

        // ==========================================
        // DYNAMIC FUNCTION MANAGEMENT
        // ==========================================

        setFunctions(fnList) {
            const defaultColors = ['#2563eb', '#e11d48', '#059669', '#d97706', '#7c3aed', '#0891b2', '#ec4899', '#f97316'];
            this.functions = fnList.map((f, idx) => {
                const compiled = MathParser.compile(f.expr, { angleMode: this.options.angleMode });
                return {
                    id: f.id || `fn_${idx + 1}`,
                    expr: f.expr,
                    color: f.color || defaultColors[idx % defaultColors.length],
                    compiled: compiled,
                    visible: f.visible !== false
                };
            });

            this.autoFitToFunctions();
            this.calculateKeyPoints();
            this.render();
        }

        autoFitToFunctions() {
            // Only auto-expand if at default viewport bounds [-10, 10]
            if (this.viewport.xMin === -10 && this.viewport.xMax === 10 &&
                this.viewport.yMin === -10 && this.viewport.yMax === 10) {
                let maxCoord = 10;
                this.functions.forEach(f => {
                    if (f.visible && f.compiled && !f.compiled.error) {
                        if (Number.isFinite(f.compiled.yIntercept)) {
                            maxCoord = Math.max(maxCoord, Math.abs(f.compiled.yIntercept));
                        }
                        if (Number.isFinite(f.compiled.xIntercept)) {
                            maxCoord = Math.max(maxCoord, Math.abs(f.compiled.xIntercept));
                        }
                        if (Number.isFinite(f.compiled.verticalX)) {
                            maxCoord = Math.max(maxCoord, Math.abs(f.compiled.verticalX));
                        }
                    }
                });
                if (maxCoord > 10) {
                    const pad = Math.ceil(maxCoord * 1.25);
                    this.viewport.xMin = -Math.round(pad * 0.3);
                    this.viewport.xMax = pad;
                    this.viewport.yMin = -Math.round(pad * 0.3);
                    this.viewport.yMax = pad;
                }
            }
        }

        setAngleMode(mode) {
            this.options.angleMode = mode;
            // Recompile all functions with new angle mode
            this.functions.forEach(f => {
                f.compiled = MathParser.compile(f.expr, { angleMode: mode });
            });
            this.calculateKeyPoints();
            this.render();
        }

        // ==========================================
        // AUTOMATIC CRITICAL POINT DETECTION
        // (Roots, Y-Intercepts, Extrema, Intersections)
        // ==========================================

        calculateKeyPoints() {
            this.keyPoints = [];
            if (!this.options.showKeyPoints) return;

            const visibleFns = this.functions.filter(f => f.visible && !f.compiled.error);
            if (visibleFns.length === 0) {
                if (this.options.onKeyPointsUpdated) {
                    this.options.onKeyPointsUpdated([], this.analyzeDomainAndAsymptotes());
                }
                return;
            }

            const xMin = this.viewport.xMin;
            const xMax = this.viewport.xMax;
            const steps = 240;
            const dx = (xMax - xMin) / steps;

            // 1. Single function features (Roots, Y-intercepts, Extrema)
            visibleFns.forEach((fn, fnIdx) => {
                if (fn.compiled.isVertical || fn.compiled.isImplicit) return;
                const evaluate = fn.compiled.evaluate;
                const fnName = `f${fnIdx + 1}`;

                // Y-Intercept at x = 0
                if (xMin <= 0 && xMax >= 0) {
                    const y0 = evaluate({ x: 0 });
                    if (Number.isFinite(y0) && y0 >= this.viewport.yMin && y0 <= this.viewport.yMax) {
                        this.keyPoints.push({
                            x: 0,
                            y: cleanNumber(y0),
                            type: 'intercept',
                            fnIndex: fnIdx,
                            label: `Y-Intercept of ${fnName}: (0, ${cleanNumber(y0)})`
                        });
                    }
                }

                let prevX = xMin;
                let prevY = evaluate({ x: prevX });
                let prevSlope = null;

                for (let i = 1; i <= steps; i++) {
                    const currX = xMin + i * dx;
                    const currY = evaluate({ x: currX });

                    if (Number.isFinite(prevY) && Number.isFinite(currY)) {
                        // Check for root (sign change without asymptotic divergence)
                        if ((prevY <= 0 && currY >= 0) || (prevY >= 0 && currY <= 0)) {
                            // Ensure it's not a vertical asymptote crossing 0
                            const dy = Math.abs(currY - prevY);
                            if (dy < (this.viewport.yMax - this.viewport.yMin) * 0.8) {
                                const rootX = this.findRootBisection(evaluate, prevX, currX);
                                if (rootX !== null) {
                                    const rx = cleanNumber(rootX);
                                    if (!this.keyPoints.some(kp => kp.type === 'root' && kp.fnIndex === fnIdx && Math.abs(kp.x - rx) < dx * 0.4)) {
                                        this.keyPoints.push({
                                            x: rx,
                                            y: 0,
                                            type: 'root',
                                            fnIndex: fnIdx,
                                            label: `Root of ${fnName}: x = ${rx}`
                                        });
                                    }
                                }
                            }
                        }

                        // Check for Local Extrema (slope sign change)
                        const slope = (currY - prevY) / dx;
                        if (prevSlope !== null && Number.isFinite(prevSlope) && Number.isFinite(slope)) {
                            if (prevSlope > 0 && slope < 0) {
                                // Local Maximum
                                const mxX = cleanNumber((prevX + currX) / 2);
                                const mxY = cleanNumber(evaluate({ x: mxX }));
                                if (Number.isFinite(mxY) && mxY >= this.viewport.yMin && mxY <= this.viewport.yMax) {
                                    this.keyPoints.push({
                                        x: mxX,
                                        y: mxY,
                                        type: 'max',
                                        fnIndex: fnIdx,
                                        label: `Local Max of ${fnName}: (${mxX}, ${mxY})`
                                    });
                                }
                            } else if (prevSlope < 0 && slope > 0) {
                                // Local Minimum
                                const mnX = cleanNumber((prevX + currX) / 2);
                                const mnY = cleanNumber(evaluate({ x: mnX }));
                                if (Number.isFinite(mnY) && mnY >= this.viewport.yMin && mnY <= this.viewport.yMax) {
                                    this.keyPoints.push({
                                        x: mnX,
                                        y: mnY,
                                        type: 'min',
                                        fnIndex: fnIdx,
                                        label: `Local Min of ${fnName}: (${mnX}, ${mnY})`
                                    });
                                }
                            }
                        }
                        prevSlope = slope;
                    } else {
                        prevSlope = null;
                    }

                    prevX = currX;
                    prevY = currY;
                }
            });

            // 2. Intersections between all pairs of active functions f_i and f_j
            for (let i = 0; i < visibleFns.length; i++) {
                for (let j = i + 1; j < visibleFns.length; j++) {
                    const fn1 = visibleFns[i];
                    const fn2 = visibleFns[j];
                    if (fn1.compiled.isVertical || fn2.compiled.isVertical || fn1.compiled.isImplicit || fn2.compiled.isImplicit) continue;
                    const diffEval = (scope) => fn1.compiled.evaluate(scope) - fn2.compiled.evaluate(scope);

                    let prevX = xMin;
                    let prevDiff = diffEval({ x: prevX });

                    for (let s = 1; s <= steps; s++) {
                        const currX = xMin + s * dx;
                        const currDiff = diffEval({ x: currX });

                        if (Number.isFinite(prevDiff) && Number.isFinite(currDiff)) {
                            if ((prevDiff <= 0 && currDiff >= 0) || (prevDiff >= 0 && currDiff <= 0)) {
                                const intX = this.findRootBisection(diffEval, prevX, currX);
                                if (intX !== null) {
                                    const rx = cleanNumber(intX);
                                    const ry = cleanNumber(fn1.compiled.evaluate({ x: rx }));

                                    if (Number.isFinite(ry) && ry >= this.viewport.yMin && ry <= this.viewport.yMax) {
                                        if (!this.keyPoints.some(kp => kp.type === 'intersection' && Math.abs(kp.x - rx) < dx * 0.4)) {
                                            this.keyPoints.push({
                                                x: rx,
                                                y: ry,
                                                type: 'intersection',
                                                fnIndex: i,
                                                fn2Index: j,
                                                label: `Intersection f${i + 1} ∩ f${j + 1}: (${rx}, ${ry})`
                                            });
                                        }
                                    }
                                }
                            }
                        }
                        prevX = currX;
                        prevDiff = currDiff;
                    }
                }
            }

            // Notify listener for sidebar updates
            if (this.options.onKeyPointsUpdated) {
                this.options.onKeyPointsUpdated(this.keyPoints, this.analyzeDomainAndAsymptotes());
            }
        }

        findRootBisection(evaluate, a, b, maxIter = 20) {
            let ya = evaluate({ x: a });
            let yb = evaluate({ x: b });
            if (Math.abs(ya) < 1e-8) return a;
            if (Math.abs(yb) < 1e-8) return b;
            if (ya * yb > 0) return null;

            for (let i = 0; i < maxIter; i++) {
                const mid = (a + b) / 2;
                const yMid = evaluate({ x: mid });
                if (Math.abs(yMid) < 1e-8) return mid;
                if (ya * yMid < 0) {
                    b = mid;
                    yb = yMid;
                } else {
                    a = mid;
                    ya = yMid;
                }
            }
            return (a + b) / 2;
        }

        // ==========================================
        // DOMAIN & ASYMPTOTE ANALYSIS
        // ==========================================

        analyzeDomainAndAsymptotes() {
            const notes = [];
            const visibleFns = this.functions.filter(f => f.visible && !f.compiled.error);

            visibleFns.forEach((fn, idx) => {
                const expr = fn.expr.toLowerCase();
                const fnName = `f${idx + 1}`;

                if (fn.compiled.slope !== undefined) {
                    notes.push({
                        fnName: fnName,
                        type: 'domain',
                        title: 'Linear Equation / Relation',
                        message: `Slope m = ${cleanNumber(fn.compiled.slope)}, y-intercept = ${cleanNumber(fn.compiled.yIntercept)}${fn.compiled.xIntercept !== null ? `, x-intercept = ${cleanNumber(fn.compiled.xIntercept)}` : ''}.`
                    });
                }
                if (fn.compiled.isImplicit) {
                    notes.push({
                        fnName: fnName,
                        type: 'domain',
                        title: 'Implicit Relation',
                        message: `Implicit 2D curve/region ${fn.expr} evaluated across coordinate grid.`
                    });
                }

                if (fn.compiled.isInequality) {
                    if (fn.compiled.isVertical) {
                        notes.push({
                            fnName: fnName,
                            type: 'domain',
                            title: 'Vertical Inequality',
                            message: `Region shaded to the ${fn.compiled.direction} of x = ${fn.compiled.verticalX} (${fn.compiled.isStrict ? 'dashed / strict' : 'solid / inclusive'} boundary).`
                        });
                    } else if (!fn.compiled.isImplicit) {
                        notes.push({
                            fnName: fnName,
                            type: 'domain',
                            title: 'Inequality Region',
                            message: `Region shaded ${fn.compiled.direction} curve (${fn.compiled.isStrict ? 'dashed / strict' : 'solid / inclusive'} boundary).`
                        });
                    }
                }

                if (expr.includes('tan(')) {
                    notes.push({
                        fnName: fnName,
                        type: 'asymptote',
                        title: 'Vertical Asymptotes',
                        message: 'Periodic singularities at x = π/2 + kπ (e.g. ±1.571, ±4.712). Curve disconnects across discontinuities.'
                    });
                }
                if (expr.includes('/')) {
                    notes.push({
                        fnName: fnName,
                        type: 'asymptote',
                        title: 'Rational Singularity',
                        message: 'Potential vertical asymptote / undefined points where denominator evaluates to 0.'
                    });
                }
                if (expr.includes('sqrt(') || expr.includes('√')) {
                    notes.push({
                        fnName: fnName,
                        type: 'domain',
                        title: 'Radicand Domain Restriction',
                        message: 'Real values defined only where radicand ≥ 0. Negative values yield undefined/complex results.'
                    });
                }
                if (expr.includes('ln(') || expr.includes('log(')) {
                    notes.push({
                        fnName: fnName,
                        type: 'domain',
                        title: 'Logarithm Domain Restriction',
                        message: 'Real values defined strictly for positive arguments (> 0). Vertical asymptote at boundary = 0.'
                    });
                }
                if (expr.includes('asin(') || expr.includes('acos(')) {
                    notes.push({
                        fnName: fnName,
                        type: 'domain',
                        title: 'Inverse Trig Domain',
                        message: 'Defined strictly within [-1, 1]. Outside this interval, output is undefined.'
                    });
                }
                if (!expr.includes('tan(') && !expr.includes('/') && !expr.includes('sqrt(') && !expr.includes('√') && !expr.includes('ln(') && !expr.includes('log(') && !expr.includes('asin(') && !expr.includes('acos(')) {
                    notes.push({
                        fnName: fnName,
                        type: 'continuous',
                        title: 'Continuous Real Domain',
                        message: 'Defined for all real numbers (−∞, +∞). Fully continuous and differentiable across the plane.'
                    });
                }
            });

            return notes;
        }

        // ==========================================
        // RENDERING PIPELINE
        // ==========================================

        render() {
            if (!this.width || !this.height) return;
            const ctx = this.ctx;
            ctx.clearRect(0, 0, this.width, this.height);

            const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
            const colors = {
                bg: isDark ? '#0d1524' : '#f8fafc',
                gridMajor: isDark ? '#1e293b' : '#e2e8f0',
                gridMinor: isDark ? '#141e30' : '#f1f5f9',
                axes: isDark ? '#475569' : '#94a3b8',
                axisText: isDark ? '#94a3b8' : '#64748b'
            };

            // 1. Background fill
            ctx.fillStyle = colors.bg;
            ctx.fillRect(0, 0, this.width, this.height);

            // 2. Grid & Axes
            if (this.options.showGrid) {
                this.drawGridAndAxes(colors);
            }

            // 3. Plot Functions, Equations & Inequalities (with Asymptote & Singularity jump suppression)
            this.functions.forEach((fn) => {
                if (fn.visible && !fn.compiled.error) {
                    if (fn.compiled.isImplicit) {
                        this.drawImplicitRelation(fn.compiled, fn.color);
                    } else if (fn.compiled.isInequality) {
                        this.drawInequality(fn.compiled, fn.color);
                    } else {
                        this.drawFunctionCurve(fn.compiled.evaluate, fn.color);
                    }
                }
            });

            // 4. Key Points (Roots, Intercepts, Extrema, Intersections)
            if (this.options.showKeyPoints) {
                this.drawKeyPoints();
            }

            // 5. Trace Tooltip & Crosshairs
            if (this.options.showTrace && this.tracePoint) {
                this.drawTracePoint();
            }
        }

        drawGridAndAxes(colors) {
            const ctx = this.ctx;
            const xRange = this.viewport.xMax - this.viewport.xMin;
            const yRange = this.viewport.yMax - this.viewport.yMin;

            const xStep = calculateGridStep(xRange);
            const yStep = calculateGridStep(yRange);

            ctx.lineWidth = 1;

            // Vertical Grid Lines (X ticks)
            const firstX = Math.floor(this.viewport.xMin / xStep) * xStep;
            for (let x = firstX; x <= this.viewport.xMax + 1e-9; x += xStep) {
                const sx = this.toScreenX(x);
                ctx.strokeStyle = Math.abs(x) < 1e-9 ? colors.axes : colors.gridMajor;
                ctx.beginPath();
                ctx.moveTo(sx, 0);
                ctx.lineTo(sx, this.height);
                ctx.stroke();

                // Axis label
                if (Math.abs(x) > 1e-9) {
                    ctx.fillStyle = colors.axisText;
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'center';
                    const yPos = Math.min(Math.max(this.toScreenY(0) + 14, 14), this.height - 4);
                    ctx.fillText(formatTick(x), sx, yPos);
                }
            }

            // Horizontal Grid Lines (Y ticks)
            const firstY = Math.floor(this.viewport.yMin / yStep) * yStep;
            for (let y = firstY; y <= this.viewport.yMax + 1e-9; y += yStep) {
                const sy = this.toScreenY(y);
                ctx.strokeStyle = Math.abs(y) < 1e-9 ? colors.axes : colors.gridMajor;
                ctx.beginPath();
                ctx.moveTo(0, sy);
                ctx.lineTo(this.width, sy);
                ctx.stroke();

                // Axis label
                if (Math.abs(y) > 1e-9) {
                    ctx.fillStyle = colors.axisText;
                    ctx.font = '10px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
                    ctx.textAlign = 'right';
                    const xPos = Math.min(Math.max(this.toScreenX(0) - 6, 24), this.width - 4);
                    ctx.fillText(formatTick(y), xPos, sy + 3);
                }
            }

            // Prominent Axes Lines (X = 0 and Y = 0)
            const originX = this.toScreenX(0);
            const originY = this.toScreenY(0);

            ctx.lineWidth = 1.5;
            ctx.strokeStyle = colors.axes;

            // X Axis
            if (originY >= 0 && originY <= this.height) {
                ctx.beginPath();
                ctx.moveTo(0, originY);
                ctx.lineTo(this.width, originY);
                ctx.stroke();
            }

            // Y Axis
            if (originX >= 0 && originX <= this.width) {
                ctx.beginPath();
                ctx.moveTo(originX, 0);
                ctx.lineTo(originX, this.height);
                ctx.stroke();
            }

            // Origin "0" label
            if (originX >= 10 && originX <= this.width - 10 && originY >= 10 && originY <= this.height - 10) {
                ctx.fillStyle = colors.axisText;
                ctx.font = '10px sans-serif';
                ctx.textAlign = 'right';
                ctx.fillText('0', originX - 4, originY + 12);
            }
        }

        drawFunctionCurve(evaluate, color, lineDash = []) {
            const ctx = this.ctx;
            ctx.save();
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (lineDash && lineDash.length > 0) {
                ctx.setLineDash(lineDash);
            } else {
                ctx.setLineDash([]);
            }

            ctx.beginPath();
            let isDrawing = false;
            let prevScreenY = null;
            let prevWorldY = null;

            const pxStep = 1; // 1 pixel sample step for smooth curves
            const ySpan = this.viewport.yMax - this.viewport.yMin;

            for (let px = 0; px <= this.width; px += pxStep) {
                const worldX = this.toWorldX(px);
                const worldY = evaluate({ x: worldX });

                // 1. Undefined / Domain error check
                if (!Number.isFinite(worldY) || isNaN(worldY)) {
                    isDrawing = false;
                    prevScreenY = null;
                    prevWorldY = null;
                    continue;
                }

                const screenY = this.toScreenY(worldY);

                // 2. Asymptote & Jump Discontinuity Detection
                if (prevWorldY !== null) {
                    const signFlip = (prevWorldY > 0 && worldY < 0) || (prevWorldY < 0 && worldY > 0);
                    const dyWorld = Math.abs(worldY - prevWorldY);
                    const dyScreen = Math.abs(screenY - prevScreenY);

                    // Large jump across opposite signs indicates a vertical asymptote (e.g. tan(x), 1/x)
                    if (signFlip && (dyWorld > ySpan * 0.5 || dyScreen > this.height * 0.4)) {
                        isDrawing = false;
                    }
                }

                if (!isDrawing) {
                    ctx.moveTo(px, screenY);
                    isDrawing = true;
                } else {
                    ctx.lineTo(px, screenY);
                }

                prevScreenY = screenY;
                prevWorldY = worldY;
            }

            ctx.stroke();
            ctx.restore();
        }

        drawInequality(compiled, color) {
            const ctx = this.ctx;
            ctx.save();

            const shadeColor = hexToRgba(color, 0.22);
            ctx.fillStyle = shadeColor;

            if (compiled.isVertical) {
                // Vertical inequality (e.g. x <= 2 or x > -1)
                const c = compiled.verticalX;
                const sx = this.toScreenX(c);

                if (compiled.direction === 'left') {
                    // Shade to the left of x = c
                    const w = Math.min(Math.max(0, sx), this.width);
                    if (w > 0) ctx.fillRect(0, 0, w, this.height);
                } else {
                    // Shade to the right of x = c
                    const startX = Math.max(0, Math.min(this.width, sx));
                    const w = this.width - startX;
                    if (w > 0) ctx.fillRect(startX, 0, w, this.height);
                }

                // Vertical boundary line: solid for <= or >=, dashed for < or >
                if (sx >= -10 && sx <= this.width + 10) {
                    ctx.strokeStyle = color;
                    ctx.lineWidth = 2.2;
                    ctx.lineCap = 'round';
                    if (compiled.isStrict) {
                        ctx.setLineDash([6, 6]);
                    } else {
                        ctx.setLineDash([]);
                    }
                    ctx.beginPath();
                    ctx.moveTo(sx, 0);
                    ctx.lineTo(sx, this.height);
                    ctx.stroke();
                }

                ctx.restore();
                return;
            }

            // Function inequality with respect to y (e.g. y <= x^2 or y > 2x + 1)
            // 1. Shading: fill vertical strips from the curve to top/bottom viewport edge
            const evaluate = compiled.evaluate;
            for (let px = 0; px <= this.width; px++) {
                const worldX = this.toWorldX(px);
                const worldY = evaluate({ x: worldX });
                if (Number.isFinite(worldY)) {
                    const sy = this.toScreenY(worldY);
                    if (compiled.direction === 'below') {
                        // Shade below: from sy down to this.height
                        const topY = Math.min(Math.max(0, sy), this.height);
                        const h = this.height - topY;
                        if (h > 0) ctx.fillRect(px, topY, 1, h);
                    } else {
                        // Shade above: from 0 down to sy
                        const bottomY = Math.max(0, Math.min(this.height, sy));
                        if (bottomY > 0) ctx.fillRect(px, 0, 1, bottomY);
                    }
                }
            }

            // 2. Boundary curve: solid for <= or >=, dashed for < or >
            this.drawFunctionCurve(evaluate, color, compiled.isStrict ? [6, 6] : []);

            ctx.restore();
        }

        drawImplicitRelation(compiled, color) {
            const ctx = this.ctx;
            ctx.save();

            const width = this.width;
            const height = this.height;
            const F = compiled.F;

            // 1. If inequality (<=, <, >=, >), shade the satisfied region
            if (compiled.isInequality && typeof compiled.test === 'function') {
                const shadeColor = hexToRgba(color, 0.22);
                ctx.fillStyle = shadeColor;
                const step = 3;
                for (let px = 0; px < width; px += step) {
                    const wx = this.toWorldX(px + step * 0.5);
                    for (let py = 0; py < height; py += step) {
                        const wy = this.toWorldY(py + step * 0.5);
                        if (compiled.test(wx, wy)) {
                            ctx.fillRect(px, py, step, step);
                        }
                    }
                }
            }

            // 2. Draw zero-contour curve F(x, y) = 0 via Marching Squares
            ctx.strokeStyle = color;
            ctx.lineWidth = 2.2;
            ctx.lineCap = 'round';
            ctx.lineJoin = 'round';
            if (compiled.isStrict) {
                ctx.setLineDash([6, 6]);
            } else {
                ctx.setLineDash([]);
            }

            const gridSize = 4;
            const cols = Math.ceil(width / gridSize);
            const rows = Math.ceil(height / gridSize);

            const gridValues = new Float64Array((cols + 1) * (rows + 1));
            for (let j = 0; j <= rows; j++) {
                const wy = this.toWorldY(j * gridSize);
                for (let i = 0; i <= cols; i++) {
                    const wx = this.toWorldX(i * gridSize);
                    gridValues[j * (cols + 1) + i] = F(wx, wy);
                }
            }

            function interp(v1, v2) {
                if (Math.abs(v2 - v1) < 1e-12) return 0.5;
                const t = -v1 / (v2 - v1);
                return Math.max(0, Math.min(1, t));
            }

            function drawSeg(p1, p2) {
                ctx.moveTo(p1[0], p1[1]);
                ctx.lineTo(p2[0], p2[1]);
            }

            ctx.beginPath();

            for (let j = 0; j < rows; j++) {
                const y0 = j * gridSize;
                const y1 = Math.min((j + 1) * gridSize, height);

                for (let i = 0; i < cols; i++) {
                    const x0 = i * gridSize;
                    const x1 = Math.min((i + 1) * gridSize, width);

                    const vTL = gridValues[j * (cols + 1) + i];
                    const vTR = gridValues[j * (cols + 1) + (i + 1)];
                    const vBR = gridValues[(j + 1) * (cols + 1) + (i + 1)];
                    const vBL = gridValues[(j + 1) * (cols + 1) + i];

                    if (!Number.isFinite(vTL) || !Number.isFinite(vTR) ||
                        !Number.isFinite(vBR) || !Number.isFinite(vBL)) {
                        continue;
                    }

                    let mask = 0;
                    if (vTL > 0) mask |= 8;
                    if (vTR > 0) mask |= 4;
                    if (vBR > 0) mask |= 2;
                    if (vBL > 0) mask |= 1;

                    if (mask === 0 || mask === 15) continue;

                    const pTop = [x0 + interp(vTL, vTR) * (x1 - x0), y0];
                    const pRight = [x1, y0 + interp(vTR, vBR) * (y1 - y0)];
                    const pBottom = [x0 + interp(vBL, vBR) * (x1 - x0), y1];
                    const pLeft = [x0, y0 + interp(vTL, vBL) * (y1 - y0)];

                    switch (mask) {
                        case 1:
                        case 14:
                            drawSeg(pLeft, pBottom);
                            break;
                        case 2:
                        case 13:
                            drawSeg(pBottom, pRight);
                            break;
                        case 3:
                        case 12:
                            drawSeg(pLeft, pRight);
                            break;
                        case 4:
                        case 11:
                            drawSeg(pTop, pRight);
                            break;
                        case 5:
                            drawSeg(pLeft, pTop);
                            drawSeg(pBottom, pRight);
                            break;
                        case 6:
                        case 9:
                            drawSeg(pTop, pBottom);
                            break;
                        case 7:
                        case 8:
                            drawSeg(pTop, pLeft);
                            break;
                        case 10:
                            drawSeg(pTop, pRight);
                            drawSeg(pLeft, pBottom);
                            break;
                    }
                }
            }

            ctx.stroke();
            ctx.restore();
        }

        drawKeyPoints() {
            const ctx = this.ctx;
            this.keyPoints.forEach(kp => {
                const sx = this.toScreenX(kp.x);
                const sy = this.toScreenY(kp.y);

                if (sx < -10 || sx > this.width + 10 || sy < -10 || sy > this.height + 10) return;

                ctx.save();
                ctx.beginPath();
                ctx.arc(sx, sy, 5, 0, Math.PI * 2);

                if (kp.type === 'root') {
                    ctx.fillStyle = '#059669'; // Emerald
                } else if (kp.type === 'intercept') {
                    ctx.fillStyle = '#2563eb'; // Blue
                } else if (kp.type === 'intersection') {
                    ctx.fillStyle = '#7c3aed'; // Purple
                } else {
                    ctx.fillStyle = '#d97706'; // Amber (min/max)
                }

                ctx.fill();
                ctx.lineWidth = 2;
                ctx.strokeStyle = '#ffffff';
                ctx.stroke();

                // Subtle outer halo
                ctx.beginPath();
                ctx.arc(sx, sy, 7.5, 0, Math.PI * 2);
                ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
                ctx.lineWidth = 1;
                ctx.stroke();

                ctx.restore();
            });
        }

        drawTracePoint() {
            const pt = this.tracePoint;
            const ctx = this.ctx;
            if (!pt) return;

            const sx = pt.screenX;
            const sy = pt.screenY;

            ctx.save();
            // Crosshairs
            ctx.strokeStyle = 'rgba(100, 116, 139, 0.45)';
            ctx.setLineDash([3, 3]);
            ctx.lineWidth = 1;

            ctx.beginPath();
            ctx.moveTo(sx, 0);
            ctx.lineTo(sx, this.height);
            ctx.moveTo(0, sy);
            ctx.lineTo(this.width, sy);
            ctx.stroke();
            ctx.setLineDash([]);

            // Dot on curve with glow
            ctx.beginPath();
            ctx.arc(sx, sy, pt.isCritical ? 7 : 5.5, 0, Math.PI * 2);
            ctx.fillStyle = pt.color || '#2563eb';
            ctx.fill();
            ctx.lineWidth = 2;
            ctx.strokeStyle = '#ffffff';
            ctx.stroke();

            // Coordinate Tooltip badge
            const label = pt.label || `(${cleanNumber(pt.worldX)}, ${cleanNumber(pt.worldY)})`;
            ctx.font = 'bold 11px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
            const textWidth = ctx.measureText(label).width;
            const badgeW = textWidth + 16;
            const badgeH = 24;

            let bx = sx + 10;
            let by = sy - 30;
            if (bx + badgeW > this.width) bx = sx - badgeW - 10;
            if (by < 6) by = sy + 12;

            ctx.fillStyle = pt.isCritical ? 'rgba(30, 41, 59, 0.95)' : 'rgba(15, 23, 42, 0.9)';
            roundRect(ctx, bx, by, badgeW, badgeH, 6);
            ctx.fill();

            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(label, bx + badgeW / 2, by + badgeH / 2);

            ctx.restore();
        }

        // ==========================================
        // USER INTERACTIONS (Pan, Zoom, Trace Snapping)
        // ==========================================

        bindEvents() {
            const canvas = this.canvas;

            canvas.addEventListener('mousedown', (e) => {
                this.isDragging = true;
                this.dragStart = { x: e.clientX, y: e.clientY };
            });

            window.addEventListener('mousemove', (e) => {
                if (this.isDragging) {
                    const dx = e.clientX - this.dragStart.x;
                    const dy = e.clientY - this.dragStart.y;
                    this.dragStart = { x: e.clientX, y: e.clientY };
                    this.pan(dx, dy);
                } else {
                    const rect = canvas.getBoundingClientRect();
                    if (e.clientX >= rect.left && e.clientX <= rect.right &&
                        e.clientY >= rect.top && e.clientY <= rect.bottom) {
                        this.updateTrace(e.clientX - rect.left, e.clientY - rect.top);
                    } else if (this.tracePoint) {
                        this.tracePoint = null;
                        this.render();
                    }
                }
            });

            window.addEventListener('mouseup', () => {
                if (this.isDragging) {
                    this.isDragging = false;
                    this.calculateKeyPoints();
                    this.render();
                }
            });

            canvas.addEventListener('mouseleave', () => {
                if (!this.isDragging) {
                    this.tracePoint = null;
                    this.render();
                }
            });

            // Wheel Zoom (centered on cursor)
            canvas.addEventListener('wheel', (e) => {
                e.preventDefault();
                const rect = canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                const factor = e.deltaY < 0 ? 0.85 : 1.15;
                this.zoomAt(mouseX, mouseY, factor);
            }, { passive: false });

            // Touch Events (Mobile pan & pinch-to-zoom)
            canvas.addEventListener('touchstart', (e) => {
                if (e.touches.length === 1) {
                    this.isDragging = true;
                    this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    const rect = canvas.getBoundingClientRect();
                    this.updateTrace(e.touches[0].clientX - rect.left, e.touches[0].clientY - rect.top);
                } else if (e.touches.length === 2) {
                    this.isDragging = false;
                    this.lastTouchDist = getTouchDist(e.touches);
                }
            }, { passive: true });

            canvas.addEventListener('touchmove', (e) => {
                if (e.touches.length === 1 && this.isDragging) {
                    const dx = e.touches[0].clientX - this.dragStart.x;
                    const dy = e.touches[0].clientY - this.dragStart.y;
                    this.dragStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
                    this.pan(dx, dy);
                } else if (e.touches.length === 2 && this.lastTouchDist) {
                    const newDist = getTouchDist(e.touches);
                    const factor = this.lastTouchDist / newDist;
                    this.lastTouchDist = newDist;

                    const rect = canvas.getBoundingClientRect();
                    const midX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - rect.left;
                    const midY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - rect.top;
                    this.zoomAt(midX, midY, Math.min(Math.max(factor, 0.8), 1.2));
                }
            }, { passive: true });

            canvas.addEventListener('touchend', () => {
                this.isDragging = false;
                this.lastTouchDist = null;
                this.calculateKeyPoints();
                this.render();
            });
        }

        pan(dxPixels, dyPixels) {
            const worldDx = (dxPixels / this.width) * (this.viewport.xMax - this.viewport.xMin);
            const worldDy = (dyPixels / this.height) * (this.viewport.yMax - this.viewport.yMin);

            this.viewport.xMin -= worldDx;
            this.viewport.xMax -= worldDx;
            this.viewport.yMin += worldDy;
            this.viewport.yMax += worldDy;

            this.render();
        }

        zoomAt(screenX, screenY, factor) {
            const focusX = this.toWorldX(screenX);
            const focusY = this.toWorldY(screenY);

            const newXSpan = (this.viewport.xMax - this.viewport.xMin) * factor;
            const newYSpan = (this.viewport.yMax - this.viewport.yMin) * factor;

            if (newXSpan < 1e-6 || newXSpan > 1e9) return;

            const xRatio = screenX / this.width;
            const yRatio = (this.height - screenY) / this.height;

            this.viewport.xMin = focusX - xRatio * newXSpan;
            this.viewport.xMax = this.viewport.xMin + newXSpan;
            this.viewport.yMin = focusY - yRatio * newYSpan;
            this.viewport.yMax = this.viewport.yMin + newYSpan;

            this.calculateKeyPoints();
            this.render();
        }

        zoomIn() {
            this.zoomAt(this.width / 2, this.height / 2, 0.8);
        }

        zoomOut() {
            this.zoomAt(this.width / 2, this.height / 2, 1.25);
        }

        resetView() {
            this.viewport.xMin = -10;
            this.viewport.xMax = 10;
            this.viewport.yMin = -10;
            this.viewport.yMax = 10;
            this.tracePoint = null;
            this.calculateKeyPoints();
            this.render();
        }

        updateTrace(screenX, screenY) {
            const worldX = this.toWorldX(screenX);
            const visibleFns = this.functions.filter(f => f.visible && !f.compiled.error);

            if (visibleFns.length === 0) {
                this.tracePoint = null;
                this.render();
                return;
            }

            // 1. Snapping to Critical Points (within 14px threshold)
            let nearestKP = null;
            let minDistKP = 14;

            for (const kp of this.keyPoints) {
                const sx = this.toScreenX(kp.x);
                const sy = this.toScreenY(kp.y);
                const dist = Math.hypot(sx - screenX, sy - screenY);
                if (dist < minDistKP) {
                    minDistKP = dist;
                    nearestKP = kp;
                }
            }

            if (nearestKP) {
                const fnColor = nearestKP.type === 'root' ? '#059669' :
                               (nearestKP.type === 'intercept' ? '#2563eb' :
                               (nearestKP.type === 'intersection' ? '#7c3aed' : '#d97706'));

                this.tracePoint = {
                    screenX: this.toScreenX(nearestKP.x),
                    screenY: this.toScreenY(nearestKP.y),
                    worldX: nearestKP.x,
                    worldY: nearestKP.y,
                    label: nearestKP.label,
                    color: fnColor,
                    isCritical: true
                };
                this.render();
                return;
            }

            // 2. Snapping to Nearest Function Curve
            let bestFn = null;
            let bestY = null;
            let minDiff = Infinity;

            visibleFns.forEach((fn, idx) => {
                if (fn.compiled.isVertical) {
                    const sx = this.toScreenX(fn.compiled.verticalX);
                    const diff = Math.abs(sx - screenX);
                    if (diff < minDiff && diff < 16) {
                        minDiff = diff;
                        bestFn = fn;
                        bestY = this.toWorldY(screenY);
                    }
                    return;
                }
                const y = fn.compiled.evaluate({ x: worldX });
                if (Number.isFinite(y)) {
                    const sy = this.toScreenY(y);
                    const diff = Math.abs(sy - screenY);
                    if (diff < minDiff) {
                        minDiff = diff;
                        bestFn = fn;
                        bestY = y;
                    }
                }
            });

            if (bestFn !== null && Number.isFinite(bestY)) {
                const fnIndex = this.functions.indexOf(bestFn);
                const fnName = `f${fnIndex + 1}`;
                const traceLabel = bestFn.compiled.isVertical
                    ? `${fnName}: x = ${cleanNumber(bestFn.compiled.verticalX)} (${bestFn.compiled.inequalityOp})`
                    : `${fnName}: (${cleanNumber(worldX)}, ${cleanNumber(bestY)})`;
                this.tracePoint = {
                    screenX: bestFn.compiled.isVertical ? this.toScreenX(bestFn.compiled.verticalX) : screenX,
                    screenY: this.toScreenY(bestY),
                    worldX: bestFn.compiled.isVertical ? bestFn.compiled.verticalX : cleanNumber(worldX),
                    worldY: cleanNumber(bestY),
                    label: traceLabel,
                    color: bestFn.color,
                    isCritical: false
                };
            } else {
                this.tracePoint = null;
            }

            this.render();
        }

        // ==========================================
        // VALUE TABLE GENERATOR
        // ==========================================

        generateTable(start = -5, end = 5, step = 1) {
            const rows = [];
            const activeFns = this.functions.filter(f => f.visible && !f.compiled.error);

            for (let x = start; x <= end + 1e-9; x += step) {
                const rx = cleanNumber(x);
                const values = activeFns.map(fn => {
                    if (fn.compiled.isVertical) return `x = ${fn.compiled.verticalX}`;
                    if (fn.compiled.isImplicit) return 'Implicit';
                    const y = fn.compiled.evaluate({ x: rx });
                    return Number.isFinite(y) ? cleanNumber(y) : 'Undefined';
                });
                rows.push({ x: rx, values });
            }
            return rows;
        }

        // ==========================================
        // EXPORT TO PNG IMAGE
        // ==========================================

        exportImage() {
            return this.canvas.toDataURL('image/png');
        }
    }

    // ==========================================
    // HELPER FUNCTIONS
    // ==========================================

    function calculateGridStep(range) {
        const rough = range / 8;
        const mag = Math.pow(10, Math.floor(Math.log10(rough)));
        const residual = rough / mag;
        if (residual > 5) return 5 * mag;
        if (residual > 2) return 2 * mag;
        return mag;
    }

    function formatTick(val) {
        const abs = Math.abs(val);
        if (abs >= 10000 || (abs > 0 && abs < 0.001)) {
            return val.toExponential(1);
        }
        return Number(val.toPrecision(6)).toString();
    }

    function cleanNumber(num) {
        if (Math.abs(num) < 1e-10) return 0;
        return Number(Number(num.toPrecision(6)).toString());
    }

    function roundRect(ctx, x, y, width, height, radius) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.arcTo(x + width, y, x + width, y + height, radius);
        ctx.arcTo(x + width, y + height, x, y + height, radius);
        ctx.arcTo(x, y + height, x, y, radius);
        ctx.arcTo(x, y, x + width, y, radius);
        ctx.closePath();
    }

    function getTouchDist(touches) {
        const dx = touches[0].clientX - touches[1].clientX;
        const dy = touches[0].clientY - touches[1].clientY;
        return Math.sqrt(dx * dx + dy * dy);
    }

    function hexToRgba(hex, alpha = 0.22) {
        if (!hex || typeof hex !== 'string') return `rgba(59, 130, 246, ${alpha})`;
        let c = hex.replace('#', '');
        if (c.length === 3) {
            c = c[0] + c[0] + c[1] + c[1] + c[2] + c[2];
        }
        const num = parseInt(c, 16);
        if (isNaN(num)) return `rgba(59, 130, 246, ${alpha})`;
        const r = (num >> 16) & 255;
        const g = (num >> 8) & 255;
        const b = num & 255;
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }

    return {
        Plotter: GraphPlotter
    };
})();
