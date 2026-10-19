/**
 * AlgebraicSolver - Universal Algebraic Equation Solving Engine
 * Framework-free, offline-ready equation solver for Calyx.
 * Supports:
 * - Linear equations (1 variable): exact fractions, steps
 * - Quadratic equations (1 variable): exact radicals, real & complex roots, discriminant, steps
 * - Polynomial equations (Cubic, Quartic, higher degree): all real roots, steps
 * - Transcendental & general non-linear equations (sin, cos, exp, log, power): Brent-Dekker root finding
 * - Systems of 2 linear equations (x, y): Cramer's rule, steps
 * - Systems of 3 linear equations (x, y, z): 3x3 Determinants / Cramer's rule, steps
 */

const AlgebraicSolver = (function () {
    'use strict';

    // Helper: Round floating point noise
    function cleanNumber(num, precision = 8) {
        if (!Number.isFinite(num)) return num;
        if (Math.abs(num) < 1e-12) return 0;
        const factor = Math.pow(10, precision);
        const rounded = Math.round(num * factor) / factor;
        // Trim standard precision artifacts
        return Number(Number(num.toPrecision(10)).toString());
    }

    // Simplify square root: sqrt(n) -> { outer: k, inner: m } where n = k^2 * m
    function simplifyRadical(n) {
        if (n <= 0 || !Number.isInteger(n)) return { outer: 1, inner: n };
        let outer = 1;
        let inner = n;
        for (let i = 2; i * i <= inner; i++) {
            while (inner % (i * i) === 0) {
                outer *= i;
                inner /= (i * i);
            }
        }
        return { outer, inner };
    }

    // Convert decimal to nice string or fraction
    function formatValue(n) {
        if (!Number.isFinite(n)) return String(n);
        const clean = cleanNumber(n);
        if (typeof MathParser !== 'undefined' && MathParser.decimalToFraction) {
            const frac = MathParser.decimalToFraction(clean);
            if (frac && frac.improper && !frac.improper.includes('.') && frac.improper !== String(clean)) {
                return `${clean} (or ${frac.improper})`;
            }
        }
        return String(clean);
    }

    /**
     * Brent-Dekker Root Finding Algorithm
     * Guaranteed convergence with superlinear speed for continuous functions.
     */
    function brentRoot(f, a, b, tol = 1e-11, maxIter = 100) {
        let fa = f(a);
        let fb = f(b);

        if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
        if (Math.abs(fa) < tol) return a;
        if (Math.abs(fb) < tol) return b;
        if (fa * fb > 0) return null; // Root not bracketed

        if (Math.abs(fa) < Math.abs(fb)) {
            [a, b] = [b, a];
            [fa, fb] = [fb, fa];
        }

        let c = a;
        let fc = fa;
        let mflag = true;
        let s = b;
        let fs = fb;
        let d = 0;

        for (let iter = 0; iter < maxIter; iter++) {
            if (Math.abs(fb) < tol) return b;
            if (Math.abs(b - a) < tol) return (a + b) / 2;

            if (fa !== fc && fb !== fc) {
                // Inverse quadratic interpolation
                s = (a * fb * fc) / ((fa - fb) * (fa - fc)) +
                    (b * fa * fc) / ((fb - fa) * (fb - fc)) +
                    (c * fa * fb) / ((fc - fa) * (fc - fb));
            } else {
                // Secant method
                s = b - fb * (b - a) / (fb - fa);
            }

            // Conditions for bisection fallback
            const cond1 = (s < (3 * a + b) / 4 && s < b) || (s > (3 * a + b) / 4 && s > b);
            const cond2 = mflag && Math.abs(s - b) >= Math.abs(b - c) / 2;
            const cond3 = !mflag && Math.abs(s - b) >= Math.abs(c - d) / 2;
            const cond4 = mflag && Math.abs(b - c) < tol;
            const cond5 = !mflag && Math.abs(c - d) < tol;

            if (cond1 || cond2 || cond3 || cond4 || cond5) {
                s = (a + b) / 2;
                mflag = true;
            } else {
                mflag = false;
            }

            fs = f(s);
            if (!Number.isFinite(fs)) {
                s = (a + b) / 2;
                fs = f(s);
                mflag = true;
            }

            d = c;
            c = b;
            fc = fb;

            if (fa * fs < 0) {
                b = s;
                fb = fs;
            } else {
                a = s;
                fa = fs;
            }

            if (Math.abs(fa) < Math.abs(fb)) {
                [a, b] = [b, a];
                [fa, fb] = [fb, fa];
            }
        }

        return (a + b) / 2;
    }

    /**
     * Find all real roots of f(x) = 0 in range [xMin, xMax]
     */
    function findAllRoots(f, xMin = -50, xMax = 50, samples = 500) {
        const step = (xMax - xMin) / samples;
        const roots = [];
        let prevX = xMin;
        let prevY = f(prevX);

        for (let i = 1; i <= samples; i++) {
            const currX = xMin + i * step;
            const currY = f(currX);

            if (Number.isFinite(prevY) && Number.isFinite(currY)) {
                // Check for root sign crossing
                if ((prevY <= 0 && currY >= 0) || (prevY >= 0 && currY <= 0)) {
                    // Filter out massive vertical asymptote jumps (e.g. tan(x) crossing infinity)
                    const deltaY = Math.abs(currY - prevY);
                    if (deltaY < 1000) {
                        const r = brentRoot(f, prevX, currX);
                        if (r !== null && Number.isFinite(r)) {
                            // Verify root accuracy
                            const check = f(r);
                            if (Math.abs(check) < 1e-4) {
                                const cleanR = cleanNumber(r);
                                if (!roots.some(existing => Math.abs(existing - cleanR) < 1e-4)) {
                                    roots.push(cleanR);
                                }
                            }
                        }
                    }
                }
            }

            prevX = currX;
            prevY = currY;
        }

        roots.sort((a, b) => a - b);
        return roots;
    }

    // 2x2 Determinant
    function det2(a1, b1, a2, b2) {
        return a1 * b2 - a2 * b1;
    }

    // 3x3 Determinant
    function det3(
        a1, b1, c1,
        a2, b2, c2,
        a3, b3, c3
    ) {
        return a1 * (b2 * c3 - b3 * c2) -
               b1 * (a2 * c3 - a3 * c2) +
               c1 * (a2 * b3 - a3 * b2);
    }

    // Extract linear coefficients a, b, c from f(x, y) = ax + by - c
    function extractLinear2(F) {
        const cVal = -F(0, 0);
        const aVal = F(1, 0) + cVal;
        const bVal = F(0, 1) + cVal;

        // Verify linearity with test points
        const test1 = F(2, 3) - (aVal * 2 + bVal * 3 - cVal);
        const test2 = F(-2, 4) - (aVal * (-2) + bVal * 4 - cVal);
        const isLinear = Math.abs(test1) < 1e-6 && Math.abs(test2) < 1e-6;

        return { a: cleanNumber(aVal), b: cleanNumber(bVal), c: cleanNumber(cVal), isLinear };
    }

    // Extract linear coefficients a, b, c, d from f(x, y, z) = ax + by + cz - d
    function extractLinear3(F) {
        const dVal = -F(0, 0, 0);
        const aVal = F(1, 0, 0) + dVal;
        const bVal = F(0, 1, 0) + dVal;
        const cVal = F(0, 0, 1) + dVal;

        const test1 = F(2, 3, 4) - (aVal * 2 + bVal * 3 + cVal * 4 - dVal);
        const test2 = F(-1, 2, -3) - (aVal * (-1) + bVal * 2 + cVal * (-3) - dVal);
        const isLinear = Math.abs(test1) < 1e-5 && Math.abs(test2) < 1e-5;

        return { a: cleanNumber(aVal), b: cleanNumber(bVal), c: cleanNumber(cVal), d: cleanNumber(dVal), isLinear };
    }

    // ==========================================
    // MAIN SOLVER API
    // ==========================================

    /**
     * Solves a single-variable equation in x.
     * Detects linear, quadratic, polynomial, or general transcendental equations.
     */
    function solveEquation(rawEq, options = {}) {
        if (!rawEq || typeof rawEq !== 'string' || !rawEq.trim()) {
            return { error: 'Please enter an equation to solve.' };
        }

        const angleMode = options.angleMode || 'RAD';
        let eq = rawEq.trim().replace(/≤/g, '<=').replace(/≥/g, '>=');

        // Check for inequalities
        if (/[<>]=?/.test(eq)) {
            return {
                error: 'Inequalities are supported in Graph Plotter mode. The Equation Solver solves equations (=).'
            };
        }

        // Split by '='
        let lhsStr = eq;
        let rhsStr = '0';
        if (eq.includes('=')) {
            const parts = eq.split('=');
            if (parts.length > 2) {
                return { error: 'Equation cannot contain more than one "=" sign.' };
            }
            lhsStr = parts[0].trim() || '0';
            rhsStr = parts[1].trim() || '0';
        }

        let evalLHS, evalRHS;
        try {
            evalLHS = MathParser.compileSingleExpression(lhsStr, angleMode);
            evalRHS = MathParser.compileSingleExpression(rhsStr, angleMode);
        } catch (e) {
            return { error: `Syntax error: ${e.message}` };
        }

        const f = (x) => evalLHS({ x }) - evalRHS({ x });

        // 1. Check if Linear: ax + b = 0
        const c0 = f(0);
        const a1 = f(1) - c0;
        const isLinear = [ -3, -1, 0.5, 2, 4.5 ].every(x => {
            const expected = a1 * x + c0;
            const actual = f(x);
            return Number.isFinite(actual) && Math.abs(actual - expected) < 1e-6;
        });

        if (isLinear) {
            const a = cleanNumber(a1);
            const b = cleanNumber(c0);

            if (Math.abs(a) < 1e-10) {
                if (Math.abs(b) < 1e-10) {
                    return {
                        type: 'linear',
                        category: 'Linear Equation',
                        status: 'infinite',
                        solutions: [],
                        summary: 'All real numbers are solutions (Identity equation, 0 = 0)',
                        steps: [
                            `Simplified equation: 0 = 0`,
                            `Both sides are identically equal for every value of x.`,
                            `Solution: x ∈ ℝ (infinitely many solutions)`
                        ]
                    };
                } else {
                    return {
                        type: 'linear',
                        category: 'Linear Equation',
                        status: 'none',
                        solutions: [],
                        summary: `No solution (Contradiction: ${b} = 0)`,
                        steps: [
                            `Simplified equation: ${b} = 0`,
                            `This statement is false and has no variable.`,
                            `Solution: No solution (empty set ∅)`
                        ]
                    };
                }
            }

            const xVal = cleanNumber(-b / a);
            const formattedX = formatValue(xVal);

            const bSign = b >= 0 ? `+ ${b}` : `- ${Math.abs(b)}`;
            return {
                type: 'linear',
                category: 'Linear Equation',
                status: 'unique',
                solutions: [{ label: 'x', value: xVal, formatted: formattedX, isReal: true }],
                summary: `x = ${formattedX}`,
                steps: [
                    `Standard form: ${a}x ${bSign} = 0`,
                    `Isolate the variable term: ${a}x = ${-b}`,
                    `Divide both sides by ${a}: x = ${-b} / ${a}`,
                    `Solution: x = ${formattedX}`
                ]
            };
        }

        // 2. Check if Quadratic: ax^2 + bx + c = 0
        const cQuad = f(0);
        const aQuad = (f(1) + f(-1) - 2 * cQuad) / 2;
        const bQuad = (f(1) - f(-1)) / 2;

        const isQuadratic = Math.abs(aQuad) > 1e-9 && [ -4, -2, 0.5, 2, 3, 5 ].every(x => {
            const expected = aQuad * x * x + bQuad * x + cQuad;
            const actual = f(x);
            return Number.isFinite(actual) && Math.abs(actual - expected) < 1e-5;
        });

        if (isQuadratic) {
            const a = cleanNumber(aQuad);
            const b = cleanNumber(bQuad);
            const c = cleanNumber(cQuad);

            const discriminant = cleanNumber(b * b - 4 * a * c);
            const bSign = b >= 0 ? `+ ${b}x` : `- ${Math.abs(b)}x`;
            const cSign = c >= 0 ? `+ ${c}` : `- ${Math.abs(c)}`;
            const steps = [
                `Standard quadratic form: ${a}x² ${bSign} ${cSign} = 0`,
                `Identify coefficients: a = ${a}, b = ${b}, c = ${c}`,
                `Calculate discriminant: Δ = b² - 4ac = (${b})² - 4(${a})(${c}) = ${discriminant}`
            ];

            if (discriminant > 0) {
                const sqrtD = Math.sqrt(discriminant);
                const x1 = cleanNumber((-b + sqrtD) / (2 * a));
                const x2 = cleanNumber((-b - sqrtD) / (2 * a));

                steps.push(`Since Δ > 0, there are two distinct real solutions:`);
                steps.push(`x₁ = (-b + √Δ) / 2a = (${-b} + √${discriminant}) / ${2 * a} = ${formatValue(x1)}`);
                steps.push(`x₂ = (-b - √Δ) / 2a = (${-b} - √${discriminant}) / ${2 * a} = ${formatValue(x2)}`);

                return {
                    type: 'quadratic',
                    category: 'Quadratic Equation',
                    status: 'real_roots',
                    discriminant,
                    solutions: [
                        { label: 'x₁', value: x1, formatted: formatValue(x1), isReal: true },
                        { label: 'x₂', value: x2, formatted: formatValue(x2), isReal: true }
                    ],
                    summary: `x₁ = ${formatValue(x1)},  x₂ = ${formatValue(x2)}`,
                    steps
                };
            } else if (Math.abs(discriminant) < 1e-10) {
                const x = cleanNumber(-b / (2 * a));
                steps.push(`Since Δ = 0, there is one repeated real solution (multiplicity 2):`);
                steps.push(`x = -b / 2a = -(${b}) / (2 · ${a}) = ${formatValue(x)}`);

                return {
                    type: 'quadratic',
                    category: 'Quadratic Equation',
                    status: 'repeated_root',
                    discriminant: 0,
                    solutions: [
                        { label: 'x', value: x, formatted: formatValue(x), isReal: true, multiplicity: 2 }
                    ],
                    summary: `x = ${formatValue(x)} (multiplicity 2)`,
                    steps
                };
            } else {
                // Complex conjugate roots
                const realPart = cleanNumber(-b / (2 * a));
                const imagPart = cleanNumber(Math.sqrt(-discriminant) / Math.abs(2 * a));
                const rad = simplifyRadical(Math.round(-discriminant));

                let radicalExpr = `√${-discriminant}`;
                if (rad.outer > 1) {
                    radicalExpr = rad.inner === 1 ? `${rad.outer}` : `${rad.outer}√${rad.inner}`;
                }

                const comp1 = `${realPart} + ${imagPart}i`;
                const comp2 = `${realPart} - ${imagPart}i`;

                steps.push(`Since Δ < 0, there are two complex conjugate solutions:`);
                steps.push(`x = (-b ± i√|Δ|) / 2a = (${-b} ± i√${-discriminant}) / ${2 * a}`);
                steps.push(`x₁ = ${comp1}`);
                steps.push(`x₂ = ${comp2}`);

                return {
                    type: 'quadratic',
                    category: 'Quadratic Equation',
                    status: 'complex_roots',
                    discriminant,
                    solutions: [
                        { label: 'x₁', value: null, formatted: comp1, isReal: false, real: realPart, imag: imagPart },
                        { label: 'x₂', value: null, formatted: comp2, isReal: false, real: realPart, imag: -imagPart }
                    ],
                    summary: `x = ${realPart} ± ${imagPart}i`,
                    steps
                };
            }
        }

        // 3. General / Non-Linear / Transcendental / Polynomial Equation
        const searchRange = options.range || 50;
        const roots = findAllRoots(f, -searchRange, searchRange, 800);

        if (roots.length === 0) {
            return {
                type: 'transcendental',
                category: 'Non-linear / Transcendental Equation',
                status: 'none_found',
                solutions: [],
                summary: `No real solutions found in visible range [-${searchRange}, ${searchRange}].`,
                steps: [
                    `Rewrote equation as f(x) = LHS - RHS = 0`,
                    `Sampled continuous domain [-${searchRange}, ${searchRange}]`,
                    `No real roots or zero-crossings detected in this range.`,
                    `Try expanding the search range or check for complex solutions.`
                ]
            };
        }

        const solObjs = roots.map((r, idx) => ({
            label: roots.length === 1 ? 'x' : `x${idx + 1}`,
            value: r,
            formatted: formatValue(r),
            isReal: true
        }));

        const summary = solObjs.map(s => `${s.label} = ${s.formatted}`).join(',  ');
        const steps = [
            `Rewrote equation as: f(x) = (${lhsStr}) - (${rhsStr}) = 0`,
            `Applied Brent-Dekker numerical root isolation across [-${searchRange}, ${searchRange}]`,
            `Isolated ${roots.length} real solution${roots.length > 1 ? 's' : ''}:`
        ];

        roots.forEach((r, idx) => {
            const val = cleanNumber(f(r), 10);
            steps.push(`Solution ${idx + 1}: x = ${formatValue(r)}  [Verification: f(${formatValue(r)}) ≈ ${val}]`);
        });

        return {
            type: 'general',
            category: 'Algebraic / Transcendental Equation',
            status: 'found',
            solutions: solObjs,
            summary,
            steps
        };
    }

    /**
     * Solves a system of 2 linear equations in x and y.
     */
    function solveSystem2(eq1Str, eq2Str, options = {}) {
        if (!eq1Str || !eq2Str || !eq1Str.trim() || !eq2Str.trim()) {
            return { error: 'Please enter both equations.' };
        }

        const angleMode = options.angleMode || 'RAD';
        function makeF(eqStr) {
            let lhs = eqStr;
            let rhs = '0';
            if (eqStr.includes('=')) {
                const parts = eqStr.split('=');
                lhs = parts[0].trim() || '0';
                rhs = parts[1].trim() || '0';
            }
            const evalL = MathParser.compileSingleExpression(lhs, angleMode);
            const evalR = MathParser.compileSingleExpression(rhs, angleMode);
            return (x, y) => evalL({ x, y }) - evalR({ x, y });
        }

        let F1, F2;
        try {
            F1 = makeF(eq1Str);
            F2 = makeF(eq2Str);
        } catch (e) {
            return { error: `Syntax error in equations: ${e.message}` };
        }

        const eq1 = extractLinear2(F1);
        const eq2 = extractLinear2(F2);

        if (!eq1.isLinear || !eq2.isLinear) {
            return { error: 'The 2x2 system solver requires linear equations in x and y.' };
        }

        const a1 = eq1.a, b1 = eq1.b, c1 = eq1.c;
        const a2 = eq2.a, b2 = eq2.b, c2 = eq2.c;

        const D  = cleanNumber(det2(a1, b1, a2, b2));
        const Dx = cleanNumber(det2(c1, b1, c2, b2));
        const Dy = cleanNumber(det2(a1, c1, a2, c2));

        const steps = [
            `Standard system format:`,
            `  Eq 1: ${a1}x + ${b1}y = ${c1}`,
            `  Eq 2: ${a2}x + ${b2}y = ${c2}`,
            `Using Cramer's Rule:`,
            `  Main Determinant D = (${a1})(${b2}) - (${a2})(${b1}) = ${D}`,
            `  x-Determinant Dx  = (${c1})(${b2}) - (${c2})(${b1}) = ${Dx}`,
            `  y-Determinant Dy  = (${a1})(${c2}) - (${a2})(${c1}) = ${Dy}`
        ];

        if (Math.abs(D) > 1e-10) {
            const x = cleanNumber(Dx / D);
            const y = cleanNumber(Dy / D);
            const formattedX = formatValue(x);
            const formattedY = formatValue(y);

            steps.push(`Calculate variables:`);
            steps.push(`  x = Dx / D = ${Dx} / ${D} = ${formattedX}`);
            steps.push(`  y = Dy / D = ${Dy} / ${D} = ${formattedY}`);

            return {
                type: 'system2',
                category: '2×2 Linear System',
                status: 'unique',
                solutions: [
                    { label: 'x', value: x, formatted: formattedX },
                    { label: 'y', value: y, formatted: formattedY }
                ],
                summary: `x = ${formattedX},  y = ${formattedY}`,
                steps
            };
        } else {
            if (Math.abs(Dx) < 1e-10 && Math.abs(Dy) < 1e-10) {
                steps.push(`Since D = 0 and Dx = Dy = 0, the two equations represent the exact same line.`);
                return {
                    type: 'system2',
                    category: '2×2 Linear System',
                    status: 'infinite',
                    solutions: [],
                    summary: 'Infinitely many solutions (Coincident lines)',
                    steps
                };
            } else {
                steps.push(`Since D = 0 but Dx ≠ 0 or Dy ≠ 0, the lines are parallel and never intersect.`);
                return {
                    type: 'system2',
                    category: '2×2 Linear System',
                    status: 'none',
                    solutions: [],
                    summary: 'No solution (Parallel lines, inconsistent system)',
                    steps
                };
            }
        }
    }

    /**
     * Solves a system of 3 linear equations in x, y, and z.
     */
    function solveSystem3(eq1Str, eq2Str, eq3Str, options = {}) {
        if (!eq1Str || !eq2Str || !eq3Str || !eq1Str.trim() || !eq2Str.trim() || !eq3Str.trim()) {
            return { error: 'Please enter all three equations.' };
        }

        const angleMode = options.angleMode || 'RAD';
        function makeF(eqStr) {
            let lhs = eqStr;
            let rhs = '0';
            if (eqStr.includes('=')) {
                const parts = eqStr.split('=');
                lhs = parts[0].trim() || '0';
                rhs = parts[1].trim() || '0';
            }
            const evalL = MathParser.compileSingleExpression(lhs, angleMode);
            const evalR = MathParser.compileSingleExpression(rhs, angleMode);
            return (x, y, z) => evalL({ x, y, z }) - evalR({ x, y, z });
        }

        let F1, F2, F3;
        try {
            F1 = makeF(eq1Str);
            F2 = makeF(eq2Str);
            F3 = makeF(eq3Str);
        } catch (e) {
            return { error: `Syntax error in equations: ${e.message}` };
        }

        const eq1 = extractLinear3(F1);
        const eq2 = extractLinear3(F2);
        const eq3 = extractLinear3(F3);

        if (!eq1.isLinear || !eq2.isLinear || !eq3.isLinear) {
            return { error: 'The 3x3 system solver requires linear equations in x, y, and z.' };
        }

        const a1 = eq1.a, b1 = eq1.b, c1 = eq1.c, d1 = eq1.d;
        const a2 = eq2.a, b2 = eq2.b, c2 = eq2.c, d2 = eq2.d;
        const a3 = eq3.a, b3 = eq3.b, c3 = eq3.c, d3 = eq3.d;

        const D  = cleanNumber(det3(a1, b1, c1, a2, b2, c2, a3, b3, c3));
        const Dx = cleanNumber(det3(d1, b1, c1, d2, b2, c2, d3, b3, c3));
        const Dy = cleanNumber(det3(a1, d1, c1, a2, d2, c2, a3, d3, c3));
        const Dz = cleanNumber(det3(a1, b1, d1, a2, b2, d2, a3, b3, d3));

        const steps = [
            `Standard system format:`,
            `  Eq 1: ${a1}x + ${b1}y + ${c1}z = ${d1}`,
            `  Eq 2: ${a2}x + ${b2}y + ${c2}z = ${d2}`,
            `  Eq 3: ${a3}x + ${b3}y + ${c3}z = ${d3}`,
            `Using Cramer's Rule:`,
            `  Main Determinant D  = ${D}`,
            `  x-Determinant Dx   = ${Dx}`,
            `  y-Determinant Dy   = ${Dy}`,
            `  z-Determinant Dz   = ${Dz}`
        ];

        if (Math.abs(D) > 1e-10) {
            const x = cleanNumber(Dx / D);
            const y = cleanNumber(Dy / D);
            const z = cleanNumber(Dz / D);
            const formattedX = formatValue(x);
            const formattedY = formatValue(y);
            const formattedZ = formatValue(z);

            steps.push(`Compute variables:`);
            steps.push(`  x = Dx / D = ${Dx} / ${D} = ${formattedX}`);
            steps.push(`  y = Dy / D = ${Dy} / ${D} = ${formattedY}`);
            steps.push(`  z = Dz / D = ${Dz} / ${D} = ${formattedZ}`);

            return {
                type: 'system3',
                category: '3×3 Linear System',
                status: 'unique',
                solutions: [
                    { label: 'x', value: x, formatted: formattedX },
                    { label: 'y', value: y, formatted: formattedY },
                    { label: 'z', value: z, formatted: formattedZ }
                ],
                summary: `x = ${formattedX},  y = ${formattedY},  z = ${formattedZ}`,
                steps
            };
        } else {
            if (Math.abs(Dx) < 1e-10 && Math.abs(Dy) < 1e-10 && Math.abs(Dz) < 1e-10) {
                steps.push(`Since D = 0 and Dx = Dy = Dz = 0, the system has infinitely many solutions.`);
                return {
                    type: 'system3',
                    category: '3×3 Linear System',
                    status: 'infinite',
                    solutions: [],
                    summary: 'Infinitely many solutions (Dependent system)',
                    steps
                };
            } else {
                steps.push(`Since D = 0 but at least one numerator determinant is non-zero, the system is inconsistent.`);
                return {
                    type: 'system3',
                    category: '3×3 Linear System',
                    status: 'none',
                    solutions: [],
                    summary: 'No solution (Inconsistent system)',
                    steps
                };
            }
        }
    }

    return {
        solveEquation,
        solveSystem2,
        solveSystem3,
        formatValue,
        brentRoot,
        findAllRoots
    };
})();

// UMD / Node.js test export
if (typeof module === 'object' && module.exports) {
    module.exports = AlgebraicSolver;
}

