from __future__ import annotations

import codecs
import subprocess
import tempfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPT = ROOT / "tools" / "apply-agent-delivery.ps1"
HARNESS = ROOT / "tests" / "windows" / "apply_agent_delivery_matrix.ps1"
MATRIX = ROOT / "tests" / "windows" / "APPLY_AGENT_DELIVERY_MATRIX.md"


def run(*command: str, cwd: Path, text: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=cwd, check=True, capture_output=True, text=text)


for path in (SCRIPT, HARNESS, MATRIX):
    assert path.is_file(), f"Missing delivery validation asset: {path.relative_to(ROOT)}"

script = SCRIPT.read_text(encoding="utf-8")
harness = HARNESS.read_text(encoding="utf-8")
matrix = MATRIX.read_text(encoding="utf-8")

required_script_guards = (
    "ValidatePattern('^[0-9a-fA-F]{40}$')",
    "maintenance/workflow-repair-clean",
    "-Push requires -Commit",
    "Working tree must be clean",
    "including ignored paths outside allowed artifact roots",
    "Origin mismatch",
    "'core.whitespace=blank-at-eol,blank-at-eof,space-before-tab,cr-at-eol'",
    "'apply', '--check', '--whitespace=error-all'",
    "Get-RepositorySnapshot",
    "--others', '--ignored', '--exclude-standard",
    "Compare-RepositorySnapshots",
    "Validation produced unexpected final-state side effects",
    "git' -ArgumentList $addArguments",
    "@('add', '-A', '--') + $changedPaths",
    "vaw-agent-delivery-state.json",
    "Remote race detected",
    "Remote SHA confirmation failed",
    "Push confirmed",
    "ConvertTo-NativeArgument",
    "$value.StartsWith('./', [System.StringComparison]::Ordinal)",
    "$value = $value.Substring(2)",
    "Commit left working-tree changes behind",
    "'apply', '--reverse', '--check'",
)
for guard in required_script_guards:
    assert guard in script, f"Delivery script lost safeguard: {guard}"

assert ".TrimStart([char[]]'./')" not in script, "Dotfiles must not lose leading dots during normalization"

for forbidden in ("--force", "push -f", "reset --hard", "clean -fd"):
    assert forbidden not in script, f"Delivery script contains destructive workflow token: {forbidden}"

required_harness_cases = (
    "valid complex patch: add/delete/rename/spaces/polish/BOM/LF/CRLF",
    "dotfiles commit completeness and clean worktree",
    "wrong full base SHA",
    "short SHA parameter",
    "dirty tree",
    "pre-existing ignored file",
    "missing origin",
    "different origin repository",
    "validation timeout",
    "unexpected ignored validation side effect",
    "validation modifies an expected patch path",
    "push success and remote SHA confirmation: existing branch",
    "push success and remote SHA confirmation: new branch",
    "remote race between validation and push",
    "push reject",
    "interruption after apply and safe manual recovery",
    "interruption after commit and safe manual recovery",
    "interruption after push and remote-state recovery",
)
for case in required_harness_cases:
    assert case in harness, f"Windows harness lost scenario: {case}"

assert "git -C $work diff --cached --binary --full-index --no-ext-diff --output=$patch" in harness
assert "Invoke-Git $work add -A" in harness
assert "Invoke-Git $work reset --hard HEAD" in harness, "Disposable fixture must return to its exact baseline"
assert "VAW_DELIVERY_PAUSE_AFTER" in harness
assert "taskkill.exe /PID" in harness

