const MathParser = require('./parser.js');

let passed = 0;
let failed = 0;

function assert(description, actual, expected) {
    const isClose = typeof actual === 'number' && typeof expected === 'number'
        ? Math.abs(actual - expected) < 1e-7
        : actual === expected;

    if (isClose) {
        passed++;
        console.log(`  ✓ ${description} -> ${actual}`);
    } else {
        failed++;
        console.error(`  ✗ FAIL: ${description}`);
        console.error(`      Expected: ${expected}`);
        console.error(`      Actual:   ${actual}`);
    }
}

console.log("=== RUNNING REGRESSION & PARSER TEST SUITE ===");

// 1. Basic Arithmetic & Precedence
assert("2 + 3 * 4", MathParser.evaluate("2 + 3 * 4").result, 14);
assert("(2 + 3) * 4", MathParser.evaluate("(2 + 3) * 4").result, 20);
assert("10 - 2 - 3", MathParser.evaluate("10 - 2 - 3").result, 5);
assert("20 / 4 / 2", MathParser.evaluate("20 / 4 / 2").result, 2.5);
assert("-5 + 8", MathParser.evaluate("-5 + 8").result, 3);
assert("5 * -3", MathParser.evaluate("5 * -3").result, -15);
assert("2 ^ 3 ^ 2", MathParser.evaluate("2 ^ 3 ^ 2").result, 512); // right-associative: 2^(3^2) = 2^9 = 512
assert("3² + 4²", MathParser.evaluate("3² + 4²").result, 25);

// 2. Implicit Multiplication
assert("2(3)", MathParser.evaluate("2(3)").result, 6);
assert("(2)(3)", MathParser.evaluate("(2)(3)").result, 6);
assert("4(2 + 3)", MathParser.evaluate("4(2 + 3)").result, 20);
assert("(2 + 3)4", MathParser.evaluate("(2 + 3)4").result, 20);
assert("2π", MathParser.evaluate("2π").result, 2 * Math.PI);
assert("2e", MathParser.evaluate("2e").result, 2 * Math.E);
assert("2sin(30)", MathParser.evaluate("2sin(30)", { angleMode: 'DEG' }).result, 1);

// 3. Percentages (including Cascading)
assert("50%", MathParser.evaluate("50%").result, 0.5);
assert("200 * 10%", MathParser.evaluate("200 * 10%").result, 20);
assert("200 / 10%", MathParser.evaluate("200 / 10%").result, 2000);
assert("200 + 10%", MathParser.evaluate("200 + 10%").result, 220);
assert("200 + 10% - 5%", MathParser.evaluate("200 + 10% - 5%").result, 209);
assert("100 - 20%", MathParser.evaluate("100 - 20%").result, 80);

// 4. Safe Errors (Zero Division, Domain Errors)
assert("Divide by zero", MathParser.evaluate("10 / 0").error !== null, true);
assert("log(-5)", MathParser.evaluate("log(-5)").error !== null, true);
assert("ln(0)", MathParser.evaluate("ln(0)").error !== null, true);
assert("√( -4 )", MathParser.evaluate("sqrt(-4)").error !== null, true);
assert("tan(90 deg)", MathParser.evaluate("tan(90)", { angleMode: 'DEG' }).error !== null, true);

// 5. Scientific Functions (Trig DEG & RAD)
assert("sin(30) DEG", MathParser.evaluate("sin(30)", { angleMode: 'DEG' }).result, 0.5);
assert("cos(60) DEG", MathParser.evaluate("cos(60)", { angleMode: 'DEG' }).result, 0.5);
assert("cos(90) DEG clean 0", MathParser.evaluate("cos(90)", { angleMode: 'DEG' }).result, 0);
assert("asin(0.5) DEG", MathParser.evaluate("asin(0.5)", { angleMode: 'DEG' }).result, 30);
assert("sin(π/2) RAD", MathParser.evaluate("sin(π / 2)", { angleMode: 'RAD' }).result, 1);
assert("log(1000)", MathParser.evaluate("log(1000)").result, 3);
assert("ln(e)", MathParser.evaluate("ln(e)").result, 1);

// 6. Roots (Square Root, nth Root)
assert("sqrt(16)", MathParser.evaluate("sqrt(16)").result, 4);
assert("√25", MathParser.evaluate("√25").result, 5);
assert("root(3, 27)", MathParser.evaluate("root(3, 27)").result, 3);
assert("10th root of 1024", MathParser.evaluate("root(10, 1024)").result, 2);
assert("Infix 3√8", MathParser.evaluate("3√8").result, 2);

// 7. Factorial & Combinatorics
assert("5!", MathParser.evaluate("5!").result, 120);
assert("(2+3)!", MathParser.evaluate("(2+3)!").result, 120);
assert("Factorial overflow > 170", MathParser.evaluate("171!").error !== null, true);
assert("5P2", MathParser.evaluate("5P2").result, 20);
assert("5C2", MathParser.evaluate("5C2").result, 10);

// 8. Statistics & Multi-Arg Functions
assert("mean(2, 4, 6, 8)", MathParser.evaluate("mean(2, 4, 6, 8)").result, 5);
assert("median(1, 3, 5, 7, 9)", MathParser.evaluate("median(1, 3, 5, 7, 9)").result, 5);
assert("median even(1, 2, 3, 4)", MathParser.evaluate("median(1, 2, 3, 4)").result, 2.5);
assert("mode single (1, 2, 2, 3)", MathParser.evaluate("mode(1, 2, 2, 3)").result, 2);
assert("mode tied (1, 1, 2, 2, 3)", MathParser.evaluate("mode(1, 1, 2, 2, 3)").result, "1, 2");
assert("mode none (1, 2, 3, 4)", MathParser.evaluate("mode(1, 2, 3, 4)").result, "No Mode");
assert("range(2, 10, 5)", MathParser.evaluate("range(2, 10, 5)").result, 8);
assert("lcm(4, 6)", MathParser.evaluate("lcm(4, 6)").result, 12);
assert("hcf(12, 18)", MathParser.evaluate("hcf(12, 18)").result, 6);
assert("mod(17, 5)", MathParser.evaluate("mod(17, 5)").result, 2);

// 9. Fractions
const f1 = MathParser.decimalToFraction(3.5);
assert("Fraction 3.5 improper", f1.improper, "7/2");
assert("Fraction 3.5 mixed", f1.mixed, "3 1/2");
const f2 = MathParser.decimalToFraction(0.125);
assert("Fraction 0.125 improper", f2.improper, "1/8");

// 10. Natural Language Queries
assert("15% of 240", MathParser.evaluate("15% of 240").result, 36);
assert("half of 90", MathParser.evaluate("half of 90").result, 45);
assert("sqrt of 144", MathParser.evaluate("sqrt of 144").result, 12);

// 11. Step-by-Step Breakdown ("Show Your Work")
const stepResult = MathParser.evaluate("2 + 3 * 4");
assert("Step count > 0", stepResult.steps.length > 0, true);
console.log("  Steps logged:", JSON.stringify(stepResult.steps));

console.log(`\nResults: ${passed} passed, ${failed} failed`);
if (failed > 0) process.exit(1);

