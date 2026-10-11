// test-critical-points.js
const MathParser = require('./parser.js');

console.log('=== RUNNING CRITICAL POINTS & INTERSECTIONS TEST SUITE ===');

let passed = 0;
let failed = 0;

function assert(name, condition, details = '') {
    if (condition) {
        console.log(`  ✓ ${name}`);
        passed++;
    } else {
        console.error(`  ✗ ${name} — ${details}`);
        failed++;
    }
}

// 1. Root finding via bisection
function findRootBisection(evaluate, a, b, maxIter = 24) {
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

// Test polynomial roots
const f1 = MathParser.compile('x^2 - 4');
const r1 = findRootBisection(f1.evaluate, 1, 3);
const r2 = findRootBisection(f1.evaluate, -3, -1);
assert('Find root x=2 of x^2 - 4', Math.abs(r1 - 2) < 1e-6);
assert('Find root x=-2 of x^2 - 4', Math.abs(r2 - (-2)) < 1e-6);

// Test Y-intercept
const y0 = f1.evaluate({ x: 0 });
assert('Y-intercept of x^2 - 4 is -4', y0 === -4);

// Test Extrema: derivative of x^2 - 4 is 0 at x=0, min value = -4
const f1_prime = (x) => (f1.evaluate({ x: x + 0.001 }) - f1.evaluate({ x: x - 0.001 })) / 0.002;
assert('Derivative at minimum is ~0', Math.abs(f1_prime(0)) < 1e-3);
assert('Value at minimum is -4', f1.evaluate({ x: 0 }) === -4);

// Test Intersection between f1(x) = x^2 and f2(x) = x + 2
// x^2 - x - 2 = 0 -> (x - 2)(x + 1) = 0 -> x = 2 and x = -1
const pA = MathParser.compile('x^2');
const pB = MathParser.compile('x + 2');
const diff = (scope) => pA.evaluate(scope) - pB.evaluate(scope);

const int1 = findRootBisection(diff, 1, 3);
const int2 = findRootBisection(diff, -2, 0);

assert('Intersection 1 at x = 2', Math.abs(int1 - 2) < 1e-5);
assert('Intersection 1 y value is 4', Math.abs(pA.evaluate({ x: int1 }) - 4) < 1e-5);
assert('Intersection 2 at x = -1', Math.abs(int2 - (-1)) < 1e-5);
assert('Intersection 2 y value is 1', Math.abs(pA.evaluate({ x: int2 }) - 1) < 1e-5);

// Test Asymptote discontinuity check
const pTan = MathParser.compile('tan(x)', { angleMode: 'RAD' });
const valBefore = pTan.evaluate({ x: Math.PI / 2 - 0.0001 });
const valAfter = pTan.evaluate({ x: Math.PI / 2 + 0.0001 });
assert('Tan before asymptote is large positive', valBefore > 1000);
assert('Tan after asymptote is large negative', valAfter < -1000);
const signFlip = (valBefore > 0 && valAfter < 0);
assert('Sign flip detected across asymptote', signFlip);

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

