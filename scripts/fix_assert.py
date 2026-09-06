import re, pathlib

p = pathlib.Path(r"c:\Users\DELL\Projects\creativeshield-escrow\p2p-escrow\contracts\p2p_escrow.py")
content = p.read_text(encoding="utf-8")

# if not (X): raise Exception("msg") -> assert X, "msg"
content = re.sub(
    r'if not \((.+?)\): raise Exception\("(.+?)"\)',
    r'assert \1, "\2"',
    content
)

# raise Exception(f"Reputation below {MIN_REP_SCORE}%")
content = content.replace(
    'raise Exception(f"Reputation below {MIN_REP_SCORE}%")',
    'assert int(p.get("score", 100)) >= MIN_REP_SCORE, "Reputation below minimum"'
)

# if not bool(r.get("within_limit", False)):\n    raise Exception(...)
content = re.sub(
    r'if not bool\(r\.get\("within_limit", False\)\):\n\s+raise Exception\(f"[^"]*"\)',
    'assert bool(r.get("within_limit", False)), "Rate rejected"',
    content
)

p.write_text(content, encoding="utf-8")
print("Done")

remaining = [l for l in content.splitlines() if "raise Exception" in l and not l.strip().startswith("#")]
print(f"Remaining raise Exception: {len(remaining)}")
for l in remaining:
    print(" ", l.strip())
