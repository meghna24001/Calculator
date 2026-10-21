// js/test-utils.js - Helpers for loading UMD modules in Vitest
import fs from 'fs';
import path from 'path';

/**
 * Load a module that uses UMD pattern or IIFE + module.exports
 */
function loadModule(moduleName, fileName) {
  const src = fs.readFileSync(path.join(__dirname, fileName), 'utf8');
  
  // Use Function constructor to isolate scope completely
  const fn = new Function(`
    var root = {};
    var module = { exports: {} };
    var global = globalThis;
    ${src}
    return typeof ${moduleName} !== 'undefined' ? ${moduleName} : module.exports;
  `);
  
  return fn();
}

// Load MathParser (has UMD wrapper)
const MathParser = loadModule('MathParser', 'parser.js');

// Load UnitConverter (no UMD, just IIFE + module.exports)
const UnitConverter = loadModule('UnitConverter', 'converter.js');

// Load AlgebraicSolver (no UMD, just IIFE + module.exports) 
// Needs MathParser to be available globally first
global.MathParser = MathParser;
const AlgebraicSolver = loadModule('AlgebraicSolver', 'solver.js');

export { MathParser, UnitConverter, AlgebraicSolver };