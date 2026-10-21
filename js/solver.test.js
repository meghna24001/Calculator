// js/solver.test.js - Vitest tests for AlgebraicSolver
import { describe, it, expect } from 'vitest';
import { AlgebraicSolver } from './test-utils.js';

describe('AlgebraicSolver', () => {
  function assertClose(actual, expected, tol = 1e-4) {
    expect(Math.abs(actual - expected)).toBeLessThan(tol);
  }

  describe('Single-variable linear equations', () => {
    it('solves 2x + 6 = 0', () => {
      const res = AlgebraicSolver.solveEquation('2x + 6 = 0');
      expect(res.status).toBe('unique');
      assertClose(res.solutions[0].value, -3);
      expect(res.steps.length).toBeGreaterThan(0);
    });

    it('solves 3x - 5 = 2x + 7', () => {
      const res = AlgebraicSolver.solveEquation('3x - 5 = 2x + 7');
      assertClose(res.solutions[0].value, 12);
    });

    it('solves 2x = 3 with fraction', () => {
      const res = AlgebraicSolver.solveEquation('2x = 3');
      assertClose(res.solutions[0].value, 1.5);
      expect(res.solutions[0].formatted).toContain('3/2');
    });

    it('detects infinite solutions for identical sides', () => {
      const res = AlgebraicSolver.solveEquation('2x + 4 = 2x + 4');
      expect(res.status).toBe('infinite');
    });

    it('detects no solution for parallel/inconsistent', () => {
      const res = AlgebraicSolver.solveEquation('2x + 4 = 2x + 5');
      expect(res.status).toBe('none');
    });
  });

  describe('Quadratic equations', () => {
    it('solves x^2 - 5x + 6 = 0 (two real roots)', () => {
      const res = AlgebraicSolver.solveEquation('x^2 - 5x + 6 = 0');
      expect(res.solutions.length).toBe(2);
      const roots = res.solutions.map(s => s.value).sort((a, b) => a - b);
      assertClose(roots[0], 2);
      assertClose(roots[1], 3);
    });

    it('solves x^2 - 4 = 0 (difference of squares)', () => {
      const res = AlgebraicSolver.solveEquation('x^2 - 4 = 0');
      const roots = res.solutions.map(s => s.value).sort((a, b) => a - b);
      assertClose(roots[0], -2);
      assertClose(roots[1], 2);
    });

    it('solves x^2 + 2x + 1 = 0 (repeated root)', () => {
      const res = AlgebraicSolver.solveEquation('x^2 + 2x + 1 = 0');
      expect(res.solutions.length).toBe(1);
      assertClose(res.solutions[0].value, -1);
    });

    it('identifies complex roots for x^2 + 1 = 0', () => {
      const res = AlgebraicSolver.solveEquation('x^2 + 1 = 0');
      expect(res.status).toBe('complex_roots');
      expect(res.solutions.some(s => s.formatted.includes('i'))).toBe(true);
    });

    it('identifies complex roots for x^2 - 2x + 5 = 0', () => {
      const res = AlgebraicSolver.solveEquation('x^2 - 2x + 5 = 0');
      expect(res.status).toBe('complex_roots');
      expect(res.solutions.some(s => s.formatted.includes('2i'))).toBe(true);
    });
  });

  describe('Higher-degree polynomials', () => {
    it('solves cubic x^3 - 6x^2 + 11x - 6 = 0', () => {
      const res = AlgebraicSolver.solveEquation('x^3 - 6x^2 + 11x - 6 = 0');
      expect(res.solutions.length).toBe(3);
      const roots = res.solutions.map(s => Math.round(s.value)).sort((a, b) => a - b);
      expect(roots[0]).toBe(1);
      expect(roots[1]).toBe(2);
      expect(roots[2]).toBe(3);
    });

    it('solves quartic x^4 - 16 = 0', () => {
      const res = AlgebraicSolver.solveEquation('x^4 - 16 = 0');
      expect(res.solutions.length).toBeGreaterThanOrEqual(2);
      const roots = res.solutions.map(s => Math.round(s.value)).sort((a, b) => a - b);
      expect(roots).toContain(-2);
      expect(roots).toContain(2);
    });
  });

  describe('Transcendental & Non-linear equations', () => {
    it('solves exponential 2^x = 16', () => {
      const res = AlgebraicSolver.solveEquation('2^x = 16');
      expect(res.solutions.length).toBeGreaterThanOrEqual(1);
      assertClose(res.solutions[0].value, 4);
    });

    it('solves trig sin(x) = 0', () => {
      const res = AlgebraicSolver.solveEquation('sin(x) = 0', { min: -1, max: 1 });
      expect(res.solutions.some(s => Math.abs(s.value) < 1e-4)).toBe(true);
    });
  });

  describe('2x2 Linear Systems', () => {
    it('solves x + y = 5, x - y = 1', () => {
      const res = AlgebraicSolver.solveSystem2('x + y = 5', 'x - y = 1');
      expect(res.status).toBe('unique');
      const x = res.solutions.find(s => s.label === 'x').value;
      const y = res.solutions.find(s => s.label === 'y').value;
      assertClose(x, 3);
      assertClose(y, 2);
    });

    it('solves 2x + 3y = 8, 3x - y = 1', () => {
      const res = AlgebraicSolver.solveSystem2('2x + 3y = 8', '3x - y = 1');
      expect(res.status).toBe('unique');
      const x = res.solutions.find(s => s.label === 'x').value;
      const y = res.solutions.find(s => s.label === 'y').value;
      assertClose(x, 1);
      assertClose(y, 2);
    });

    it('detects inconsistent system x + y = 2, x + y = 4', () => {
      const res = AlgebraicSolver.solveSystem2('x + y = 2', 'x + y = 4');
      expect(res.status).toBe('none');
    });

    it('detects dependent system 2x + 4y = 8, x + 2y = 4', () => {
      const res = AlgebraicSolver.solveSystem2('2x + 4y = 8', 'x + 2y = 4');
      expect(res.status).toBe('infinite');
    });
  });

  describe('3x3 Linear Systems', () => {
    it('solves 3x3 system with Cramers rule', () => {
      const eq1 = 'x + y + z = 6';
      const eq2 = '2y + 5z = -4';
      const eq3 = '2x + 5y - z = 27';
      const res = AlgebraicSolver.solveSystem3(eq1, eq2, eq3);
      expect(res.status).toBe('unique');
      const x = res.solutions.find(s => s.label === 'x').value;
      const y = res.solutions.find(s => s.label === 'y').value;
      const z = res.solutions.find(s => s.label === 'z').value;
      assertClose(x, 5);
      assertClose(y, 3);
      assertClose(z, -2);
      expect(res.steps.some(st => st.includes('Determinant D'))).toBe(true);
    });
  });
});