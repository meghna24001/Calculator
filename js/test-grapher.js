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

// 8. Inequality support
const ineq1 = MathParser.compile('y <= x^2');
assert('Compile y <= x^2 error is null', ineq1.error === null);
assert('y <= x^2 isInequality flag is true', ineq1.isInequality === true);
assert('y <= x^2 direction is below', ineq1.direction === 'below');
assert('y <= x^2 isStrict is false', ineq1.isStrict === false);
assert('Evaluate y <= x^2 boundary curve at x=3', ineq1.evaluate({ x: 3 }) === 9);

const ineq2 = MathParser.compile('y < 2x + 1');
assert('y < 2x + 1 isStrict is true', ineq2.isStrict === true);
assert('y < 2x + 1 direction is below', ineq2.direction === 'below');

const ineq3 = MathParser.compile('y >= sin(x)');
assert('y >= sin(x) direction is above', ineq3.direction === 'above');
assert('y >= sin(x) isStrict is false', ineq3.isStrict === false);

const ineq4 = MathParser.compile('<= x^2 - 4');
assert('<= x^2 - 4 implicit y direction is below', ineq4.isInequality === true && ineq4.direction === 'below');

const ineq5 = MathParser.compile('y ≤ 3x');
assert('y ≤ 3x unicode <= supported', ineq5.isInequality === true && ineq5.inequalityOp === '<=');

const ineq6 = MathParser.compile('x <= 2');
assert('x <= 2 vertical inequality detected', ineq6.isVertical === true && ineq6.verticalX === 2 && ineq6.direction === 'left');

const ineq7 = MathParser.compile('x > -1');
assert('x > -1 vertical inequality detected', ineq7.isVertical === true && ineq7.verticalX === -1 && ineq7.direction === 'right' && ineq7.isStrict === true);

// 9. Multi-variable equations & inequations
const eqMulti1 = MathParser.compile('2x + y >= 30');
assert('Compile 2x + y >= 30 error is null', eqMulti1.error === null);
assert('2x + y >= 30 isInequality is true', eqMulti1.isInequality === true);
assert('2x + y >= 30 direction is above', eqMulti1.direction === 'above');
assert('2x + y >= 30 slope is -2', Math.abs(eqMulti1.slope - (-2)) < 1e-9);
assert('2x + y >= 30 yIntercept is 30', Math.abs(eqMulti1.yIntercept - 30) < 1e-9);
assert('2x + y >= 30 xIntercept is 15', Math.abs(eqMulti1.xIntercept - 15) < 1e-9);
assert('2x + y >= 30 evaluate at x=10 gives 10', Math.abs(eqMulti1.evaluate({ x: 10 }) - 10) < 1e-9);

const eqMulti2 = MathParser.compile('2x + y = 30');
assert('Compile 2x + y = 30 error is null', eqMulti2.error === null);
assert('2x + y = 30 isInequality is false', eqMulti2.isInequality === false);
assert('2x + y = 30 slope is -2', Math.abs(eqMulti2.slope - (-2)) < 1e-9);
assert('2x + y = 30 evaluate at x=0 gives 30', eqMulti2.evaluate({ x: 0 }) === 30);

const eqMulti3 = MathParser.compile('3x - 4y = 12');
assert('Compile 3x - 4y = 12 error is null', eqMulti3.error === null);
assert('3x - 4y = 12 slope is 0.75', Math.abs(eqMulti3.slope - 0.75) < 1e-9);
assert('3x - 4y = 12 yIntercept is -3', Math.abs(eqMulti3.yIntercept - (-3)) < 1e-9);

const eqMulti4 = MathParser.compile('x + y <= 5');
assert('x + y <= 5 direction is below', eqMulti4.isInequality === true && eqMulti4.direction === 'below');

const eqMulti5 = MathParser.compile('2x - 3y > 6');
assert('2x - 3y > 6 dividing by negative flips to below', eqMulti5.isInequality === true && eqMulti5.direction === 'below' && eqMulti5.isStrict === true);

// 10. Non-linear implicit relations
const circleEq = MathParser.compile('x^2 + y^2 = 25');
assert('Compile x^2 + y^2 = 25 error is null', circleEq.error === null);
assert('x^2 + y^2 = 25 isImplicit is true', circleEq.isImplicit === true);
assert('x^2 + y^2 = 25 isInequality is false', circleEq.isInequality === false);
assert('x^2 + y^2 = 25 test on circle (3, 4)', circleEq.test(3, 4) === true);
assert('x^2 + y^2 = 25 test outside (6, 0)', circleEq.test(6, 0) === false);

const circleIneq = MathParser.compile('x^2 + y^2 <= 16');
assert('Compile x^2 + y^2 <= 16 isImplicit is true', circleIneq.isImplicit === true);
assert('x^2 + y^2 <= 16 isInequality is true', circleIneq.isInequality === true);
assert('x^2 + y^2 <= 16 test inside (0, 0)', circleIneq.test(0, 0) === true);
assert('x^2 + y^2 <= 16 test outside (5, 5)', circleIneq.test(5, 5) === false);

console.log(`\nResults: ${passed} passed, ${failed} failed`);

if (failed > 0) {
    process.exit(1);
}

