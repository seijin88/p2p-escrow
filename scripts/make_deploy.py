"""Convert p2p_escrow.py (test version) to p2p_escrow_deploy.py (testnet version).

Replaces:
  if not (X): raise Exception("msg")  ->  assert X, "msg"
  raise Exception(f"...{var}...")      ->  assert False, "..."
"""
import re, pathlib

src  = pathlib.Path(r"c:\Users\DELL\Projects\creativeshield-escrow\p2p-escrow\contracts\p2p_escrow.py")
dest = pathlib.Path(r"c:\Users\DELL\Projects\creativeshield-escrow\p2p-escrow\contracts\p2p_escrow_deploy.py")

content = src.read_text(encoding="utf-8")

# 1. Simple: if not (EXPR): raise Exception("MSG")  ->  assert EXPR, "MSG"
content = re.sub(
    r'if not \((.+?)\): raise Exception\("(.+?)"\)',
    r'assert \1, "\2"',
    content
)

# 2. f-string reputation check
content = re.sub(
    r'raise Exception\(f"Reputation below \{MIN_REP_SCORE\}%"\)',
    'assert False, "Reputation below minimum score"',
    content
)

# 3. Rate rejected f-string
content = re.sub(
    r'if not bool\(r\.get\("within_limit", False\)\):\n\s+raise Exception\(f"Rate rejected.*?\)',
    'assert bool(r.get("within_limit", False)), "Rate rejected: deviation exceeds limit"',
    content,
    flags=re.DOTALL
)

dest.write_text(content, encoding="utf-8")
print(f"Written: {dest}")

# Verify no raise Exception left (except in comments)
remaining = [ln for ln in content.splitlines() if "raise Exception" in ln and not ln.strip().startswith("#")]
if remaining:
    print("WARNING - remaining raise Exception lines:")
    for ln in remaining:
        print(" ", ln)
else:
    print("OK - no raise Exception remaining")
