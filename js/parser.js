/**
 * MathParser - Comprehensive Tokenizer, Recursive-Descent AST Parser, and Evaluator
 * 
 * Replaces all eval() usage with a safe, deterministic mathematical engine.
 * Supports:
 * - Basic arithmetic (+, -, *, /, ^) with standard operator precedence
 * - Cascading percentages (e.g. 200 + 10% - 5% = 209, 50% = 0.5, 200 * 10% = 20)
 * - Implicit multiplication (e.g. 2(3) = 6, 2π, 2sin(30))
 * - Scientific functions: sin, cos, tan, asin, acos, atan (DEG / RAD)
 * - Logarithms: log (base 10), ln (natural)
 * - Powers & roots: x^y, x², √x, √(x), y√x, root(degree, x)
 * - Combinatorics: factorial (!), nPr (permutations), nCr (combinations)
 * - Statistics: mean, median, mode (with multi-mode / no-mode handling), sd, var, range, lcm, hcf
 * - Modular arithmetic: mod(a, b)
 * - Random: rand(), rand(min, max)
 * - Fraction conversion: decimal -> improper & mixed fractions
 * - "Show your work" step-by-step resolution logging
 * - Natural-language math query translation
 */

(function (root, factory) {
    if (typeof module === 'object' && module.exports) {
        module.exports = factory();
    } else {
        root.MathParser = factory();
    }
}(typeof self !== 'undefined' ? self : this, function () {
    'use strict';

    const TRIG_EPSILON = 1e-12;

    class CalculationError extends Error {
        constructor(message) {
            super(message);
            this.name = 'CalculationError';
        }
    }

    // ==========================================
    // HELPER FUNCTIONS & MATH UTILITIES
    // ==========================================

    function cleanFloat(val) {
        if (typeof val !== 'number' || !Number.isFinite(val)) return val;
        // Trim floating-point artifacts e.g. 0.1 + 0.2 = 0.30000000000000004 -> 0.3
        return Number(Number(val.toPrecision(14)).toString());
    }

    function cleanTrigResult(val) {
        if (Math.abs(val) < TRIG_EPSILON) return 0;
        if (Math.abs(val - 1) < TRIG_EPSILON) return 1;
        if (Math.abs(val + 1) < TRIG_EPSILON) return -1;
        return cleanFloat(val);
    }

    function factorial(n) {
        if (!Number.isInteger(n) || n < 0) {
            throw new CalculationError("Invalid factorial");
        }
        if (n > 170) {
            throw new CalculationError("Factorial overflow");
        }
        let res = 1;
        for (let i = 2; i <= n; i++) {
            res *= i;
        }
        return res;
    }

    function permutation(n, r) {
        if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
            throw new CalculationError("Invalid permutation (nPr)");
        }
        return factorial(n) / factorial(n - r);
    }

    function combination(n, r) {
        if (!Number.isInteger(n) || !Number.isInteger(r) || n < 0 || r < 0 || r > n) {
            throw new CalculationError("Invalid combination (nCr)");
        }
        return factorial(n) / (factorial(r) * factorial(n - r));
    }

    function gcd(a, b) {
        a = Math.abs(Math.trunc(a));
        b = Math.abs(Math.trunc(b));
        while (b !== 0) {
            const t = b;
            b = a % b;
            a = t;
        }
        return a;
    }

    function lcm(a, b) {
        a = Math.abs(Math.trunc(a));
        b = Math.abs(Math.trunc(b));
        if (a === 0 || b === 0) return 0;
        return (a / gcd(a, b)) * b;
    }

    function calculateMean(numbers) {
        if (!numbers || numbers.length === 0) throw new CalculationError("Empty dataset for mean");
        return numbers.reduce((s, v) => s + v, 0) / numbers.length;
    }

    function calculateVariance(numbers) {
        if (!numbers || numbers.length === 0) throw new CalculationError("Empty dataset for variance");
        const m = calculateMean(numbers);
        return numbers.reduce((s, v) => s + Math.pow(v - m, 2), 0) / numbers.length;
    }

    function calculateSD(numbers) {
        return Math.sqrt(calculateVariance(numbers));
    }

    function calculateRange(numbers) {
        if (!numbers || numbers.length === 0) throw new CalculationError("Empty dataset for range");
        return Math.max(...numbers) - Math.min(...numbers);
    }

    function calculateMedian(numbers) {
        if (!numbers || numbers.length === 0) throw new CalculationError("Empty dataset for median");
        const s = [...numbers].sort((a, b) => a - b);
        const mid = Math.floor(s.length / 2);
        return s.length % 2 === 0 ? (s[mid - 1] + s[mid]) / 2 : s[mid];
    }

    function calculateMode(numbers) {
        const clean = numbers.filter(n => typeof n === 'number' && Number.isFinite(n));
        if (clean.length === 0) throw new CalculationError("Invalid input for mode");
        if (clean.length === 1) return [clean[0]];

        const PRECISION = 9;
        const round = n => Object.is(n, -0) ? 0 : Number(n.toFixed(PRECISION));
        const freq = {};
        for (const num of clean) {
            const key = round(num);
            freq[key] = (freq[key] || 0) + 1;
        }

        const maxCount = Math.max(...Object.values(freq));
        if (maxCount === 1) {
            return null; // No mode
        }

        const modes = Object.keys(freq)
            .filter(k => freq[k] === maxCount)
            .map(Number)
            .sort((a, b) => a - b);

        return modes;
    }

    // Continued fraction algorithm for decimal to fraction conversion
    function decimalToFraction(decimal, tolerance = 1e-12, maxDenominator = 1000000) {
        if (typeof decimal !== 'number' || !Number.isFinite(decimal)) return null;
        if (Number.isInteger(decimal)) {
            return {
                improper: `${decimal}`,
                mixed: `${decimal}`,
                numerator: decimal,
                denominator: 1
            };
        }

        const sign = decimal < 0 ? -1 : 1;
        let x = Math.abs(decimal);
        let a = Math.floor(x);
        let h1 = 1, h2 = 0, k1 = 0, k2 = 1;
        let b = x;

        while (true) {
            a = Math.floor(b);
            const h = a * h1 + h2;
            const k = a * k1 + k2;

            if (k > maxDenominator) break;

            h2 = h1; h1 = h;
            k2 = k1; k1 = k;

            const diff = Math.abs(x - (h1 / k1));
            if (diff < tolerance) break;

            const fractionalPart = b - a;
            if (fractionalPart < Number.EPSILON) break;
            b = 1 / fractionalPart;
        }

        const num = sign * h1;
        const den = k1;
        const divisor = gcd(num, den);
        const simpNum = num / divisor;
        const simpDen = den / divisor;

        const improper = simpDen === 1 ? `${simpNum}` : `${simpNum}/${simpDen}`;

        let mixed = improper;
        if (Math.abs(simpNum) > simpDen && simpDen > 1) {
            const whole = Math.trunc(simpNum / simpDen);
            const rem = Math.abs(simpNum % simpDen);
            mixed = `${whole} ${rem}/${simpDen}`;
        }

        return {
            improper,
            mixed,
            numerator: simpNum,
            denominator: simpDen
        };
    }

    // ==========================================
    // CASCADING PERCENTAGE PREPROCESSOR
    // ==========================================

    /**
     * Resolves cascading percentages without eval()
     * e.g.:
     *   "200 + 10%" -> "200 + 20"
     *   "200 + 10% - 5%" -> "220 - 11"
     *   "50%" -> "0.5"
     *   "200 * 10%" -> "200 * (10 / 100)"
     *   "200 / 10%" -> "200 / (10 / 100)"
     */
    function getSubexpressionBase(leftPart) {
        let depth = 0;
        for (let i = leftPart.length - 1; i >= 0; i--) {
            const c = leftPart[i];
            if (c === ')') depth++;
            else if (c === '(') {
                if (depth === 0) return leftPart.slice(i + 1);
                depth--;
            }
        }
        return leftPart;
    }

    function resolvePercentages(expression, angleMode) {
        const percentRegex = /(\d+(?:\.\d+)?)%/;
        let expr = expression;

        while (percentRegex.test(expr)) {
            const match = expr.match(percentRegex);
            if (!match) break;

            const percentValue = parseFloat(match[1]);
            const percentIndex = match.index;
            const matchLen = match[0].length;

            // Find preceding operator if any
            let opIndex = percentIndex - 1;
            while (opIndex >= 0 && expr[opIndex] === ' ') {
                opIndex--;
            }

            const op = opIndex >= 0 ? expr[opIndex] : null;

            // Standalone percentage (e.g. at start or after open parenthesis or non-additive op)
            if (!op || !['+', '-', '*', '/'].includes(op) || (opIndex === 0 && op === '-')) {
                expr = expr.slice(0, percentIndex) + `(${percentValue}/100)` + expr.slice(percentIndex + matchLen);
                continue;
            }

            // If preceded by + or -, calculate the accumulated base to the left (scoped to open brackets if nested)
            if (op === '+' || op === '-') {
                const leftPart = expr.slice(0, opIndex).trim();
                const baseExpr = getSubexpressionBase(leftPart).trim();
                if (!baseExpr) {
                    expr = expr.slice(0, percentIndex) + `(${percentValue}/100)` + expr.slice(percentIndex + matchLen);
                    continue;
                }

                // Recursively evaluate the base value so far using our parser
                let baseVal;
                try {
                    baseVal = evaluateSimple(baseExpr, angleMode);
                } catch (e) {
                    throw new CalculationError("Invalid percentage expression");
                }

                if (typeof baseVal !== 'number' || !Number.isFinite(baseVal)) {
                    throw new CalculationError("Invalid percentage base");
                }

                const replacement = String(cleanFloat((baseVal * percentValue) / 100));
                expr = expr.slice(0, percentIndex) + replacement + expr.slice(percentIndex + matchLen);
            } else {
                // Multiplication or division: standard (percent / 100)
                expr = expr.slice(0, percentIndex) + `(${percentValue}/100)` + expr.slice(percentIndex + matchLen);
            }
        }

        return expr;
    }

    // ==========================================
    // TOKENIZER
    // ==========================================

    const TOKEN_NUMBER = 'NUMBER';
    const TOKEN_OP = 'OP';
    const TOKEN_LPAREN = 'LPAREN';
    const TOKEN_RPAREN = 'RPAREN';
    const TOKEN_COMMA = 'COMMA';
    const TOKEN_IDENT = 'IDENT';
    const TOKEN_POSTFIX = 'POSTFIX';

    const KNOWN_FUNCS = new Set([
        'sin', 'cos', 'tan', 'asin', 'acos', 'atan',
        'log', 'ln', 'sqrt', 'mean', 'median', 'mode',
        'sd', 'var', 'range', 'lcm', 'hcf', 'mod', 'rand',
        'root', 'abs'
    ]);

    const KNOWN_CONSTANTS = {
        'pi': Math.PI,
        'π': Math.PI,
        'e': Math.E
    };

    function tokenize(input) {
        const tokens = [];
        let i = 0;
        const len = input.length;

        while (i < len) {
            const ch = input[i];

            if (/\s/.test(ch)) {
                i++;
                continue;
            }

            // Numbers: integer or decimal
            if (/\d/.test(ch) || (ch === '.' && i + 1 < len && /\d/.test(input[i + 1]))) {
                let numStr = '';
                while (i < len && (/\d/.test(input[i]) || input[i] === '.')) {
                    numStr += input[i];
                    i++;
                }
                tokens.push({ type: TOKEN_NUMBER, value: parseFloat(numStr), raw: numStr });
                continue;
            }

            // Parentheses
            if (ch === '(') {
                tokens.push({ type: TOKEN_LPAREN, value: '(' });
                i++;
                continue;
            }
            if (ch === ')') {
                tokens.push({ type: TOKEN_RPAREN, value: ')' });
                i++;
                continue;
            }

            // Comma
            if (ch === ',') {
                tokens.push({ type: TOKEN_COMMA, value: ',' });
                i++;
                continue;
            }

            // Postfix operators: ! (factorial), ² (square)
            if (ch === '!') {
                tokens.push({ type: TOKEN_POSTFIX, value: '!' });
                i++;
                continue;
            }
            if (ch === '²') {
                tokens.push({ type: TOKEN_POSTFIX, value: '²' });
                i++;
                continue;
            }

            // Square root symbol: √
            if (ch === '√') {
                // If preceded by a number/rparen, check if this is an infix nth-root (e.g. 3√8 or 10√1024)
                const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
                if (prev && (prev.type === TOKEN_NUMBER || prev.type === TOKEN_RPAREN || prev.type === TOKEN_POSTFIX)) {
                    tokens.push({ type: TOKEN_OP, value: 'nroot' });
                } else {
                    tokens.push({ type: TOKEN_IDENT, value: 'sqrt' });
                }
                i++;
                continue;
            }

            // Infix combinatorics: P or C or nPr or nCr (e.g. 5P2, 5C2, 5nPr2, 5nCr2)
            if ((ch === 'P' || ch === 'p' || ch === 'C' || ch === 'c') && i + 1 < len) {
                const prev = tokens.length > 0 ? tokens[tokens.length - 1] : null;
                if (prev && (prev.type === TOKEN_NUMBER || prev.type === TOKEN_RPAREN || prev.type === TOKEN_POSTFIX)) {
                    const isP = (ch === 'P' || ch === 'p');
                    tokens.push({ type: TOKEN_OP, value: isP ? 'nPr' : 'nCr' });
                    i++;
                    continue;
                }
            }

            // Basic operators
            if (['+', '-', '*', '/', '×', '÷', '^'].includes(ch)) {
                let op = ch;
                if (op === '×') op = '*';
                if (op === '÷') op = '/';
                tokens.push({ type: TOKEN_OP, value: op });
                i++;
                continue;
            }

            // Double asterisks ** for power
            if (ch === '*' && i + 1 < len && input[i + 1] === '*') {
                tokens.push({ type: TOKEN_OP, value: '^' });
                i += 2;
                continue;
            }

            // Identifiers / words: functions or constants
            if (/[a-zA-Zπ]/.test(ch)) {
                let word = '';
                while (i < len && /[a-zA-Z0-9_π]/.test(input[i])) {
                    word += input[i];
                    i++;
                }

                // Check combinatorics keywords npr / ncr
                const lowerWord = word.toLowerCase();
                if (lowerWord === 'npr' || lowerWord === 'ncr') {
                    tokens.push({ type: TOKEN_OP, value: lowerWord === 'npr' ? 'nPr' : 'nCr' });
                    continue;
                }

                // Check constant
                if (word in KNOWN_CONSTANTS) {
                    tokens.push({ type: TOKEN_NUMBER, value: KNOWN_CONSTANTS[word], raw: word });
                    continue;
                }

                tokens.push({ type: TOKEN_IDENT, value: lowerWord });
                continue;
            }

            throw new CalculationError(`Unexpected character: "${ch}"`);
        }

        return tokens;
    }

    /**
     * Insert implicit multiplication tokens where needed:
     * - Number followed by ( or function or constant: 2(3) -> 2 * (3), 2sin(30) -> 2 * sin(30), 2π -> 2 * π
     * - ) followed by Number or ( or function: (2)(3) -> (2) * (3), (2)3 -> (2) * 3
     * - Postfix (! or ²) followed by Number or ( or function: 5! 2 -> 5! * 2
     */
    function insertImplicitMultiplication(tokens) {
        const result = [];
        for (let i = 0; i < tokens.length; i++) {
            const current = tokens[i];
            result.push(current);

            if (i + 1 < tokens.length) {
                const next = tokens[i + 1];

                const isCurrentVarOrNonFunc = current.type === TOKEN_IDENT && !KNOWN_FUNCS.has(current.value);
                const currentCanImplicitlyMultiply =
                    current.type === TOKEN_NUMBER ||
                    current.type === TOKEN_RPAREN ||
                    current.type === TOKEN_POSTFIX ||
                    isCurrentVarOrNonFunc;

                const nextCanBeImplicitlyMultiplied =
                    next.type === TOKEN_LPAREN ||
                    next.type === TOKEN_NUMBER ||
                    next.type === TOKEN_IDENT;

                if (currentCanImplicitlyMultiply && nextCanBeImplicitlyMultiplied) {
                    // Avoid inserting between degree and root in nroot
                    if (next.type !== TOKEN_OP || next.value !== 'nroot') {
                        result.push({ type: TOKEN_OP, value: '*' });
                    }
                }
            }
        }
        return result;
    }

    // ==========================================
    // AST PARSER & EVALUATOR (PRATT / PRECEDENCE)
    // ==========================================

    class Parser {
        constructor(tokens, angleMode = 'DEG', stepTracker = null, variables = {}) {
            this.tokens = tokens;
            this.pos = 0;
            this.angleMode = angleMode;
            this.stepTracker = stepTracker;
            this.variables = variables || {};
        }

        peek() {
            return this.tokens[this.pos] || null;
        }

        consume(expectedType = null, expectedValue = null) {
            const tok = this.peek();
            if (!tok) {
                throw new CalculationError("Unexpected end of expression");
            }
            if (expectedType && tok.type !== expectedType) {
                throw new CalculationError(`Expected token type ${expectedType}, found ${tok.type}`);
            }
            if (expectedValue && tok.value !== expectedValue) {
                throw new CalculationError(`Expected "${expectedValue}", found "${tok.value}"`);
            }
            this.pos++;
            return tok;
        }

        parseExpression() {
            return this.parseBinary(0);
        }

        // Operator precedence table
        getPrecedence(token) {
            if (!token || token.type !== TOKEN_OP) return 0;
            switch (token.value) {
                case '+':
                case '-':
                    return 1;
                case '*':
                case '/':
                case 'nPr':
                case 'nCr':
                    return 2;
                case '^':
                case 'nroot':
                    return 3;
                default:
                    return 0;
            }
        }

        isRightAssociative(token) {
            return token.value === '^' || token.value === 'nroot';
        }

        parseBinary(minPrecedence) {
            let left = this.parsePrefix();

            // Handle postfix operators (! and ²)
            while (this.peek() && this.peek().type === TOKEN_POSTFIX) {
                const postfixTok = this.consume(TOKEN_POSTFIX);
                const prevVal = left;
                if (postfixTok.value === '!') {
                    left = factorial(left);
                    this.recordStep(`${prevVal}!`, left);
                } else if (postfixTok.value === '²') {
                    left = cleanFloat(Math.pow(left, 2));
                    this.recordStep(`${prevVal}²`, left);
                }
            }

            while (true) {
                const tok = this.peek();
                if (!tok || tok.type !== TOKEN_OP) break;

                const prec = this.getPrecedence(tok);
                if (prec < minPrecedence) break;

                const op = this.consume(TOKEN_OP).value;
                const nextMinPrec = this.isRightAssociative(tok) ? prec : prec + 1;
                const right = this.parseBinary(nextMinPrec);

                const prevLeft = left;
                left = this.applyOp(op, left, right);
                this.recordStep(`${prevLeft} ${op} ${right}`, left);

                // Check again for postfix on new result
                while (this.peek() && this.peek().type === TOKEN_POSTFIX) {
                    const postTok = this.consume(TOKEN_POSTFIX);
                    const pVal = left;
                    if (postTok.value === '!') {
                        left = factorial(left);
                        this.recordStep(`${pVal}!`, left);
                    } else if (postTok.value === '²') {
                        left = cleanFloat(Math.pow(left, 2));
                        this.recordStep(`${pVal}²`, left);
                    }
                }
            }

            return left;
        }

        parsePrefix() {
            const tok = this.peek();
            if (!tok) throw new CalculationError("Unexpected end of expression");

            // Unary + or -
            if (tok.type === TOKEN_OP && (tok.value === '+' || tok.value === '-')) {
                this.consume(TOKEN_OP);
                const operand = this.parseBinary(3); // high precedence for unary minus
                return tok.value === '-' ? -operand : operand;
            }

            // Numbers
            if (tok.type === TOKEN_NUMBER) {
                return this.consume(TOKEN_NUMBER).value;
            }

            // Parenthesized expression
            if (tok.type === TOKEN_LPAREN) {
                this.consume(TOKEN_LPAREN);
                const val = this.parseExpression();
                this.consume(TOKEN_RPAREN, ')');
                return val;
            }

            // Function call or standalone identifier
            if (tok.type === TOKEN_IDENT) {
                const funcName = this.consume(TOKEN_IDENT).value;

                // Function with parentheses: func(arg1, arg2, ...)
                if (this.peek() && this.peek().type === TOKEN_LPAREN) {
                    this.consume(TOKEN_LPAREN);
                    const args = [];
                    if (this.peek() && this.peek().type !== TOKEN_RPAREN) {
                        args.push(this.parseExpression());
                        while (this.peek() && this.peek().type === TOKEN_COMMA) {
                            this.consume(TOKEN_COMMA);
                            args.push(this.parseExpression());
                        }
                    }
                    this.consume(TOKEN_RPAREN, ')');
                    const res = this.callFunction(funcName, args);
                    this.recordStep(`${funcName}(${args.join(', ')})`, res);
                    return res;
                }

                // Variable lookup (e.g. x)
                const lowerName = funcName.toLowerCase();
                if (this.variables && Object.prototype.hasOwnProperty.call(this.variables, lowerName)) {
                    return this.variables[lowerName];
                }
                if (this.variables && Object.prototype.hasOwnProperty.call(this.variables, funcName)) {
                    return this.variables[funcName];
                }

                // Function with single immediate operand e.g. √25 or sin 30
                if (funcName === 'sqrt') {
                    const operand = this.parseBinary(3);
                    if (operand < 0) throw new CalculationError("Invalid square root of negative number");
                    const res = cleanFloat(Math.sqrt(operand));
                    this.recordStep(`√${operand}`, res);
                    return res;
                }

                throw new CalculationError(`Unknown function or variable: ${funcName}`);
            }

            throw new CalculationError(`Unexpected token: ${tok.value}`);
        }

        applyOp(op, a, b) {
            switch (op) {
                case '+':
                    return cleanFloat(a + b);
                case '-':
                    return cleanFloat(a - b);
                case '*':
                    return cleanFloat(a * b);
                case '/':
                    if (b === 0) throw new CalculationError("Cannot divide by zero");
                    return cleanFloat(a / b);
                case '^': {
                    if (a < 0 && !Number.isInteger(b)) {
                        throw new CalculationError("Complex result (negative base with fractional exponent)");
                    }
                    const res = Math.pow(a, b);
                    if (!Number.isFinite(res)) throw new CalculationError("Numeric overflow in exponentiation");
                    return cleanFloat(res);
                }
                case 'nroot': {
                    // a is degree, b is radicand: e.g. 3 nroot 8 = 2
                    if (a === 0) throw new CalculationError("Invalid 0th root");
                    if (b < 0 && a % 2 === 0) throw new CalculationError("Invalid even root of negative number");
                    const sign = b < 0 ? -1 : 1;
                    const res = sign * Math.pow(Math.abs(b), 1 / a);
                    return cleanFloat(res);
                }
                case 'nPr':
                    return permutation(a, b);
                case 'nCr':
                    return combination(a, b);
                default:
                    throw new CalculationError(`Unsupported operator: ${op}`);
            }
        }

        callFunction(name, args) {
            switch (name) {
                case 'sin': {
                    if (args.length !== 1) throw new CalculationError("sin requires 1 argument");
                    let rad = args[0];
                    if (this.angleMode === 'DEG') rad *= Math.PI / 180;
                    return cleanTrigResult(Math.sin(rad));
                }
                case 'cos': {
                    if (args.length !== 1) throw new CalculationError("cos requires 1 argument");
                    let rad = args[0];
                    if (this.angleMode === 'DEG') rad *= Math.PI / 180;
                    return cleanTrigResult(Math.cos(rad));
                }
                case 'tan': {
                    if (args.length !== 1) throw new CalculationError("tan requires 1 argument");
                    const val = args[0];
                    if (this.angleMode === 'DEG') {
                        const norm = ((val % 180) + 180) % 180;
                        if (Math.abs(norm - 90) < 1e-10) throw new CalculationError("Undefined tangent");
                        return cleanTrigResult(Math.tan(val * Math.PI / 180));
                    } else {
                        const norm = ((val % Math.PI) + Math.PI) % Math.PI;
                        if (Math.abs(norm - Math.PI / 2) < 1e-10) throw new CalculationError("Undefined tangent");
                        return cleanTrigResult(Math.tan(val));
                    }
                }
                case 'asin': {
                    if (args.length !== 1) throw new CalculationError("asin requires 1 argument");
                    if (args[0] < -1 || args[0] > 1) throw new CalculationError("Invalid asin domain [-1, 1]");
                    let res = Math.asin(args[0]);
                    if (this.angleMode === 'DEG') res *= 180 / Math.PI;
                    return cleanFloat(res);
                }
                case 'acos': {
                    if (args.length !== 1) throw new CalculationError("acos requires 1 argument");
                    if (args[0] < -1 || args[0] > 1) throw new CalculationError("Invalid acos domain [-1, 1]");
                    let res = Math.acos(args[0]);
                    if (this.angleMode === 'DEG') res *= 180 / Math.PI;
                    return cleanFloat(res);
                }
                case 'atan': {
                    if (args.length !== 1) throw new CalculationError("atan requires 1 argument");
                    let res = Math.atan(args[0]);
                    if (this.angleMode === 'DEG') res *= 180 / Math.PI;
                    return cleanFloat(res);
                }
                case 'log': {
                    if (args.length !== 1) throw new CalculationError("log requires 1 argument");
                    if (args[0] <= 0) throw new CalculationError("Invalid logarithm of non-positive number");
                    return cleanFloat(Math.log10(args[0]));
                }
                case 'ln': {
                    if (args.length !== 1) throw new CalculationError("ln requires 1 argument");
                    if (args[0] <= 0) throw new CalculationError("Invalid natural logarithm of non-positive number");
                    return cleanFloat(Math.log(args[0]));
                }
                case 'sqrt': {
                    if (args.length !== 1) throw new CalculationError("sqrt requires 1 argument");
                    if (args[0] < 0) throw new CalculationError("Invalid square root of negative number");
                    return cleanFloat(Math.sqrt(args[0]));
                }
                case 'root': {
                    // root(degree, value)
                    if (args.length !== 2) throw new CalculationError("root requires 2 arguments (degree, value)");
                    const degree = args[0];
                    const value = args[1];
                    if (degree === 0) throw new CalculationError("Invalid 0th root");
                    if (value < 0 && degree % 2 === 0) throw new CalculationError("Invalid even root of negative number");
                    const sign = value < 0 ? -1 : 1;
                    return cleanFloat(sign * Math.pow(Math.abs(value), 1 / degree));
                }
                case 'mean':
                    return cleanFloat(calculateMean(args));
                case 'median':
                    return cleanFloat(calculateMedian(args));
                case 'mode': {
                    const modes = calculateMode(args);
                    if (modes === null) return "No Mode";
                    if (modes.length === 1) return modes[0];
                    return modes.join(', ');
                }
                case 'sd':
                    return cleanFloat(calculateSD(args));
                case 'var':
                    return cleanFloat(calculateVariance(args));
                case 'range':
                    return cleanFloat(calculateRange(args));
                case 'lcm': {
                    if (args.length < 2) throw new CalculationError("LCM requires at least two integers");
                    if (!args.every(n => Number.isInteger(n))) throw new CalculationError("LCM requires integers");
                    return args.reduce((acc, v) => lcm(acc, v));
                }
                case 'hcf': {
                    if (args.length < 2) throw new CalculationError("HCF requires at least two integers");
                    if (!args.every(n => Number.isInteger(n))) throw new CalculationError("HCF requires integers");
                    return args.reduce((acc, v) => gcd(acc, v));
                }
                case 'mod': {
                    if (args.length !== 2) throw new CalculationError("mod requires 2 arguments");
                    if (args[1] === 0) throw new CalculationError("mod by zero");
                    return cleanFloat(args[0] % args[1]);
                }
                case 'rand': {
                    if (args.length === 0) {
                        return cleanFloat(Math.random());
                    } else if (args.length === 2) {
                        const min = Math.ceil(args[0]);
                        const max = Math.floor(args[1]);
                        if (min > max) throw new CalculationError("Invalid rand range (min > max)");
                        return Math.floor(Math.random() * (max - min + 1)) + min;
                    } else {
                        throw new CalculationError("rand takes 0 or 2 arguments");
                    }
                }
                case 'abs': {
                    if (args.length !== 1) throw new CalculationError("abs requires 1 argument");
                    return cleanFloat(Math.abs(args[0]));
                }
                default:
                    throw new CalculationError(`Unknown function: ${name}`);
            }
        }

        recordStep(subExpr, stepResult) {
            if (this.stepTracker) {
                this.stepTracker.push({
                    step: this.stepTracker.length + 1,
                    expression: subExpr,
                    result: stepResult
                });
            }
        }
    }

    // Helper for evaluating expressions without tracking
    function evaluateSimple(expr, angleMode = 'DEG') {
        const tokens = tokenize(expr);
        const resolvedTokens = insertImplicitMultiplication(tokens);
        const parser = new Parser(resolvedTokens, angleMode, null);
        const result = parser.parseExpression();
        if (parser.peek()) {
            throw new CalculationError(`Unexpected extra token: ${parser.peek().value}`);
        }
        return result;
    }

    // ==========================================
    // NATURAL LANGUAGE TRANSLATOR
    // ==========================================

    function naturalLanguageToMath(query) {
        if (!query || typeof query !== 'string') return query;
        let text = query.trim().toLowerCase();

        // Strip thousands separator commas (e.g. 1,250 -> 1250, 1,000,000 -> 1000000)
        // while preserving function argument commas (e.g. mod(17, 5), mean(1, 2, 3))
        text = text.replace(/(\d),(\d{3})(?!\d)/g, '$1$2');

        // Conversions of common phrases
        // "15% of 240" -> "240 * 15%"
        // "half of 90" -> "90 / 2"
        // "quarter of 100" -> "100 / 4"
        text = text.replace(/half\s+of\s+([\d.]+)/gi, '($1 / 2)');
        text = text.replace(/quarter\s+of\s+([\d.]+)/gi, '($1 / 4)');
        text = text.replace(/(\d+(?:\.\d+)?)\s*%\s+of\s+([\d.]+)/gi, '($2 * $1%)');

        text = text.replace(/\bsquare\s+root\s+of\s+([0-9.]+)/gi, 'sqrt($1)');
        text = text.replace(/\bsqrt\s+of\s+([0-9.]+)/gi, 'sqrt($1)');
        text = text.replace(/\bcube\s+root\s+of\s+([0-9.]+)/gi, 'root(3, $1)');

        text = text.replace(/\bplus\b/gi, '+');
        text = text.replace(/\bminus\b/gi, '-');
        text = text.replace(/\btimes\b/gi, '*');
        text = text.replace(/\bmultiplied\s+by\b/gi, '*');
        text = text.replace(/\bdivided\s+by\b/gi, '/');
        text = text.replace(/\bover\b/gi, '/');
        text = text.replace(/\bto\s+the\s+power\s+of\b/gi, '^');
        text = text.replace(/\bsquared\b/gi, '²');

        return text;
    }

    // ==========================================
    // PUBLIC API
    // ==========================================

    function evaluate(rawExpression, options = {}) {
        const angleMode = options.angleMode || 'DEG';
        const trackSteps = options.trackSteps !== false;
        const steps = [];

        if (!rawExpression || typeof rawExpression !== 'string' || rawExpression.trim() === '') {
            return {
                result: null,
                formatted: '',
                steps: [],
                error: null
            };
        }

        try {
            // Step 1: Natural language translation if applicable
            let expr = naturalLanguageToMath(rawExpression);

            // Step 2: Cascading percentages
            expr = resolvePercentages(expr, angleMode);

            // Step 3: Tokenize
            const tokens = tokenize(expr);

            // Step 4: Implicit multiplication
            const processedTokens = insertImplicitMultiplication(tokens);

            // Step 5: Parse and evaluate
            const parser = new Parser(processedTokens, angleMode, trackSteps ? steps : null, options.variables || {});
            const result = parser.parseExpression();

            if (parser.peek()) {
                throw new CalculationError(`Unexpected token "${parser.peek().value}"`);
            }

            // Post-process non-numeric result (e.g. mode "No Mode" or "1, 2")
            if (typeof result === 'string') {
                return {
                    result,
                    formatted: result,
                    numericResult: null,
                    fraction: null,
                    steps,
                    error: null
                };
            }

            if (typeof result !== 'number' || !Number.isFinite(result)) {
                throw new CalculationError("Invalid calculation");
            }

            const cleanRes = cleanFloat(result);
            const fraction = decimalToFraction(cleanRes);

            return {
                result: cleanRes,
                formatted: cleanRes.toString(),
                numericResult: cleanRes,
                fraction,
                steps,
                error: null
            };
        } catch (err) {
            return {
                result: null,
                formatted: 'Error',
                numericResult: null,
                fraction: null,
                steps,
                error: err.message || 'Error'
            };
        }
    }

    function compileSingleExpression(subExpr, defaultAngleMode) {
        let clean = naturalLanguageToMath(subExpr);
        clean = resolvePercentages(clean, defaultAngleMode);
        const tokens = tokenize(clean);
        const processed = insertImplicitMultiplication(tokens);
        // Verify syntax with test scope { x: 1, y: 1 }
        const testParser = new Parser(processed, defaultAngleMode, null, { x: 1, y: 1 });
        testParser.parseExpression();
        if (testParser.peek()) {
            throw new CalculationError(`Unexpected token "${testParser.peek().value}"`);
        }
        return function (scope = {}, angleMode = defaultAngleMode) {
            try {
                const s = Object.assign({ x: 0, y: 0 }, scope);
                const parser = new Parser(processed, angleMode, null, s);
                const val = parser.parseExpression();
                return (typeof val === 'number' && Number.isFinite(val)) ? val : NaN;
            } catch (e) {
                return NaN;
            }
        };
    }

    function compile(rawExpression, options = {}) {
        const defaultAngleMode = options.angleMode || 'RAD';
        if (!rawExpression || typeof rawExpression !== 'string' || rawExpression.trim() === '') {
            return {
                evaluate: () => NaN,
                error: 'Empty expression'
            };
        }

        try {
            let expr = rawExpression.trim();

            // Normalize inequality symbols
            expr = expr.replace(/≤/g, '<=').replace(/≥/g, '>=');

            // Find relation operator: <=, >=, <, >, or =
            const relMatch = expr.match(/(<=|>=|<|>|=)/);

            if (!relMatch) {
                // No relation operator -> pure explicit function y = expr
                const evalFn = compileSingleExpression(expr, defaultAngleMode);
                return {
                    error: null,
                    isInequality: false,
                    isImplicit: false,
                    isVertical: false,
                    evaluate: evalFn
                };
            }

            const op = relMatch[1];
            let lhsStr = expr.slice(0, relMatch.index).trim();
            let rhsStr = expr.slice(relMatch.index + op.length).trim();

            // Case 1: Empty LHS (e.g. `<= x^2 - 4` or `< 2x + 1`) -> implicit 'y'
            if (!lhsStr) {
                lhsStr = 'y';
            }

            // Case 2: LHS is simple "y" or "f(x)" or "g(x)" and RHS does NOT contain y
            const isLhsJustY = /^(?:y|f\s*\(\s*x\s*\)|g\s*\(\s*x\s*\))$/i.test(lhsStr);
            const rhsHasY = /\by\b/i.test(rhsStr);
            if (isLhsJustY && !rhsHasY) {
                const evalFn = compileSingleExpression(rhsStr, defaultAngleMode);
                const isInequality = (op !== '=');
                const isStrict = (op === '<' || op === '>');
                const direction = (op === '<=' || op === '<') ? 'below' : ((op === '>=' || op === '>') ? 'above' : null);
                return {
                    error: null,
                    isInequality: isInequality,
                    isStrict: isStrict,
                    direction: direction,
                    inequalityOp: op,
                    isImplicit: false,
                    isVertical: false,
                    evaluate: evalFn
                };
            }

            // Case 3: LHS is simple "x" and RHS does NOT contain x or y (e.g. x = 4, x <= 2, x > -1)
            const isLhsJustX = /^x$/i.test(lhsStr);
            const rhsHasXorY = /\b[xy]\b/i.test(rhsStr);
            if (isLhsJustX && !rhsHasXorY) {
                const evalResult = evaluate(rhsStr, { angleMode: defaultAngleMode });
                if (evalResult.error) {
                    throw new CalculationError(evalResult.error);
                }
                const verticalX = evalResult.numericResult !== null ? evalResult.numericResult : evalResult.result;
                if (typeof verticalX !== 'number' || !Number.isFinite(verticalX)) {
                    throw new CalculationError('Invalid vertical line bound');
                }
                const isInequality = (op !== '=');
                const isStrict = (op === '<' || op === '>');
                const direction = (op === '<=' || op === '<') ? 'left' : ((op === '>=' || op === '>') ? 'right' : null);
                return {
                    error: null,
                    isInequality: isInequality,
                    isVertical: true,
                    isImplicit: false,
                    verticalX: verticalX,
                    inequalityOp: op,
                    direction: direction,
                    isStrict: isStrict,
                    evaluate: function () { return NaN; }
                };
            }

            // Case 4: General multi-variable equation or inequation (e.g. 2x + y >= 30, x^2 + y^2 = 25)
            const evalLHS = compileSingleExpression(lhsStr, defaultAngleMode);
            const evalRHS = compileSingleExpression(rhsStr, defaultAngleMode);
            const F = (x, y) => evalLHS({ x, y }) - evalRHS({ x, y });

            // Check if F(x, y) is linear: a*x + b*y + c
            const cVal = F(0, 0);
            const aVal = F(1, 0) - cVal;
            const bVal = F(0, 1) - cVal;

            const isLinear = Number.isFinite(aVal) && Number.isFinite(bVal) && Number.isFinite(cVal) &&
                Math.abs(F(2, 3) - (aVal * 2 + bVal * 3 + cVal)) < 1e-7 &&
                Math.abs(F(-1, 2) - (aVal * (-1) + bVal * 2 + cVal)) < 1e-7 &&
                Math.abs(F(3, -2) - (aVal * 3 + bVal * (-2) + cVal)) < 1e-7;

            if (isLinear) {
                const isInequality = (op !== '=');
                const isStrict = (op === '<' || op === '>');

                if (Math.abs(bVal) > 1e-9) {
                    // Non-zero b: solve for y = slope * x + yIntercept
                    const slope = -aVal / bVal;
                    const yIntercept = -cVal / bVal;
                    const xIntercept = Math.abs(aVal) > 1e-9 ? -cVal / aVal : null;

                    // If b < 0, dividing by negative flips inequality
                    let effOp = op;
                    if (bVal < 0) {
                        if (op === '<=') effOp = '>=';
                        else if (op === '<') effOp = '>';
                        else if (op === '>=') effOp = '<=';
                        else if (op === '>') effOp = '<';
                    }

                    const direction = (effOp === '<=' || effOp === '<') ? 'below' :
                                     ((effOp === '>=' || effOp === '>') ? 'above' : null);

                    return {
                        error: null,
                        isInequality: isInequality,
                        isStrict: isStrict,
                        direction: direction,
                        inequalityOp: effOp,
                        isImplicit: false,
                        isVertical: false,
                        slope: slope,
                        yIntercept: yIntercept,
                        xIntercept: xIntercept,
                        evaluate: function (scope) {
                            return slope * scope.x + yIntercept;
                        }
                    };
                } else if (Math.abs(aVal) > 1e-9) {
                    // b is 0, vertical line: a*x + c op 0 => x op -c/a
                    const verticalX = -cVal / aVal;
                    let effOp = op;
                    if (aVal < 0) {
                        if (op === '<=') effOp = '>=';
                        else if (op === '<') effOp = '>';
                        else if (op === '>=') effOp = '<=';
                        else if (op === '>') effOp = '<';
                    }
                    const direction = (effOp === '<=' || effOp === '<') ? 'left' :
                                     ((effOp === '>=' || effOp === '>') ? 'right' : null);

                    return {
                        error: null,
                        isInequality: isInequality,
                        isVertical: true,
                        isImplicit: false,
                        verticalX: verticalX,
                        direction: direction,
                        isStrict: isStrict,
                        inequalityOp: effOp,
                        evaluate: function () { return NaN; }
                    };
                }
            }

            // Case 5: Non-linear implicit equation or inequation (e.g. x^2 + y^2 = 25, x^2 + y^2 <= 16)
            return {
                error: null,
                isImplicit: true,
                isInequality: (op !== '='),
                inequalityOp: op,
                isStrict: (op === '<' || op === '>'),
                F: F,
                test: function (x, y) {
                    const val = F(x, y);
                    if (!Number.isFinite(val)) return false;
                    switch (op) {
                        case '<=': return val <= 1e-7;
                        case '<':  return val < -1e-7;
                        case '>=': return val >= -1e-7;
                        case '>':  return val > 1e-7;
                        case '=':  return Math.abs(val) < 0.05;
                        default:   return false;
                    }
                },
                evaluate: function () { return NaN; }
            };
        } catch (err) {
            return {
                evaluate: () => NaN,
                error: err.message || 'Syntax error'
            };
        }
    }

    return {
        evaluate,
        compile,
        tokenize,
        resolvePercentages,
        naturalLanguageToMath,
        decimalToFraction,
        CalculationError
    };
}));
