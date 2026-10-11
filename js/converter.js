/**
 * converter.js — Unit Conversion Engine
 * All conversions are done offline via static factors / formulas.
 * Architecture: every unit converts to/from a canonical base unit.
 * Temperature uses special-case formulas (not a simple multiplier).
 */

const UnitConverter = (function () {
    'use strict';

    /**
     * Category definitions.
     * Each unit: { label, symbol, toBase, fromBase }
     *   - toBase(v)   : convert value v → base unit value
     *   - fromBase(v) : convert base unit value v → this unit
     * For linear units: toBase = v * factor, fromBase = v / factor
     * Temperature needs explicit formulas.
     */
    const CATEGORIES = {

        length: {
            label: 'Length',
            icon: '📏',
            base: 'm',
            units: {
                km:   { label: 'Kilometre',    symbol: 'km',  toBase: v => v * 1000,          fromBase: v => v / 1000 },
                m:    { label: 'Metre',         symbol: 'm',   toBase: v => v,                 fromBase: v => v },
                cm:   { label: 'Centimetre',    symbol: 'cm',  toBase: v => v / 100,           fromBase: v => v * 100 },
                mm:   { label: 'Millimetre',    symbol: 'mm',  toBase: v => v / 1000,          fromBase: v => v * 1000 },
                um:   { label: 'Micrometre',    symbol: 'μm',  toBase: v => v / 1e6,           fromBase: v => v * 1e6 },
                nm:   { label: 'Nanometre',     symbol: 'nm',  toBase: v => v / 1e9,           fromBase: v => v * 1e9 },
                mi:   { label: 'Mile',          symbol: 'mi',  toBase: v => v * 1609.344,      fromBase: v => v / 1609.344 },
                yd:   { label: 'Yard',          symbol: 'yd',  toBase: v => v * 0.9144,        fromBase: v => v / 0.9144 },
                ft:   { label: 'Foot',          symbol: 'ft',  toBase: v => v * 0.3048,        fromBase: v => v / 0.3048 },
                in:   { label: 'Inch',          symbol: 'in',  toBase: v => v * 0.0254,        fromBase: v => v / 0.0254 },
                nmi:  { label: 'Nautical Mile', symbol: 'nmi', toBase: v => v * 1852,          fromBase: v => v / 1852 },
                ly:   { label: 'Light Year',    symbol: 'ly',  toBase: v => v * 9.461e15,      fromBase: v => v / 9.461e15 },
                au:   { label: 'Astron. Unit',  symbol: 'AU',  toBase: v => v * 1.496e11,      fromBase: v => v / 1.496e11 },
            }
        },

        mass: {
            label: 'Mass / Weight',
            icon: '⚖️',
            base: 'kg',
            units: {
                t:    { label: 'Metric Tonne',  symbol: 't',   toBase: v => v * 1000,          fromBase: v => v / 1000 },
                kg:   { label: 'Kilogram',      symbol: 'kg',  toBase: v => v,                 fromBase: v => v },
                g:    { label: 'Gram',          symbol: 'g',   toBase: v => v / 1000,          fromBase: v => v * 1000 },
                mg:   { label: 'Milligram',     symbol: 'mg',  toBase: v => v / 1e6,           fromBase: v => v * 1e6 },
                ug:   { label: 'Microgram',     symbol: 'μg',  toBase: v => v / 1e9,           fromBase: v => v * 1e9 },
                lb:   { label: 'Pound',         symbol: 'lb',  toBase: v => v * 0.453592,      fromBase: v => v / 0.453592 },
                oz:   { label: 'Ounce',         symbol: 'oz',  toBase: v => v * 0.0283495,     fromBase: v => v / 0.0283495 },
                st:   { label: 'Stone',         symbol: 'st',  toBase: v => v * 6.35029,       fromBase: v => v / 6.35029 },
                ton:  { label: 'Short Ton (US)',symbol: 'ton', toBase: v => v * 907.185,       fromBase: v => v / 907.185 },
                lton: { label: 'Long Ton (UK)', symbol: 'LT',  toBase: v => v * 1016.05,       fromBase: v => v / 1016.05 },
            }
        },

        temperature: {
            label: 'Temperature',
            icon: '🌡️',
            base: 'K',   // Kelvin is the base
            units: {
                K:  { label: 'Kelvin',     symbol: 'K',  toBase: v => v,               fromBase: v => v },
                C:  { label: 'Celsius',    symbol: '°C', toBase: v => v + 273.15,      fromBase: v => v - 273.15 },
                F:  { label: 'Fahrenheit', symbol: '°F', toBase: v => (v - 32) * 5/9 + 273.15,  fromBase: v => (v - 273.15) * 9/5 + 32 },
                R:  { label: 'Rankine',    symbol: '°R', toBase: v => v * 5/9,         fromBase: v => v * 9/5 },
            }
        },

        speed: {
            label: 'Speed',
            icon: '💨',
            base: 'm/s',
            units: {
                ms:   { label: 'Metre/second',  symbol: 'm/s',   toBase: v => v,              fromBase: v => v },
                kmh:  { label: 'Kilometre/hour', symbol: 'km/h', toBase: v => v / 3.6,        fromBase: v => v * 3.6 },
                mph:  { label: 'Mile/hour',      symbol: 'mph',  toBase: v => v * 0.44704,    fromBase: v => v / 0.44704 },
                kn:   { label: 'Knot',           symbol: 'kn',   toBase: v => v * 0.514444,   fromBase: v => v / 0.514444 },
                fts:  { label: 'Foot/second',    symbol: 'ft/s', toBase: v => v * 0.3048,     fromBase: v => v / 0.3048 },
                mach: { label: 'Mach (sea lvl)', symbol: 'Ma',   toBase: v => v * 340.29,     fromBase: v => v / 340.29 },
                c:    { label: 'Speed of Light', symbol: 'c',    toBase: v => v * 2.998e8,    fromBase: v => v / 2.998e8 },
            }
        },

        area: {
            label: 'Area',
            icon: '▪️',
            base: 'm²',
            units: {
                km2:  { label: 'Square Kilometre', symbol: 'km²',  toBase: v => v * 1e6,      fromBase: v => v / 1e6 },
                m2:   { label: 'Square Metre',     symbol: 'm²',   toBase: v => v,             fromBase: v => v },
                cm2:  { label: 'Square Centimetre',symbol: 'cm²',  toBase: v => v / 1e4,      fromBase: v => v * 1e4 },
                mm2:  { label: 'Square Millimetre',symbol: 'mm²',  toBase: v => v / 1e6,      fromBase: v => v * 1e6 },
                ha:   { label: 'Hectare',           symbol: 'ha',   toBase: v => v * 1e4,      fromBase: v => v / 1e4 },
                acre: { label: 'Acre',              symbol: 'ac',   toBase: v => v * 4046.86,  fromBase: v => v / 4046.86 },
                mi2:  { label: 'Square Mile',       symbol: 'mi²',  toBase: v => v * 2.59e6,   fromBase: v => v / 2.59e6 },
                ft2:  { label: 'Square Foot',       symbol: 'ft²',  toBase: v => v * 0.092903, fromBase: v => v / 0.092903 },
                in2:  { label: 'Square Inch',       symbol: 'in²',  toBase: v => v * 6.4516e-4,fromBase: v => v / 6.4516e-4 },
                yd2:  { label: 'Square Yard',       symbol: 'yd²',  toBase: v => v * 0.836127, fromBase: v => v / 0.836127 },
            }
        },

        volume: {
            label: 'Volume',
            icon: '🧊',
            base: 'm³',
            units: {
                m3:   { label: 'Cubic Metre',    symbol: 'm³',  toBase: v => v,              fromBase: v => v },
                L:    { label: 'Litre',          symbol: 'L',   toBase: v => v / 1000,       fromBase: v => v * 1000 },
                mL:   { label: 'Millilitre',     symbol: 'mL',  toBase: v => v / 1e6,        fromBase: v => v * 1e6 },
                cm3:  { label: 'Cubic Centimetre',symbol: 'cm³',toBase: v => v / 1e6,        fromBase: v => v * 1e6 },
                ft3:  { label: 'Cubic Foot',     symbol: 'ft³', toBase: v => v * 0.0283168,  fromBase: v => v / 0.0283168 },
                in3:  { label: 'Cubic Inch',     symbol: 'in³', toBase: v => v * 1.6387e-5,  fromBase: v => v / 1.6387e-5 },
                galUS:{ label: 'US Gallon',      symbol: 'gal', toBase: v => v * 0.00378541, fromBase: v => v / 0.00378541 },
                galUK:{ label: 'UK Gallon',      symbol: 'UKgal',toBase: v => v * 0.00454609,fromBase: v => v / 0.00454609 },
                qt:   { label: 'US Quart',       symbol: 'qt',  toBase: v => v * 9.4635e-4,  fromBase: v => v / 9.4635e-4 },
                pt:   { label: 'US Pint',        symbol: 'pt',  toBase: v => v * 4.7318e-4,  fromBase: v => v / 4.7318e-4 },
                floz: { label: 'US Fl. Ounce',   symbol: 'fl oz',toBase: v => v * 2.9574e-5, fromBase: v => v / 2.9574e-5 },
                tsp:  { label: 'Teaspoon (US)',  symbol: 'tsp', toBase: v => v * 4.9289e-6,  fromBase: v => v / 4.9289e-6 },
                tbsp: { label: 'Tablespoon (US)',symbol: 'tbsp',toBase: v => v * 1.4787e-5,  fromBase: v => v / 1.4787e-5 },
            }
        },

        time: {
            label: 'Time',
            icon: '⏱️',
            base: 's',
            units: {
                ns:   { label: 'Nanosecond',  symbol: 'ns',  toBase: v => v / 1e9,           fromBase: v => v * 1e9 },
                us:   { label: 'Microsecond', symbol: 'μs',  toBase: v => v / 1e6,           fromBase: v => v * 1e6 },
                ms:   { label: 'Millisecond', symbol: 'ms',  toBase: v => v / 1000,          fromBase: v => v * 1000 },
                s:    { label: 'Second',      symbol: 's',   toBase: v => v,                 fromBase: v => v },
                min:  { label: 'Minute',      symbol: 'min', toBase: v => v * 60,            fromBase: v => v / 60 },
                h:    { label: 'Hour',        symbol: 'h',   toBase: v => v * 3600,          fromBase: v => v / 3600 },
                day:  { label: 'Day',         symbol: 'd',   toBase: v => v * 86400,         fromBase: v => v / 86400 },
                week: { label: 'Week',        symbol: 'wk',  toBase: v => v * 604800,        fromBase: v => v / 604800 },
                month:{ label: 'Month (avg)', symbol: 'mo',  toBase: v => v * 2629800,       fromBase: v => v / 2629800 },
                year: { label: 'Year (avg)',  symbol: 'yr',  toBase: v => v * 31557600,      fromBase: v => v / 31557600 },
                dec:  { label: 'Decade',      symbol: 'dec', toBase: v => v * 315576000,     fromBase: v => v / 315576000 },
                cent: { label: 'Century',     symbol: 'c',   toBase: v => v * 3155760000,    fromBase: v => v / 3155760000 },
            }
        },

        energy: {
            label: 'Energy',
            icon: '⚡',
            base: 'J',
            units: {
                J:    { label: 'Joule',         symbol: 'J',    toBase: v => v,              fromBase: v => v },
                kJ:   { label: 'Kilojoule',     symbol: 'kJ',   toBase: v => v * 1000,       fromBase: v => v / 1000 },
                MJ:   { label: 'Megajoule',     symbol: 'MJ',   toBase: v => v * 1e6,        fromBase: v => v / 1e6 },
                cal:  { label: 'Calorie (therm)',symbol: 'cal',  toBase: v => v * 4.184,      fromBase: v => v / 4.184 },
                kcal: { label: 'Kilocalorie',   symbol: 'kcal', toBase: v => v * 4184,       fromBase: v => v / 4184 },
                Wh:   { label: 'Watt-hour',     symbol: 'Wh',   toBase: v => v * 3600,       fromBase: v => v / 3600 },
                kWh:  { label: 'Kilowatt-hour', symbol: 'kWh',  toBase: v => v * 3.6e6,      fromBase: v => v / 3.6e6 },
                BTU:  { label: 'BTU',           symbol: 'BTU',  toBase: v => v * 1055.06,    fromBase: v => v / 1055.06 },
                eV:   { label: 'Electronvolt',  symbol: 'eV',   toBase: v => v * 1.602e-19,  fromBase: v => v / 1.602e-19 },
                ftlb: { label: 'Foot-pound',    symbol: 'ft·lb',toBase: v => v * 1.35582,    fromBase: v => v / 1.35582 },
            }
        },

        pressure: {
            label: 'Pressure',
            icon: '🔵',
            base: 'Pa',
            units: {
                Pa:   { label: 'Pascal',      symbol: 'Pa',   toBase: v => v,              fromBase: v => v },
                kPa:  { label: 'Kilopascal',  symbol: 'kPa',  toBase: v => v * 1000,       fromBase: v => v / 1000 },
                MPa:  { label: 'Megapascal',  symbol: 'MPa',  toBase: v => v * 1e6,        fromBase: v => v / 1e6 },
                bar:  { label: 'Bar',         symbol: 'bar',  toBase: v => v * 1e5,        fromBase: v => v / 1e5 },
                mbar: { label: 'Millibar',    symbol: 'mbar', toBase: v => v * 100,        fromBase: v => v / 100 },
                atm:  { label: 'Atmosphere',  symbol: 'atm',  toBase: v => v * 101325,     fromBase: v => v / 101325 },
                psi:  { label: 'PSI',         symbol: 'psi',  toBase: v => v * 6894.76,    fromBase: v => v / 6894.76 },
                torr: { label: 'Torr / mmHg', symbol: 'Torr', toBase: v => v * 133.322,    fromBase: v => v / 133.322 },
                inHg: { label: 'Inch of Hg',  symbol: 'inHg', toBase: v => v * 3386.39,    fromBase: v => v / 3386.39 },
            }
        },

        data: {
            label: 'Data Storage',
            icon: '💾',
            base: 'bit',
            units: {
                bit:  { label: 'Bit',      symbol: 'bit', toBase: v => v,             fromBase: v => v },
                B:    { label: 'Byte',     symbol: 'B',   toBase: v => v * 8,         fromBase: v => v / 8 },
                KB:   { label: 'Kilobyte', symbol: 'KB',  toBase: v => v * 8e3,       fromBase: v => v / 8e3 },
                MB:   { label: 'Megabyte', symbol: 'MB',  toBase: v => v * 8e6,       fromBase: v => v / 8e6 },
                GB:   { label: 'Gigabyte', symbol: 'GB',  toBase: v => v * 8e9,       fromBase: v => v / 8e9 },
                TB:   { label: 'Terabyte', symbol: 'TB',  toBase: v => v * 8e12,      fromBase: v => v / 8e12 },
                PB:   { label: 'Petabyte', symbol: 'PB',  toBase: v => v * 8e15,      fromBase: v => v / 8e15 },
                KiB:  { label: 'Kibibyte', symbol: 'KiB', toBase: v => v * 8 * 1024,       fromBase: v => v / (8 * 1024) },
                MiB:  { label: 'Mebibyte', symbol: 'MiB', toBase: v => v * 8 * 1048576,    fromBase: v => v / (8 * 1048576) },
                GiB:  { label: 'Gibibyte', symbol: 'GiB', toBase: v => v * 8 * 1073741824, fromBase: v => v / (8 * 1073741824) },
                TiB:  { label: 'Tebibyte', symbol: 'TiB', toBase: v => v * 8 * 1099511627776, fromBase: v => v / (8 * 1099511627776) },
            }
        },

        angle: {
            label: 'Angle',
            icon: '📐',
            base: 'rad',
            units: {
                deg:  { label: 'Degree',     symbol: '°',    toBase: v => v * Math.PI / 180,  fromBase: v => v * 180 / Math.PI },
                rad:  { label: 'Radian',     symbol: 'rad',  toBase: v => v,                  fromBase: v => v },
                grad: { label: 'Gradian',    symbol: 'grad', toBase: v => v * Math.PI / 200,  fromBase: v => v * 200 / Math.PI },
                rev:  { label: 'Revolution', symbol: 'rev',  toBase: v => v * 2 * Math.PI,    fromBase: v => v / (2 * Math.PI) },
                arcmin:{ label: 'Arcminute', symbol: "'",    toBase: v => v * Math.PI / 10800, fromBase: v => v * 10800 / Math.PI },
                arcsec:{ label: 'Arcsecond', symbol: '"',    toBase: v => v * Math.PI / 648000,fromBase: v => v * 648000 / Math.PI },
            }
        },

        power: {
            label: 'Power',
            icon: '🔋',
            base: 'W',
            units: {
                W:    { label: 'Watt',          symbol: 'W',   toBase: v => v,            fromBase: v => v },
                kW:   { label: 'Kilowatt',      symbol: 'kW',  toBase: v => v * 1000,     fromBase: v => v / 1000 },
                MW:   { label: 'Megawatt',      symbol: 'MW',  toBase: v => v * 1e6,      fromBase: v => v / 1e6 },
                GW:   { label: 'Gigawatt',      symbol: 'GW',  toBase: v => v * 1e9,      fromBase: v => v / 1e9 },
                hp:   { label: 'Horsepower',    symbol: 'hp',  toBase: v => v * 745.7,    fromBase: v => v / 745.7 },
                BTUh: { label: 'BTU/hour',      symbol: 'BTU/h',toBase: v => v * 0.293071,fromBase: v => v / 0.293071 },
                ftlbs:{ label: 'ft·lb/s',       symbol: 'ft·lb/s',toBase: v => v * 1.35582,fromBase: v => v / 1.35582 },
            }
        },

        fuel: {
            label: 'Fuel Economy',
            icon: '⛽',
            base: 'L/100km',  // litres per 100 km
            units: {
                L100km: { label: 'L/100 km',     symbol: 'L/100km', toBase: v => v,             fromBase: v => v },
                kmL:    { label: 'km/L',          symbol: 'km/L',    toBase: v => 100 / v,       fromBase: v => 100 / v },
                mpgUS:  { label: 'MPG (US)',      symbol: 'mpg',     toBase: v => 235.215 / v,   fromBase: v => 235.215 / v },
                mpgUK:  { label: 'MPG (UK)',      symbol: 'mpg(UK)', toBase: v => 282.481 / v,   fromBase: v => 282.481 / v },
            }
        },

        numeral: {
            label: 'Numeral System',
            icon: '🔢',
            base: 'dec',
            units: {
                dec: { label: 'Decimal (Base 10)',     symbol: 'DEC', baseRadix: 10 },
                bin: { label: 'Binary (Base 2)',       symbol: 'BIN', baseRadix: 2 },
                oct: { label: 'Octal (Base 8)',        symbol: 'OCT', baseRadix: 8 },
                hex: { label: 'Hexadecimal (Base 16)', symbol: 'HEX', baseRadix: 16 }
            }
        },
    };

    /**
     * Convert numeral systems (Decimal, Binary, Octal, Hexadecimal) using BigInt precision.
     */
    function convertNumeral(val, fromUnit, toUnit) {
        const strVal = String(val).trim().toUpperCase();
        if (!strVal) return { result: null, formatted: '', error: null };

        const radixMap = {
            bin: { radix: 2, regex: /^[01]+$/ },
            oct: { radix: 8, regex: /^[0-7]+$/ },
            dec: { radix: 10, regex: /^[0-9]+$/ },
            hex: { radix: 16, regex: /^[0-9A-F]+$/ }
        };

        const fromSpec = radixMap[fromUnit];
        const toSpec = radixMap[toUnit];
        if (!fromSpec || !toSpec) {
            return { result: null, formatted: '', error: 'Invalid numeral system' };
        }

        let isNegative = false;
        let cleanStr = strVal;
        if (cleanStr.startsWith('-')) {
            isNegative = true;
            cleanStr = cleanStr.slice(1);
        }

        if (!fromSpec.regex.test(cleanStr)) {
            const allowed = fromUnit === 'bin' ? '0 and 1' :
                           (fromUnit === 'oct' ? '0 to 7' :
                           (fromUnit === 'dec' ? '0 to 9' : '0 to 9, A to F'));
            return { result: null, formatted: '', error: `Invalid ${fromUnit.toUpperCase()} input (only ${allowed})` };
        }

        try {
            let bigVal = 0n;
            const chars = '0123456789ABCDEF';
            for (let i = 0; i < cleanStr.length; i++) {
                const digit = BigInt(chars.indexOf(cleanStr[i]));
                bigVal = bigVal * BigInt(fromSpec.radix) + digit;
            }

            if (isNegative) {
                bigVal = -bigVal;
            }

            let resStr = '';
            if (bigVal === 0n) {
                resStr = '0';
            } else {
                let absVal = bigVal < 0n ? -bigVal : bigVal;
                const targetRadix = BigInt(toSpec.radix);
                while (absVal > 0n) {
                    const rem = Number(absVal % targetRadix);
                    resStr = chars[rem] + resStr;
                    absVal = absVal / targetRadix;
                }
                if (bigVal < 0n) {
                    resStr = '-' + resStr;
                }
            }

            return {
                result: resStr,
                formatted: resStr,
                error: null
            };
        } catch (e) {
            return { result: null, formatted: '', error: 'Conversion error' };
        }
    }

    /**
     * Perform a unit conversion.
     * @param {number|string} value - The input value.
     * @param {string} category     - Category key (e.g. 'length', 'numeral').
     * @param {string} fromUnit     - From unit key (e.g. 'km', 'hex').
     * @param {string} toUnit       - To unit key (e.g. 'mi', 'bin').
     * @returns {{ result: number|string|null, formatted: string, error: string|null }}
     */
    function convert(value, category, fromUnit, toUnit) {
        if (value === '' || value === null || value === undefined) {
            return { result: null, formatted: '', error: null };
        }

        const cat = CATEGORIES[category];
        if (!cat) return { result: null, formatted: '', error: 'Unknown category' };

        const from = cat.units[fromUnit];
        const to   = cat.units[toUnit];
        if (!from) return { result: null, formatted: '', error: `Unknown unit: ${fromUnit}` };
        if (!to)   return { result: null, formatted: '', error: `Unknown unit: ${toUnit}` };

        if (fromUnit === toUnit) {
            const formatted = category === 'numeral' ? String(value).toUpperCase() : formatResult(Number(value));
            return { result: value, formatted: formatted, error: null };
        }

        // Special handling for Numeral System (Base conversion)
        if (category === 'numeral') {
            return convertNumeral(value, fromUnit, toUnit);
        }

        // Standard numeric conversion
        const numVal = Number(value);
        if (isNaN(numVal)) {
            return { result: null, formatted: '', error: null };
        }

        try {
            const baseValue  = from.toBase(numVal);
            const resultVal  = to.fromBase(baseValue);

            if (!isFinite(resultVal) || isNaN(resultVal)) {
                return { result: null, formatted: '', error: 'Result out of range' };
            }

            return { result: resultVal, formatted: formatResult(resultVal), error: null };
        } catch (e) {
            return { result: null, formatted: '', error: 'Conversion error' };
        }
    }

    /**
     * Format a result number for display.
     * Switches between fixed notation for "normal" numbers and
     * exponential for very large or very small ones.
     */
    function formatResult(n) {
        if (n === 0) return '0';
        const abs = Math.abs(n);

        if (abs >= 1e-6 && abs < 1e13) {
            // Normal range — use up to 10 significant digits, trim trailing zeros
            const fixed = parseFloat(n.toPrecision(10));
            // Cap at 8 decimal places to keep it readable
            const str = fixed.toLocaleString('en-US', {
                maximumFractionDigits: 8,
                useGrouping: false
            });
            return str;
        } else {
            // Very large or very small — use exponential with 6 sig. digits
            return n.toExponential(6).replace(/\.?0+e/, 'e');
        }
    }

    /** Return all category keys in display order */
    function getCategoryKeys() {
        return Object.keys(CATEGORIES);
    }

    /** Return a category object */
    function getCategory(key) {
        return CATEGORIES[key] || null;
    }

    /** Return all unit keys for a category */
    function getUnitKeys(categoryKey) {
        const cat = CATEGORIES[categoryKey];
        return cat ? Object.keys(cat.units) : [];
    }

    /** Return a unit definition */
    function getUnit(categoryKey, unitKey) {
        const cat = CATEGORIES[categoryKey];
        return cat ? (cat.units[unitKey] || null) : null;
    }

    // Public API
    return { convert, getCategoryKeys, getCategory, getUnitKeys, getUnit, formatResult };

})();
