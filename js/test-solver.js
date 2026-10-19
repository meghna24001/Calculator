const MathParser = require('./parser.js');
// AlgebraicSolver expects MathParser to be globally available or loaded
global.MathParser = MathParser;
const AlgebraicSolver = require('./solver.js');

let passed = 0;
let failed = 0;

function assert(description, condition, details = '') {
    if (condition) {
        passed++;
        console.log(`  ✓ ${description}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${description}`);
        if (details) console.error(`      ${details}`);
    }
}

function assertClose(description, actual, expected, tol = 1e-4) {
    const isClose = typeof actual === 'number' && typeof expected === 'number'
        ? Math.abs(actual - expected) < tol
        : actual === expected;
    assert(description, isClose, `Expected: ${expected}, Actual: ${actual}`);
}

console.log("=== RUNNING ALGEBRAIC SOLVER TEST SUITE ===");

// 1. Single-variable linear equations
console.log("\n-- 1. Linear Equations --");
{
    const res1 = AlgebraicSolver.solveEquation("2x + 6 = 0");
    assert("2x + 6 = 0 produces unique root", res1.status === 'unique');
    assertClose("2x + 6 = 0 root is -3", res1.solutions[0].value, -3);
    assert("2x + 6 = 0 steps generated", res1.steps && res1.steps.length > 0);

    const res2 = AlgebraicSolver.solveEquation("3x - 5 = 2x + 7");
    assertClose("3x - 5 = 2x + 7 root is 12", res2.solutions[0].value, 12);

    const res3 = AlgebraicSolver.solveEquation("2x = 3");
    assertClose("2x = 3 root is 1.5", res3.solutions[0].value, 1.5);
    assert("2x = 3 displays fraction 3/2", res3.solutions[0].formatted.includes("3/2"));

    const resInf = AlgebraicSolver.solveEquation("2x + 4 = 2x + 4");
    assert("Identical sides have infinite solutions", resInf.status === 'infinite');

    const resNone = AlgebraicSolver.solveEquation("2x + 4 = 2x + 5");
    assert("Parallel/inconsistent linear has no solution", resNone.status === 'none');
}

// 2. Quadratic equations
console.log("\n-- 2. Quadratic Equations --");
{
    // Two real roots
    const res1 = AlgebraicSolver.solveEquation("x^2 - 5x + 6 = 0");
    assert("x^2 - 5x + 6 = 0 has 2 roots", res1.solutions && res1.solutions.length === 2);
    const roots1 = res1.solutions.map(s => s.value).sort((a, b) => a - b);
    assertClose("x^2 - 5x + 6 root 1 is 2", roots1[0], 2);
    assertClose("x^2 - 5x + 6 root 2 is 3", roots1[1], 3);

    // Difference of squares
    const res2 = AlgebraicSolver.solveEquation("x^2 - 4 = 0");
    const roots2 = res2.solutions.map(s => s.value).sort((a, b) => a - b);
    assertClose("x^2 - 4 = 0 root 1 is -2", roots2[0], -2);
    assertClose("x^2 - 4 = 0 root 2 is 2", roots2[1], 2);

    // Repeated root
    const res3 = AlgebraicSolver.solveEquation("x^2 + 2x + 1 = 0");
    assert("x^2 + 2x + 1 = 0 has 1 unique root", res3.solutions.length === 1);
    assertClose("x^2 + 2x + 1 = 0 root is -1", res3.solutions[0].value, -1);

    // Complex roots
    const res4 = AlgebraicSolver.solveEquation("x^2 + 1 = 0");
    assert("x^2 + 1 = 0 identifies complex roots", res4.status === 'complex_roots');
    assert("x^2 + 1 = 0 has formatted complex strings with 'i'", res4.solutions.some(s => s.formatted.includes("i")));

    const res5 = AlgebraicSolver.solveEquation("x^2 - 2x + 5 = 0");
    assert("x^2 - 2x + 5 = 0 is complex", res5.status === 'complex_roots');
    assert("x^2 - 2x + 5 = 0 contains 1 + 2i or 1 - 2i", res5.solutions.some(s => s.formatted.includes("2i")));
}

