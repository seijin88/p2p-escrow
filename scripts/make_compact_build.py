"""Build contracts/p2p_escrow_deploy.py from contracts/p2p_escrow.py.

Why a separate artifact: Bradbury rejects deploys whose calldata exceeds a
ceiling that sits between the 20,132 B that deployed successfully and the
21,892 B that failed. That ceiling is a network rule, not a code defect, so the
repository carries two files:

  contracts/p2p_escrow.py         readable source — reviewed, and what the tests run against
  contracts/p2p_escrow_deploy.py  generated, compact — what is actually deployed

The build strips docstrings and renames internal identifiers to short ones. It
never touches the public API (the methods a frontend calls) or the JSON field
names stored in, and read back from, contract state — those are string literals
here and stay exactly as written.

Run from anywhere:

    py -3.12 scripts/make_compact_build.py

Then verify behaviour — the suite must pass against the generated file:

    cp contracts/p2p_escrow.py /tmp/keep.py
    cp contracts/p2p_escrow_deploy.py contracts/p2p_escrow.py
    pytest tests/test_p2p_escrow.py -q
    cp /tmp/keep.py contracts/p2p_escrow.py
"""

import ast
import keyword
import pathlib

ROOT = pathlib.Path(__file__).resolve().parents[1]
SRC = ROOT / "contracts" / "p2p_escrow.py"
DEST = ROOT / "contracts" / "p2p_escrow_deploy.py"

# Calldata overhead observed on-chain (selector + ABI framing).
CALLDATA_OVERHEAD = 250
# Largest deploy known to have succeeded on Bradbury; a build above this is
# expected to be rejected, so the warning below fires before a wasted attempt.
CALLDATA_LIMIT = 20132

# Public API: frontends call these by name. Never renamed.
PROTECTED = {
    "__init__", "report_profile", "get_profile", "is_profile_reported",
    "is_payment_reference_used", "set_user_profile_contract",
    "get_user_profile_contract", "post_offer", "cancel_offer", "expire_offer",
    "lock_order", "mark_paid", "release_crypto", "open_dispute",
    "escalate_after_seller_timeout", "cancel_expired_order", "arbitrate",
    "appeal_verdict", "finalize_trade",
    "get_open_offers", "get_offer", "get_trade", "get_trade_history",
    "get_my_active_trades", "get_my_latest_trade_id", "get_counters",
    # python / SDK surface
    "self", "gl", "json", "typing", "datetime", "timedelta", "timezone",
    "hashlib", "sha256", "hexdigest", "encode",
    "TreeMap", "Address", "u256", "any", "Exception", "True", "False", "None",
    "str", "int", "bool", "dict", "list", "len", "round", "abs", "sum",
    "range", "max", "min", "float", "isinstance", "bytes", "bytearray",
    "get", "append", "lower", "upper", "strip", "hex", "join", "split",
    "isoformat", "startswith", "replace", "format", "dumps", "loads",
}
SOFT_KEYWORDS = {"match", "case", "_", "type"}


def strip_docstrings(tree: ast.Module) -> int:
    removed = 0
    for node in ast.walk(tree):
        if isinstance(node, (ast.Module, ast.ClassDef, ast.FunctionDef, ast.AsyncFunctionDef)):
            body = getattr(node, "body", None)
            if (body and isinstance(body[0], ast.Expr)
                    and isinstance(body[0].value, ast.Constant)
                    and isinstance(body[0].value.value, str)):
                body.pop(0)
                removed += 1
                if not body:
                    body.append(ast.Pass())
    return removed


def collect_defined(tree: ast.Module) -> set:
    defined = set()
    for node in ast.walk(tree):
        if isinstance(node, ast.FunctionDef):
            defined.add(node.name)
            for arg in node.args.args + node.args.kwonlyargs:
                defined.add(arg.arg)
        elif isinstance(node, ast.arg):
            defined.add(node.arg)
        elif isinstance(node, ast.Name) and isinstance(node.ctx, (ast.Store, ast.Del)):
            defined.add(node.id)
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            defined.add(node.target.id)
        elif isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    defined.add(target.id)
    return defined


def short_name_pool(tree: ast.Module):
    used = {n.id for n in ast.walk(tree) if isinstance(n, ast.Name)}
    used |= {n.arg for n in ast.walk(tree) if isinstance(n, ast.arg)}
    used |= {n.name for n in ast.walk(tree) if isinstance(n, ast.FunctionDef)}
    used |= {n.attr for n in ast.walk(tree) if isinstance(n, ast.Attribute)}
    letters = "abcdefghijklmnopqrstuvwxyz"
    pool = [c for c in letters] + [a + b for a in letters for b in letters]
    return [p for p in pool
            if p not in PROTECTED
            and p not in used
            and not keyword.iskeyword(p)
            and p not in SOFT_KEYWORDS]


def apply_renames(tree: ast.Module, mapping: dict) -> None:
    for node in ast.walk(tree):
        if isinstance(node, ast.Name) and node.id in mapping:
            node.id = mapping[node.id]
        elif isinstance(node, ast.arg) and node.arg in mapping:
            node.arg = mapping[node.arg]
        elif isinstance(node, ast.FunctionDef) and node.name in mapping:
            node.name = mapping[node.name]
        elif (isinstance(node, ast.Attribute) and node.attr in mapping
              and isinstance(node.value, ast.Name) and node.value.id == "self"):
            # only contract-owned attributes; never foreign ones like gl.message
            node.attr = mapping[node.attr]


def main() -> None:
    source = SRC.read_text(encoding="utf-8")
    header = source.splitlines()[0]
    if not header.strip().startswith('# {'):
        raise SystemExit(f"unexpected first line in {SRC}: {header!r}")

    tree = ast.parse(source)
    removed = strip_docstrings(tree)

    targets = sorted((n for n in collect_defined(tree)
                      if n not in PROTECTED and len(n) > 5),
                     key=lambda n: (-len(n), n))
    pool = short_name_pool(tree)
    mapping = {}
    for name in targets:
        if not pool:
            break
        mapping[name] = pool.pop(0)
    apply_renames(tree, mapping)

    built = header + "\n" + ast.unparse(tree) + "\n"
    compile(built, str(DEST), "exec")
    # Write CRLF explicitly: that is the byte form that was deployed and verified
    # on Bradbury, so the committed artifact matches the live contract.
    DEST.write_text(built, encoding="utf-8", newline="\r\n")

    before = len(source.replace("\n", "\r\n").encode("utf-8"))
    after = len(built.replace("\n", "\r\n").encode("utf-8"))
    calldata = after + CALLDATA_OVERHEAD
    print(f"docstrings removed   : {removed}")
    print(f"identifiers renamed  : {len(mapping)}")
    print(f"source (on disk)     : {before:,} bytes")
    print(f"{DEST.name:20} : {after:,} bytes on disk (~{calldata:,} B calldata)")
    if calldata > CALLDATA_LIMIT:
        print(f"WARNING: bigger than the largest deploy known to succeed on Bradbury "
              f"({CALLDATA_LIMIT:,} B calldata). Expect a rejected deploy; "
              f"trim more before trying.")
    else:
        print(f"OK: under the {CALLDATA_LIMIT:,} B ceiling seen on Bradbury.")


if __name__ == "__main__":
    main()
