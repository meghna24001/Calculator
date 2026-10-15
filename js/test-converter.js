// test-converter.js — Conversion accuracy test
'use strict';

// Load converter (it defines a const in an IIFE, so we eval with a wrapper)
const fs = require('fs');
let src = fs.readFileSync('js/converter.js', 'utf8');
// Replace the IIFE so it returns its public API and we capture it
src = src
    .replace('const UnitConverter = (function () {', 'global.UnitConverter = (function () {');

eval(src); // eslint-disable-line no-eval  — test harness only
const C = global.UnitConverter;

const tests = [
    // [category, fromUnit, toUnit, input, expectedResult, tolerancePct]
    ['length',      'km',   'm',      1,       1000,       0],
    ['length',      'mi',   'km',     1,       1.609344,   0.0001],
    ['length',      'ft',   'cm',     1,       30.48,      0],
    ['length',      'in',   'cm',     1,       2.54,       0],
    ['length',      'nmi',  'm',      1,       1852,       0],
    ['mass',        'kg',   'lb',     1,       2.2046226218, 1e-6],
    ['mass',        'oz',   'g',      1,       28.349523125, 1e-9],
    ['mass',        'st',   'kg',     1,       6.35029318,   1e-9],
    ['temperature', 'C',    'F',      100,     212,        0],
    ['temperature', 'F',    'C',      32,      0,          0],
    ['temperature', 'C',    'K',      0,       273.15,     0],
    ['temperature', 'K',    'C',      273.15,  0,          0.0001],
    ['temperature', 'C',    'F',      -40,     -40,        0],      // -40 is same in C and F
    ['speed',       'kmh',  'mph',    100,     62.1371,    0.001],
    ['speed',       'ms',   'kmh',    1,       3.6,        0],
    ['speed',       'kn',   'ms',     1,       1852 / 3600,1e-9],
    ['area',        'm2',   'ft2',    1,       10.7639,    0.001],
    ['area',        'ha',   'm2',     1,       10000,      0],
    ['area',        'acre', 'm2',     1,       4046.8564224, 1e-9],
    ['volume',      'L',    'mL',     1,       1000,       0],
    ['volume',      'L',    'galUS',  1,       0.264172052358, 1e-6],
    ['volume',      'galUS','L',      1,       3.785411784, 1e-9],
    ['time',        'h',    'min',    2,       120,        0],
    ['time',        'day',  'h',      1,       24,         0],
    ['time',        'year', 'day',    1,       365.25,     0.01],
    ['energy',      'kWh',  'J',      1,       3600000,    0],
    ['energy',      'kcal', 'J',      1,       4184,       0],
    ['energy',      'BTU',  'J',      1,       1055.05585, 1e-9],
    ['pressure',    'atm',  'Pa',     1,       101325,     0],
    ['pressure',    'psi',  'Pa',     1,       6894.757293168, 1e-9],
    ['pressure',    'bar',  'Pa',     1,       100000,     0],
    ['data',        'GB',   'MB',     1,       1000,       0],
    ['data',        'GiB',  'MiB',   1,       1024,       0],
    ['data',        'TB',   'GB',     1,       1000,       0],
    ['angle',       'deg',  'rad',    180,     Math.PI,    0.0001],
    ['angle',       'rad',  'deg',    Math.PI, 180,        0.0001],
    ['angle',       'rev',  'deg',    1,       360,        0],
    ['power',       'kW',   'W',      1,       1000,       0],
    ['power',       'hp',   'W',      1,       745.69987158, 1e-9],
    ['fuel',        'L100km','kmL',   10,      10,         0],   // 10L/100km = 10km/L
];

const numeralTests = [
    // [fromUnit, toUnit, input, expectedFormatted]
    ['dec', 'bin', '42', '101010'],
    ['bin', 'dec', '101010', '42'],
    ['hex', 'dec', 'FF', '255'],
    ['dec', 'hex', '255', 'FF'],
    ['oct', 'dec', '77', '63'],
    ['hex', 'bin', '1A', '11010'],
    ['bin', 'hex', '11111111', 'FF'],
    ['bin', 'oct', '111111', '77'],
    ['dec', 'dec', '123', '123'],
];

const formatTests = [
    // [category, fromUnit, toUnit, input, expectedFormatted]
    ['length', 'mm', 'km', 1.23456, '1.23456e-6'],
    ['mass',   'mg', 'kg', 2.5,     '2.5e-6'],
    ['volume', 'mL', 'm3', 50,      '5e-5'],
];

let pass = 0, fail = 0;
tests.forEach(([cat, from, to, input, expected, tol]) => {
    const res = C.convert(input, cat, from, to);
    if (res.error) {
        console.log(`FAIL [${cat}] ${from}->${to} (${input}): error="${res.error}"`);
        fail++;
        return;
    }
    const got = res.result;
    const absExpected = Math.abs(expected);
    const diffPct = absExpected < 1e-12 ? Math.abs(got - expected) : Math.abs(got - expected) / absExpected;
    const ok = diffPct <= (tol + 1e-9);
    if (ok) {
        pass++;
    } else {
        console.log(`FAIL [${cat}] ${from}->${to} (${input}): got ${got}, expected ~${expected} (diff ${(diffPct*100).toFixed(4)}%)`);
        fail++;
    }
});

numeralTests.forEach(([from, to, input, expectedFormatted]) => {
    const res = C.convert(input, 'numeral', from, to);
    if (res.error) {
        console.log(`FAIL [numeral] ${from}->${to} (${input}): error="${res.error}"`);
        fail++;
        return;
    }
    if (res.formatted === expectedFormatted) {
        pass++;
    } else {
        console.log(`FAIL [numeral] ${from}->${to} (${input}): got "${res.formatted}", expected "${expectedFormatted}"`);
        fail++;
    }
});

formatTests.forEach(([cat, from, to, input, expectedFormatted]) => {
    const res = C.convert(input, cat, from, to);
    if (res.error) {
        console.log(`FAIL [format] ${from}->${to} (${input}): error="${res.error}"`);
        fail++;
        return;
    }
    if (res.formatted === expectedFormatted) {
        pass++;
    } else {
        console.log(`FAIL [format] ${from}->${to} (${input}): got "${res.formatted}", expected "${expectedFormatted}"`);
        fail++;
    }
});

console.log(`\n${pass}/${pass+fail} converter tests passed.`);
process.exit(fail > 0 ? 1 : 0);

