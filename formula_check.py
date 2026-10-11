import re

with open(r'D:\MEGHNA\My Creation\Calculator\js\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Extract the FORMULA_DATA block
start = content.find('const FORMULA_DATA = {')
end = content.find('let activeFormulaTab')
block = content[start:end]

# Find all math: '...' strings and check for issues
issues = []
for m in re.finditer(r"math:\s*'([^']*)'", block):
    math = m.group(1)
    line_no = content[:m.start()].count('\n') + 1
    # Check for ASCII hyphen used as minus (surrounded by digits/letters/parens)
    # Check for combining macron issues
    if '\u0304' in math:
        issues.append(f"LINE {line_no}: COMBINING MACRON (U+0304) in: {math}")
    # Check for standalone macron U+00AF
    if '\u00af' in math:
        issues.append(f"LINE {line_no}: STANDALONE MACRON (U+00AF) in: {math}")
    # Check for ASCII hyphen minus patterns
    # Look for patterns like "x-y" where it should be minus
    if re.search(r'[A-Za-z0-9)]-[A-Za-z0-9(]', math):
        # could be legitimate (e.g. n-1) but flag for review
        pass

with open(r'D:\MEGHNA\My Creation\Calculator\formula_check.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(issues) if issues else 'No combining macron issues found')
print('done', len(issues))