// js/parser.test.js - Vitest tests for MathParser
import { describe, it, expect } from 'vitest';
import { MathParser } from './test-utils.js';

describe('MathParser', () => {
  describe('Basic Arithmetic & Precedence', () => {
    it('evaluates 2 + 3 * 4 = 14', () => {
      expect(MathParser.evaluate('2 + 3 * 4').result).toBe(14);
    });

    it('evaluates (2 + 3) * 4 = 20', () => {
      expect(MathParser.evaluate('(2 + 3) * 4').result).toBe(20);
    });

    it('evaluates 10 - 2 - 3 = 5 (left-associative)', () => {
      expect(MathParser.evaluate('10 - 2 - 3').result).toBe(5);
    });

    it('evaluates 20 / 4 / 2 = 2.5 (left-associative)', () => {
      expect(MathParser.evaluate('20 / 4 / 2').result).toBe(2.5);
    });

    it('evaluates -5 + 8 = 3 (unary minus)', () => {
      expect(MathParser.evaluate('-5 + 8').result).toBe(3);
    });

    it('evaluates 5 * -3 = -15 (unary minus)', () => {
      expect(MathParser.evaluate('5 * -3').result).toBe(-15);
    });

    it('evaluates 2 ^ 3 ^ 2 = 512 (right-associative)', () => {
      expect(MathParser.evaluate('2 ^ 3 ^ 2').result).toBe(512);
    });

    it('evaluates 3² + 4² = 25', () => {
      expect(MathParser.evaluate('3² + 4²').result).toBe(25);
    });
  });

  describe('Implicit Multiplication', () => {
    it('evaluates 2(3) = 6', () => {
      expect(MathParser.evaluate('2(3)').result).toBe(6);
    });

    it('evaluates (2)(3) = 6', () => {
      expect(MathParser.evaluate('(2)(3)').result).toBe(6);
    });

    it('evaluates 4(2 + 3) = 20', () => {
      expect(MathParser.evaluate('4(2 + 3)').result).toBe(20);
    });

    it('evaluates (2 + 3)4 = 20', () => {
      expect(MathParser.evaluate('(2 + 3)4').result).toBe(20);
    });

    it('evaluates 2π = 2 * π', () => {
      expect(MathParser.evaluate('2π').result).toBeCloseTo(2 * Math.PI);
    });

    it('evaluates 2e = 2 * e', () => {
      expect(MathParser.evaluate('2e').result).toBeCloseTo(2 * Math.E);
    });

    it('evaluates 2sin(30) in DEG mode = 1', () => {
      expect(MathParser.evaluate('2sin(30)', { angleMode: 'DEG' }).result).toBeCloseTo(1);
    });
  });

  describe('Percentages', () => {
    it('evaluates 50% = 0.5', () => {
      expect(MathParser.evaluate('50%').result).toBe(0.5);
    });

    it('evaluates 200 * 10% = 20', () => {
      expect(MathParser.evaluate('200 * 10%').result).toBe(20);
    });

    it('evaluates 200 / 10% = 2000', () => {
      expect(MathParser.evaluate('200 / 10%').result).toBe(2000);
    });

    it('evaluates 200 + 10% = 220', () => {
      expect(MathParser.evaluate('200 + 10%').result).toBe(220);
    });

    it('evaluates cascading: 200 + 10% - 5% = 209', () => {
      expect(MathParser.evaluate('200 + 10% - 5%').result).toBe(209);
    });

    it('evaluates 100 - 20% = 80', () => {
      expect(MathParser.evaluate('100 - 20%').result).toBe(80);
    });
  });

  describe('Error Handling', () => {
    it('returns error for divide by zero', () => {
      expect(MathParser.evaluate('10 / 0').error).not.toBeNull();
    });

    it('returns error for log(-5)', () => {
      expect(MathParser.evaluate('log(-5)').error).not.toBeNull();
    });

    it('returns error for ln(0)', () => {
      expect(MathParser.evaluate('ln(0)').error).not.toBeNull();
    });

    it('returns error for sqrt(-4)', () => {
      expect(MathParser.evaluate('sqrt(-4)').error).not.toBeNull();
    });

    it('returns error for tan(90) in DEG mode', () => {
      expect(MathParser.evaluate('tan(90)', { angleMode: 'DEG' }).error).not.toBeNull();
    });
  });

  describe('Scientific Functions (Trig)', () => {
    it('evaluates sin(30) in DEG = 0.5', () => {
      expect(MathParser.evaluate('sin(30)', { angleMode: 'DEG' }).result).toBeCloseTo(0.5);
    });

    it('evaluates cos(60) in DEG = 0.5', () => {
      expect(MathParser.evaluate('cos(60)', { angleMode: 'DEG' }).result).toBeCloseTo(0.5);
    });

    it('evaluates cos(90) in DEG cleanly = 0', () => {
      expect(MathParser.evaluate('cos(90)', { angleMode: 'DEG' }).result).toBeCloseTo(0, 10);
    });

    it('evaluates asin(0.5) in DEG = 30', () => {
      expect(MathParser.evaluate('asin(0.5)', { angleMode: 'DEG' }).result).toBeCloseTo(30);
    });

    it('evaluates sin(π/2) in RAD = 1', () => {
      expect(MathParser.evaluate('sin(π / 2)', { angleMode: 'RAD' }).result).toBeCloseTo(1);
    });

    it('evaluates log(1000) = 3', () => {
      expect(MathParser.evaluate('log(1000)').result).toBeCloseTo(3);
    });

    it('evaluates ln(e) = 1', () => {
      expect(MathParser.evaluate('ln(e)').result).toBeCloseTo(1);
    });
  });

  describe('Roots', () => {
    it('evaluates sqrt(16) = 4', () => {
      expect(MathParser.evaluate('sqrt(16)').result).toBe(4);
    });

    it('evaluates √25 = 5', () => {
      expect(MathParser.evaluate('√25').result).toBe(5);
    });

    it('evaluates root(3, 27) = 3', () => {
      expect(MathParser.evaluate('root(3, 27)').result).toBe(3);
    });

    it('evaluates root(10, 1024) = 2', () => {
      expect(MathParser.evaluate('root(10, 1024)').result).toBe(2);
    });

    it('evaluates 3√8 = 2 (infix nth root)', () => {
      expect(MathParser.evaluate('3√8').result).toBe(2);
    });
  });

  describe('Factorial & Combinatorics', () => {
    it('evaluates 5! = 120', () => {
      expect(MathParser.evaluate('5!').result).toBe(120);
    });

    it('evaluates (2+3)! = 120', () => {
      expect(MathParser.evaluate('(2+3)!').result).toBe(120);
    });

    it('returns error for factorial overflow > 170', () => {
      expect(MathParser.evaluate('171!').error).not.toBeNull();
    });

    it('evaluates 5P2 = 20', () => {
      expect(MathParser.evaluate('5P2').result).toBe(20);
    });

    it('evaluates 5C2 = 10', () => {
      expect(MathParser.evaluate('5C2').result).toBe(10);
    });

    it('evaluates 5C(2) = 10', () => {
      expect(MathParser.evaluate('5C(2)').result).toBe(10);
    });
  });

  describe('Statistics & Multi-Arg Functions', () => {
    it('evaluates mean(2, 4, 6, 8) = 5', () => {
      expect(MathParser.evaluate('mean(2, 4, 6, 8)').result).toBe(5);
    });

    it('evaluates median(1, 3, 5, 7, 9) = 5', () => {
      expect(MathParser.evaluate('median(1, 3, 5, 7, 9)').result).toBe(5);
    });

    it('evaluates median even(1, 2, 3, 4) = 2.5', () => {
      expect(MathParser.evaluate('median(1, 2, 3, 4)').result).toBe(2.5);
    });

    it('evaluates mode single (1, 2, 2, 3) = 2', () => {
      expect(MathParser.evaluate('mode(1, 2, 2, 3)').result).toBe(2);
    });

    it('evaluates mode tied (1, 1, 2, 2, 3) = "1, 2"', () => {
      expect(MathParser.evaluate('mode(1, 1, 2, 2, 3)').result).toBe('1, 2');
    });

    it('evaluates mode none (1, 2, 3, 4) = "No Mode"', () => {
      expect(MathParser.evaluate('mode(1, 2, 3, 4)').result).toBe('No Mode');
    });

    it('evaluates range(2, 10, 5) = 8', () => {
      expect(MathParser.evaluate('range(2, 10, 5)').result).toBe(8);
    });

    it('evaluates lcm(4, 6) = 12', () => {
      expect(MathParser.evaluate('lcm(4, 6)').result).toBe(12);
    });

    it('evaluates hcf(12, 18) = 6', () => {
      expect(MathParser.evaluate('hcf(12, 18)').result).toBe(6);
    });

    it('evaluates mod(17, 5) = 2', () => {
      expect(MathParser.evaluate('mod(17, 5)').result).toBe(2);
    });
  });

  describe('Fractions', () => {
    it('converts 3.5 to fraction improper 7/2', () => {
      const f = MathParser.decimalToFraction(3.5);
      expect(f.improper).toBe('7/2');
    });

    it('converts 3.5 to fraction mixed 3 1/2', () => {
      const f = MathParser.decimalToFraction(3.5);
      expect(f.mixed).toBe('3 1/2');
    });

    it('converts 0.125 to fraction 1/8', () => {
      const f = MathParser.decimalToFraction(0.125);
      expect(f.improper).toBe('1/8');
    });
  });

  describe('Natural Language Queries', () => {
    it('evaluates "15% of 240" = 36', () => {
      expect(MathParser.evaluate('15% of 240').result).toBe(36);
    });

    it('evaluates "half of 90" = 45', () => {
      expect(MathParser.evaluate('half of 90').result).toBe(45);
    });

    it('evaluates "sqrt of 144" = 12', () => {
      expect(MathParser.evaluate('sqrt of 144').result).toBe(12);
    });

    it('evaluates 2³ = 8', () => {
      expect(MathParser.evaluate('2³').result).toBe(8);
    });

    it('evaluates "2³ + 5 × √(9)" = 23', () => {
      expect(MathParser.evaluate('2³ + 5 × √(9)').result).toBe(23);
    });

    it('evaluates 10⁴ = 10000', () => {
      expect(MathParser.evaluate('10⁴').result).toBe(10000);
    });

    it('evaluates 5⁻¹ = 0.2', () => {
      expect(MathParser.evaluate('5⁻¹').result).toBe(0.2);
    });
  });

  describe('Step-by-Step Breakdown', () => {
    it('generates steps for "2 + 3 * 4"', () => {
      const result = MathParser.evaluate('2 + 3 * 4');
      expect(result.steps).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Variable Evaluation', () => {
    it('compiles and evaluates xsin(x) with variable', () => {
      const compiled = MathParser.compile('xsin(x)', { angleMode: 'RAD' });
      expect(compiled.error).toBeNull();
      const val = compiled.evaluate({ x: Math.PI / 2 }, 'RAD');
      expect(Math.abs(val - Math.PI / 2)).toBeLessThan(1e-10);
    });
  });
});