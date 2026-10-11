// test-grapher.js
const MathParser = require('./parser.js');

console.log('=== RUNNING GRAPHER & FUNCTION COMPILER TEST SUITE ===');

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

// 1. Basic polynomials
const p1 = MathParser.compile('x^2 - 4');
assert('Compile x^2 - 4 error is null', p1.error === null);
assert('Evaluate x^2 - 4 at x=2 (root)', p1.evaluate({ x: 2 }) === 0);
assert('Evaluate x^2 - 4 at x=-2 (root)', p1.evaluate({ x: -2 }) === 0);
assert('Evaluate x^2 - 4 at x=0 (y-intercept)', p1.evaluate({ x: 0 }) === -4);

// 2. Linear and implicit multiplication
const p2 = MathParser.compile('2x + 1');
assert('Compile 2x + 1 error is null', p2.error === null);
assert('Evaluate 2x + 1 at x=3', p2.evaluate({ x: 3 }) === 7);
assert('Evaluate 2x + 1 at x=-0.5', p2.evaluate({ x: -0.5 }) === 0);

// 3. Trigonometric functions
const p3 = MathParser.compile('sin(x)', { angleMode: 'RAD' });
assert('Evaluate sin(x) at x=0', p3.evaluate({ x: 0 }) === 0);
assert('Evaluate sin(x) at x=pi/2', Math.abs(p3.evaluate({ x: Math.PI / 2 }) - 1) < 1e-10);
assert('Evaluate sin(x) at x=pi', Math.abs(p3.evaluate({ x: Math.PI })) < 1e-10);

const p4 = MathParser.compile('cos(x)', { angleMode: 'RAD' });
assert('Evaluate cos(x) at x=0', p4.evaluate({ x: 0 }) === 1);
assert('Evaluate cos(x) at x=pi', p4.evaluate({ x: Math.PI }) === -1);

// 4. Rational and asymptotes
const p5 = MathParser.compile('1/x');
assert('Evaluate 1/x at x=2', p5.evaluate({ x: 2 }) === 0.5);
assert('Evaluate 1/x at x=0 returns NaN (asymptote safety)', isNaN(p5.evaluate({ x: 0 })));

// 5. Roots and Exponents
const p6 = MathParser.compile('sqrt(x)');
assert('Evaluate sqrt(x) at x=9', p6.evaluate({ x: 9 }) === 3);
assert('Evaluate sqrt(x) at x=-4 returns NaN (domain safety)', isNaN(p6.evaluate({ x: -4 })));

const p7 = MathParser.compile('2^x');
assert('Evaluate 2^x at x=3', p7.evaluate({ x: 3 }) === 8);
assert('Evaluate 2^x at x=0', p7.evaluate({ x: 0 }) === 1);

// 6. Natural prefixes stripping (y = ... and f(x) = ...)
const p8 = MathParser.compile('y = x^3 - 3x');
assert('Compile with y = prefix', p8.error === null && p8.evaluate({ x: 2 }) === 2);

const p9 = MathParser.compile('f(x) = 3x^2');
assert('Compile with f(x) = prefix', p9.error === null && p9.evaluate({ x: 3 }) === 27);

// 7. Syntax error safety
const pErr = MathParser.compile('x + * 2');
assert('Invalid expression returns error message', typeof pErr.error === 'string');

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}