// 3. Higher-degree polynomials
console.log("\n-- 3. Higher Degree Polynomials --");
{
    const resCubic = AlgebraicSolver.solveEquation("x^3 - 6x^2 + 11x - 6 = 0");
    assert("x^3 - 6x^2 + 11x - 6 = 0 finds 3 roots", resCubic.solutions.length === 3);
    const cRoots = resCubic.solutions.map(s => Math.round(s.value)).sort((a, b) => a - b);
    assert("Cubic roots are 1, 2, 3", cRoots[0] === 1 && cRoots[1] === 2 && cRoots[2] === 3);

    const resQuartic = AlgebraicSolver.solveEquation("x^4 - 16 = 0");
    assert("x^4 - 16 = 0 finds real roots", resQuartic.solutions.length >= 2);
    const qRoots = resQuartic.solutions.map(s => Math.round(s.value)).sort((a, b) => a - b);
    assert("Quartic real roots are -2 and 2", qRoots.includes(-2) && qRoots.includes(2));
}

// 4. Transcendental & Non-linear equations
console.log("\n-- 4. Transcendental & Non-linear Equations --");
{
    // Exponential
    const resExp = AlgebraicSolver.solveEquation("2^x = 16");
    assert("2^x = 16 finds root", resExp.solutions && resExp.solutions.length >= 1);
    assertClose("2^x = 16 root is 4", resExp.solutions[0].value, 4);

    // Trig
    const resSin = AlgebraicSolver.solveEquation("sin(x) = 0", { min: -1, max: 1 });
    assert("sin(x) = 0 has root at 0", resSin.solutions.some(s => Math.abs(s.value) < 1e-4));
}

// 5. 2x2 Linear Systems
console.log("\n-- 5. 2x2 Linear Systems --");
{
    // Unique solution
    const sys1 = AlgebraicSolver.solveSystem2("x + y = 5", "x - y = 1");
    assert("x + y = 5, x - y = 1 has unique solution", sys1.status === 'unique');
    const x1 = sys1.solutions.find(s => s.label === 'x').value;
    const y1 = sys1.solutions.find(s => s.label === 'y').value;
    assertClose("x = 3", x1, 3);
    assertClose("y = 2", y1, 2);

    const sys2 = AlgebraicSolver.solveSystem2("2x + 3y = 8", "3x - y = 1");
    assert("2x + 3y = 8, 3x - y = 1 has unique solution", sys2.status === 'unique');
    const x2 = sys2.solutions.find(s => s.label === 'x').value;
    const y2 = sys2.solutions.find(s => s.label === 'y').value;
    assertClose("x = 1", x2, 1);
    assertClose("y = 2", y2, 2);

    // Inconsistent (parallel lines)
    const sysIncon = AlgebraicSolver.solveSystem2("x + y = 2", "x + y = 4");
    assert("x + y = 2, x + y = 4 is inconsistent", sysIncon.status === 'none');

    // Dependent (infinite solutions)
    const sysInf = AlgebraicSolver.solveSystem2("2x + 4y = 8", "x + 2y = 4");
    assert("2x + 4y = 8, x + 2y = 4 is dependent", sysInf.status === 'infinite');
}

// 6. 3x3 Linear Systems
console.log("\n-- 6. 3x3 Linear Systems --");
{
    const eq1 = "x + y + z = 6";
    const eq2 = "2y + 5z = -4";
    const eq3 = "2x + 5y - z = 27";
    const sys3 = AlgebraicSolver.solveSystem3(eq1, eq2, eq3);
    assert("3x3 system solves with unique status", sys3.status === 'unique');
    const xVal = sys3.solutions.find(s => s.label === 'x').value;
    const yVal = sys3.solutions.find(s => s.label === 'y').value;
    const zVal = sys3.solutions.find(s => s.label === 'z').value;
    assertClose("x = 5", xVal, 5);
    assertClose("y = 3", yVal, 3);
    assertClose("z = -2", zVal, -2);
    assert("Steps contain Cramer's rule determinants", sys3.steps.some(st => st.includes("Determinant D")));
}

console.log("\n==========================================");
console.log(`TEST RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("==========================================");

if (failed > 0) {
    process.exit(1);
}