# Reproduce the harness patch strategy with real Git. This does not execute PowerShell,
# but it prevents a repeat of the earlier bug where untracked additions and a staged
# rename were silently omitted from the generated patch.
with tempfile.TemporaryDirectory(prefix="vaw-delivery-contract-") as temporary:
    root = Path(temporary)
    source = root / "source"
    fresh = root / "fresh"
    source.mkdir()
    run("git", "init", cwd=source)
    run("git", "config", "user.name", "VAW contract", cwd=source)
    run("git", "config", "user.email", "contract@example.invalid", cwd=source)
    run("git", "config", "core.autocrlf", "false", cwd=source)
    (source / ".gitignore").write_text(".agent-validation/\n*.log\n", encoding="utf-8")
    (source / "base.txt").write_text("baseline\n", encoding="utf-8")
    (source / "delete-me.txt").write_text("delete\n", encoding="utf-8")
    (source / "rename-me.txt").write_text("rename\n", encoding="utf-8")
    run("git", "add", "--", ".gitignore", "base.txt", "delete-me.txt", "rename-me.txt", cwd=source)
    run("git", "commit", "-m", "baseline", cwd=source)
    base_sha = run("git", "rev-parse", "HEAD", cwd=source).stdout.strip()

    (source / ".gitignore").write_text(".agent-validation/\n*.log\nmatrix-generated/\n", encoding="utf-8")
    workflow = source / ".github" / "workflows" / "example.yml"
    workflow.parent.mkdir(parents=True)
    workflow.write_text("name: matrix-dotfile\non: workflow_dispatch\n", encoding="utf-8")
    (source / "base.txt").write_text("updated\n", encoding="utf-8")
    (source / "delete-me.txt").unlink()
    run("git", "mv", "--", "rename-me.txt", "renamed file.txt", cwd=source)
    (source / "zażółć gęślą jaźń.txt").write_text("polskie znaki\n", encoding="utf-8")
    (source / "bom.txt").write_bytes(codecs.BOM_UTF8 + b"BOM\n")
    (source / "crlf.txt").write_bytes(b"a\r\nb\r\n")
    run("git", "add", "-A", cwd=source)
    patch_bytes = run(
        "git", "diff", "--cached", "--binary", "--full-index", "--no-ext-diff", cwd=source, text=False
    ).stdout
    patch_text = patch_bytes.decode("utf-8", errors="surrogateescape")
    assert "new file mode" in patch_text
    assert "a/.gitignore" in patch_text and "b/.gitignore" in patch_text
    assert ".github/workflows/example.yml" in patch_text
    assert "deleted file mode" in patch_text
    assert "rename from rename-me.txt" in patch_text
    assert "rename to renamed file.txt" in patch_text
    assert "zażółć gęślą jaźń.txt" in patch_text or "\\" in patch_text

    run("git", "clone", "--no-local", str(source), str(fresh), cwd=root)
    run("git", "checkout", base_sha, cwd=fresh)
    patch_path = root / "complex.patch"
    patch_path.write_bytes(patch_bytes)
    run("git", "-c", "core.whitespace=cr-at-eol", "apply", "--check", "--whitespace=error-all", str(patch_path), cwd=fresh)
    run("git", "-c", "core.whitespace=cr-at-eol", "apply", "--whitespace=error-all", str(patch_path), cwd=fresh)

    assert "matrix-generated/" in (fresh / ".gitignore").read_text(encoding="utf-8")
    assert "matrix-dotfile" in (fresh / ".github" / "workflows" / "example.yml").read_text(encoding="utf-8")
    assert (fresh / "base.txt").read_text(encoding="utf-8") == "updated\n"
    assert not (fresh / "delete-me.txt").exists()
    assert not (fresh / "rename-me.txt").exists()
    assert (fresh / "renamed file.txt").read_text(encoding="utf-8") == "rename\n"
    assert (fresh / "zażółć gęślą jaźń.txt").exists()
    assert (fresh / "bom.txt").read_bytes().startswith(codecs.BOM_UTF8)
    assert b"\r\n" in (fresh / "crlf.txt").read_bytes()

    run("git", "add", "-A", cwd=fresh)
    run("git", "config", "user.name", "VAW contract", cwd=fresh)
    run("git", "config", "user.email", "contract@example.invalid", cwd=fresh)
    run("git", "commit", "-m", "apply complex patch", cwd=fresh)
    committed_paths = run("git", "show", "--pretty=format:", "--name-only", "HEAD", cwd=fresh).stdout.splitlines()
    assert ".gitignore" in committed_paths
    assert ".github/workflows/example.yml" in committed_paths
    assert run("git", "status", "--porcelain=v1", "--untracked-files=all", cwd=fresh).stdout == ""
    run(
        "git", "-c", "core.whitespace=cr-at-eol", "apply", "--reverse", "--check",
        "--whitespace=error-all", str(patch_path), cwd=fresh
    )

for environment in ("Windows PowerShell 5.1", "pwsh 7 Windows"):
    assert environment in matrix
assert matrix.count("NOT-RUN") >= 20, "Unexecuted Windows cases must remain explicitly NOT-RUN"
assert "PREPARED" in matrix
assert "not a substitute for Windows execution" in matrix
assert "WINDOWS_EXECUTION=NOT-RUN" in matrix

print(
    {
        "deliveryScriptGuards": len(required_script_guards),
        "windowsHarnessCases": len(required_harness_cases),
        "complexPatchSemanticReplay": "pass",
        "windowsExecution": "NOT-RUN",
        "remoteDelivery": "NOT-ATTEMPTED-BY-TEST",
    }
)
