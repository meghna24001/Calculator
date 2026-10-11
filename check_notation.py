import re

with open(r'D:\MEGHNA\My Creation\Calculator\js\app.js', 'r', encoding='utf-8') as f:
    content = f.read()

# Find all math strings and their line numbers
math_strings = []
for m in re.finditer(r"math:\s*'([^']*)'", content):
    math = m.group(1)
    line_no = content[:m.start()].count('\n') + 1
    math_strings.append((line_no, math))

# Check for various notation issues
issues = []
for line_no, math in math_strings:
    # Combining macron (U+0304) - the x̄ issue
    if '\u0304' in math:
        issues.append(f"LINE {line_no}: COMBINING MACRON U+0304: {math}")
    # Standalone macron sign (U+00AF) - separate floating bar
    if '\u00af' in math:
        issues.append(f"LINE {line_no}: STANDALONE MACRON U+00AF: {math}")
    # Check for ASCII hyphen used as minus sign (should be U+2212)
    # Pattern: letter/digit/paren followed by ASCII hyphen followed by letter/digit/paren
    if re.search(r'[\w\)\.]-[\w\(]', math):
        # This might be legitimate (e.g., n-1) but flag for review
        pass

with open(r'D:\MEGHNA\My Creation\Calculator\formula_check.txt', 'w', encoding='utf-8') as f:
    f.write('\n'.join(issues) if issues else 'No issues found')
print(f'Found {len(issues)} issues')