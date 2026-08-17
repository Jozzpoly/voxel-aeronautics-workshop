from __future__ import annotations

import json
import os
import signal
import stat
import subprocess
import sys
import tempfile
import time
from pathlib import Path

sys.dont_write_bytecode = True

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "tools"))

from validation_runner import (  # noqa: E402
    Plan,
    ResumeRejected,
    Stage,
    ValidationConfigurationError,
    changed_paths,
    repository_snapshot,
    run_plan,
    select_stages,
)

PYTHON = sys.executable


def normalize_path_text(value: str) -> str:
    return value.replace("\\", "/")


def git(root: Path, *args: str) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        text=True,
        encoding="utf-8",
        errors="surrogateescape",
        capture_output=True,
        check=True,
    )
    return result.stdout.strip()


def make_repo() -> Path:
    root = Path(tempfile.mkdtemp(prefix="vaw-validation-runner-"))
    git(root, "init", "-q")
    git(root, "config", "user.name", "Validation Test")
    git(root, "config", "user.email", "validation@example.invalid")
    (root / "tracked.txt").write_text("baseline\n", encoding="utf-8")
    git(root, "add", "tracked.txt")
    git(root, "commit", "-q", "-m", "baseline")
    return root


def stage(name: str, code: str, timeout: float = 10) -> Stage:
    return Stage(name, (PYTHON, "-c", code), timeout)


def expect_resume_rejected(plan: Plan, root: Path, run_dir: Path, fragment: str) -> None:
    try:
        run_plan(plan, root, resume=run_dir)
    except ResumeRejected as error:
        assert fragment in str(error), str(error)
    else:
        raise AssertionError(f"resume should have been rejected: {fragment}")


def test_plan_validation_and_selection() -> None:
    plan = Plan("selection", (stage("one", "pass"), stage("two", "pass"), stage("three", "pass")))
    assert select_stages(plan, ["two"], None) == {"two"}
    assert select_stages(plan, None, "two") == {"two", "three"}
    try:
        select_stages(plan, ["missing"], None)
    except ValidationConfigurationError as error:
        assert "missing" in str(error)
    else:
        raise AssertionError("unknown stage was accepted")
    try:
        Plan("duplicates", (stage("same", "pass"), stage("same", "pass")))
    except ValidationConfigurationError as error:
        assert "Duplicate" in str(error)
    else:
        raise AssertionError("duplicate stage names were accepted")


def test_pass_fail_timeout_and_basic_side_effects() -> None:
    root = make_repo()
    pass_plan = Plan("pass", (stage("pass", "print('ok')"),))
    code, run_dir, summary = run_plan(pass_plan, root)
    assert code == 0
    assert summary["outcome"] == "pass"
    assert summary["stages"][0]["status"] == "pass"
    persisted = json.loads((run_dir / "summary.json").read_text(encoding="utf-8"))
    assert persisted["outcome"] == "pass"
    events = (run_dir / "events.jsonl").read_text(encoding="utf-8").splitlines()
    assert events and all(json.loads(line) for line in events)

    fail_plan = Plan("fail", (stage("fail", "raise SystemExit(7)"), stage("later", "pass")))
    code, _, summary = run_plan(fail_plan, root)
    assert code == 1
    assert [item["status"] for item in summary["stages"]] == ["fail", "not-run"]
    assert summary["stages"][0]["exitCode"] == 7

    timeout_plan = Plan("timeout", (stage("timeout", "import time; time.sleep(60)", 0.25),))
    started = time.monotonic()
    code, _, summary = run_plan(timeout_plan, root)
    assert code == 1
    assert summary["stages"][0]["status"] == "timeout"
    assert time.monotonic() - started < 8

    side_effect_plan = Plan(
        "side-effect",
        (stage("writes", "from pathlib import Path; Path('unexpected.txt').write_text('x')"),),
    )
    code, _, summary = run_plan(side_effect_plan, root)
    assert code == 1
    record = summary["stages"][0]
    assert record["status"] == "fail"
    assert {item["path"] for item in record["sideEffects"]} == {"unexpected.txt"}
    assert (root / "unexpected.txt").is_file(), "runner must not clean side effects"


def test_snapshot_covers_ignored_modes_symlinks_and_unusual_paths() -> None:
    root = make_repo()
    (root / ".gitignore").write_text("dist/\n*.log\n.agent-validation/\n", encoding="utf-8")
    git(root, "add", ".gitignore")
    git(root, "commit", "-q", "-m", "ignore policy")

    before = repository_snapshot(root, [root / ".agent-validation"])
    (root / "dist").mkdir()
    (root / "dist" / "generated.bin").write_bytes(b"ignored-dist")
    (root / "stage.log").write_text("ignored-log\n", encoding="utf-8")
    (root / ".agent-validation").mkdir()
    (root / ".agent-validation" / "allowed.log").write_text("runner artifact\n", encoding="utf-8")
    after = repository_snapshot(root, [root / ".agent-validation"])
    differences = {item["path"] for item in changed_paths(before, after)}
    assert differences == {"dist/generated.bin", "stage.log"}

    portable_unusual_name = "odd path-zażółć.txt"
    portable_unusual = root / portable_unusual_name
    portable_unusual.write_text("odd path\n", encoding="utf-8")
    portable_snapshot = repository_snapshot(root, [root / ".agent-validation"])
    # These assertions intentionally run on Windows: only the newline-name case is platform-gated.
    assert portable_unusual_name in portable_snapshot
    assert " " in portable_unusual_name
    assert any(ord(character) > 127 for character in portable_unusual_name)

    if os.name != "nt":
        newline_unusual_name = "line\nbreak-zażółć.txt"
        newline_unusual = root / newline_unusual_name
        newline_unusual.write_text("newline path\n", encoding="utf-8")
        assert newline_unusual_name in repository_snapshot(root, [root / ".agent-validation"])

    tracked = root / "tracked.txt"
    mode_before = repository_snapshot(root, [root / ".agent-validation"])["tracked.txt"]
    if os.name != "nt":
        tracked.chmod(tracked.stat().st_mode | stat.S_IXUSR)
        mode_after = repository_snapshot(root, [root / ".agent-validation"])["tracked.txt"]
        assert mode_after != mode_before
        tracked.chmod(tracked.stat().st_mode & ~stat.S_IXUSR)

    symlink_path = root / "tracked-link"
    try:
        symlink_path.symlink_to("tracked.txt")
    except (OSError, NotImplementedError):
        pass
    else:
        identity = repository_snapshot(root, [root / ".agent-validation"])["tracked-link"]
        assert identity.startswith("symlink:") and identity.endswith(":tracked.txt")

    original = repository_snapshot(root, [root / ".agent-validation"])["tracked.txt"]
    tracked.unlink()
    tracked.write_text("recreated with different content\n", encoding="utf-8")
    recreated = repository_snapshot(root, [root / ".agent-validation"])["tracked.txt"]
    assert recreated != original


def test_ignored_side_effects_fail_but_artifact_root_is_allowed() -> None:
    root = make_repo()
    (root / ".gitignore").write_text("dist/\n*.log\n.agent-validation/\n", encoding="utf-8")
    git(root, "add", ".gitignore")
    git(root, "commit", "-q", "-m", "ignore policy")

    ignored_plan = Plan(
        "ignored-effects",
        (
            stage(
                "ignored-writes",
                "from pathlib import Path; Path('dist').mkdir(); "
                "Path('dist/generated.txt').write_text('x'); Path('validation.log').write_text('x')",
            ),
        ),
    )
    code, _, summary = run_plan(ignored_plan, root)
    assert code == 1
    assert {item["path"] for item in summary["stages"][0]["sideEffects"]} == {
        "dist/generated.txt",
        "validation.log",
    }

    (root / "dist" / "generated.txt").unlink()
    (root / "dist").rmdir()
    (root / "validation.log").unlink()
    allowed_plan = Plan(
        "allowed-artifacts",
        (
            stage(
                "artifact-write",
                "from pathlib import Path; Path('.agent-validation').mkdir(exist_ok=True); "
                "Path('.agent-validation/extra.log').write_text('ok')",
            ),
        ),
    )
    code, _, summary = run_plan(allowed_plan, root)
    assert code == 0
    assert summary["stages"][0]["sideEffects"] == []


def test_resume_after_failure_preserves_pass_and_reaches_later_stage() -> None:
    root = make_repo()
    conditional = "import os; raise SystemExit(5 if os.environ.get('VAW_RESUME_TEST_FAIL') else 0)"
    plan = Plan(
        "resume-after-fail",
        (stage("already-done", "print('done')"), stage("flaky", conditional), stage("later", "print('later')")),
    )
    os.environ["VAW_RESUME_TEST_FAIL"] = "1"
    try:
        code, run_dir, failed = run_plan(plan, root)
    finally:
        os.environ.pop("VAW_RESUME_TEST_FAIL", None)
    assert code == 1
    assert [record["status"] for record in failed["stages"]] == ["pass", "fail", "not-run"]
    assert all(record["selected"] for record in failed["stages"])

    code, _, resumed = run_plan(plan, root, resume=run_dir)
    assert code == 0
    assert [record["status"] for record in resumed["stages"]] == ["pass", "pass", "pass"]
    assert resumed["stages"][0]["resumed"] is True
    assert resumed["resumeCount"] == 1


def test_resume_after_timeout() -> None:
    root = make_repo()
    conditional = "import os,time; time.sleep(60) if os.environ.get('VAW_TIMEOUT_ONCE') else print('recovered')"
    plan = Plan("resume-timeout", (stage("flaky-timeout", conditional, 12.0), stage("later", "print('later')")))
    os.environ["VAW_TIMEOUT_ONCE"] = "1"
    try:
        code, run_dir, timed_out = run_plan(plan, root)
    finally:
        os.environ.pop("VAW_TIMEOUT_ONCE", None)
    assert code == 1
    assert [record["status"] for record in timed_out["stages"]] == ["timeout", "not-run"]
    code, _, resumed = run_plan(plan, root, resume=run_dir)
    assert code == 0
    assert [record["status"] for record in resumed["stages"]] == ["pass", "pass"]


def test_resume_rejects_changed_tree_head_plan_corruption_and_missing_log() -> None:
    # Working tree mismatch.
    root = make_repo()
    plan = Plan("identity", (stage("one", "print('ok')"),))
    _, run_dir, _ = run_plan(plan, root)
    (root / "tracked.txt").write_text("changed\n", encoding="utf-8")
    expect_resume_rejected(plan, root, run_dir, "repositoryFingerprint")

    # HEAD mismatch with otherwise clean tree.
    root = make_repo()
    _, run_dir, _ = run_plan(plan, root)
    (root / "next.txt").write_text("next\n", encoding="utf-8")
    git(root, "add", "next.txt")
    git(root, "commit", "-q", "-m", "move head")
    expect_resume_rejected(plan, root, run_dir, "repositoryHead")

    # Plan digest/definition mismatch.
    root = make_repo()
    _, run_dir, _ = run_plan(plan, root)
    changed_plan = Plan("identity", (stage("one", "print('different')"),))
    expect_resume_rejected(changed_plan, root, run_dir, "definition changed")

    # Corrupt/partial JSON.
    root = make_repo()
    _, run_dir, _ = run_plan(plan, root)
    (run_dir / "summary.json").write_text('{"schemaVersion":', encoding="utf-8")
    expect_resume_rejected(plan, root, run_dir, "Cannot read resume summary")

    # A passed stage without its log is not reusable evidence.
    root = make_repo()
    _, run_dir, summary = run_plan(plan, root)
    (run_dir / summary["stages"][0]["log"]).unlink()
    expect_resume_rejected(plan, root, run_dir, "missing its log")


def test_resume_preserves_selected_and_unselected_not_run_semantics() -> None:
    root = make_repo()
    plan = Plan("selection-resume", (stage("one", "print('one')"), stage("two", "raise SystemExit(9)")))
    code, run_dir, summary = run_plan(plan, root, only=["one"])
    assert code == 0
    assert [(record["selected"], record["status"]) for record in summary["stages"]] == [
        (True, "pass"),
        (False, "not-run"),
    ]
    code, _, resumed = run_plan(plan, root, resume=run_dir)
    assert code == 0
    assert [(record["selected"], record["status"]) for record in resumed["stages"]] == [
        (True, "pass"),
        (False, "not-run"),
    ]


def test_spawn_error_is_durable_failure_with_log() -> None:
    root = make_repo()
    plan = Plan("spawn-error", (Stage("missing", ("definitely-not-a-real-vaw-command",), 5),))
    code, run_dir, summary = run_plan(plan, root)
    assert code == 1
    record = summary["stages"][0]
    assert record["status"] == "fail"
    assert "FileNotFoundError" in record["error"]
    persisted = json.loads((run_dir / "summary.json").read_text(encoding="utf-8"))
    assert persisted["outcome"] == "fail"
    assert persisted["stages"][0]["status"] == "fail"
    log = (run_dir / record["log"]).read_text(encoding="utf-8")
    assert "VALIDATION_INTERRUPTED" in log and "VALIDATION_RUNNER_ERROR" in log


def _family_stage_code(
    marker: Path,
    environment_flag: str | None = None,
    *,
    ready_marker: Path | None = None,
    marker_delay: float = 2.0,
) -> str:
    grandchild_lines = [
        "import time",
        "from pathlib import Path",
    ]
    if ready_marker is not None:
        grandchild_lines.append(
            f"Path({str(ready_marker)!r}).write_text('ready', encoding='utf-8')"
        )
    grandchild_lines.extend(
        (
            f"time.sleep({marker_delay!r})",
            f"Path({str(marker)!r}).write_text('orphan', encoding='utf-8')",
        )
    )
    grandchild = "\n".join(grandchild_lines)
    condition = "True" if environment_flag is None else f"os.environ.get({environment_flag!r}) == '1'"
    lines = [
        "import os",
        "import subprocess",
        "import sys",
        "import time",
        "from pathlib import Path",
        f"active = {condition}",
        "if active:",
        f"    subprocess.Popen([sys.executable, '-c', {grandchild!r}])",
    ]
    if ready_marker is not None:
        lines.extend(
            (
                f"    ready = Path({str(ready_marker)!r})",
                "    ready_deadline = time.monotonic() + 5.0",
                "    while not ready.exists() and time.monotonic() < ready_deadline:",
                "        time.sleep(0.05)",
                "    if not ready.exists():",
                "        raise RuntimeError('descendant did not become ready')",
            )
        )
    lines.extend(
        (
            "print('READY', flush=True)",
            "if active:",
            "    time.sleep(60)",
        )
    )
    return "\n".join(lines)


def test_timeout_terminates_process_family() -> None:
    root = make_repo()
    requested_run_dir = root / ".agent-validation" / "family-timeout"
    ready_marker = requested_run_dir / "descendant-ready.txt"
    orphan_marker = requested_run_dir / "timeout-orphan.txt"
    orphan_delay = 12.0
    plan = Plan(
        "family-timeout",
        (
            stage(
                "family",
                _family_stage_code(
                    orphan_marker,
                    ready_marker=ready_marker,
                    marker_delay=orphan_delay,
                ),
                6.0,
            ),
        ),
    )
    code, run_dir, summary = run_plan(plan, root, run_dir=requested_run_dir)
    assert run_dir == requested_run_dir
    assert code == 1
    assert ready_marker.is_file(), "timeout fixture did not prove that the descendant started"
    assert ready_marker.read_text(encoding="utf-8") == "ready"
    assert summary["stages"][0]["status"] == "timeout"
    assert "VALIDATION_TIMEOUT" in (run_dir / summary["stages"][0]["log"]).read_text(encoding="utf-8")
    time.sleep(orphan_delay + 0.5)
    assert not orphan_marker.exists(), "timeout left a descendant alive long enough to write after cleanup"


def test_host_sigterm_persists_interruption_kills_family_and_resumes() -> None:
    if os.name == "nt":
        return
    root = make_repo()
    marker = root / "signal-orphan.txt"
    code_text = _family_stage_code(marker, "VAW_INTERRUPT_LONG")
    driver = root / "driver.py"
    driver.write_text(
        (
            "import sys\n"
            "from pathlib import Path\n"
            "sys.path.insert(0, sys.argv[1])\n"
            "from validation_runner import Plan, Stage, run_plan\n"
            "root = Path(sys.argv[2])\n"
            f"code_text = {code_text!r}\n"
            "plan = Plan('interrupt', (Stage('long', (sys.executable, '-c', code_text), 120),))\n"
            "code, _, _ = run_plan(plan, root, run_dir=root / '.agent-validation' / 'interrupt')\n"
            "raise SystemExit(code)\n"
        ),
        encoding="utf-8",
    )
    environment = os.environ.copy()
    environment["VAW_INTERRUPT_LONG"] = "1"
    process = subprocess.Popen([PYTHON, str(driver), str(ROOT / "tools"), str(root)], env=environment)
    summary_path = root / ".agent-validation" / "interrupt" / "summary.json"
    deadline = time.monotonic() + 10
    while time.monotonic() < deadline:
        if summary_path.is_file():
            data = json.loads(summary_path.read_text(encoding="utf-8"))
            log_path = summary_path.parent / data["stages"][0]["log"]
            if log_path.is_file() and "READY" in log_path.read_text(encoding="utf-8"):
                break
        time.sleep(0.05)
    else:
        process.kill()
        raise AssertionError("runner did not start the interruptible stage")

    process.send_signal(signal.SIGTERM)
    process.wait(timeout=10)
    assert process.returncode == 130
    data = json.loads(summary_path.read_text(encoding="utf-8"))
    assert data["outcome"] == "interrupted"
    assert data["stages"][0]["status"] == "pending"
    log_path = summary_path.parent / data["stages"][0]["log"]
    assert "VALIDATION_INTERRUPTED" in log_path.read_text(encoding="utf-8")
    time.sleep(2.5)
    assert not marker.exists(), "SIGTERM left a descendant process alive"

    plan = Plan("interrupt", (stage("long", code_text, 120),))
    code, _, resumed = run_plan(plan, root, resume=summary_path.parent)
    assert code == 0
    assert resumed["outcome"] == "pass"
    assert resumed["resumeCount"] == 1



def test_run_directory_command_tokens_are_isolated() -> None:
    root = make_repo()
    code_text = (
        "from pathlib import Path; import sys; "
        "target=Path(sys.argv[1]); target.mkdir(parents=True, exist_ok=True); "
        "(target/'marker.txt').write_text(str(target))"
    )
    plan = Plan(
        "run-token",
        (
            Stage(
                "write",
                (PYTHON, "-c", code_text, "{run_dir}/release", "{root}/root-token-sentinel"),
                10,
            ),
        ),
    )
    code_one, run_one, summary_one = run_plan(plan, root)
    code_two, run_two, summary_two = run_plan(plan, root)
    assert code_one == code_two == 0
    assert run_one != run_two
    marker_one = run_one / "release" / "marker.txt"
    marker_two = run_two / "release" / "marker.txt"
    assert marker_one.is_file() and marker_two.is_file()

    expected_one = normalize_path_text(str(run_one / "release"))
    expected_two = normalize_path_text(str(run_two / "release"))
    expected_root_token = normalize_path_text(str(root / "root-token-sentinel"))
    assert normalize_path_text(marker_one.read_text(encoding="utf-8")) == expected_one
    assert normalize_path_text(marker_two.read_text(encoding="utf-8")) == expected_two

    log_one = normalize_path_text(
        (run_one / summary_one["stages"][0]["log"]).read_text(encoding="utf-8")
    )
    log_two = normalize_path_text(
        (run_two / summary_two["stages"][0]["log"]).read_text(encoding="utf-8")
    )
    assert expected_one in log_one
    assert expected_two in log_two
    assert expected_root_token in log_one
    assert expected_root_token in log_two
    assert expected_two not in log_one
    assert expected_one not in log_two


def test_cli_list_only_from_invalid_and_resume() -> None:
    root = make_repo()
    driver = root / "cli_driver.py"
    driver.write_text(
        (
            "import os,sys\n"
            "from pathlib import Path\n"
            "sys.path.insert(0, sys.argv.pop(1))\n"
            "from validation_runner import Plan, Stage, cli\n"
            "root=Path.cwd()\n"
            "flaky=\"import os; raise SystemExit(4 if os.environ.get('VAW_CLI_FAIL') else 0)\"\n"
            "plan=Plan('cli-test',(Stage('one',(sys.executable,'-c',flaky),5),Stage('two',(sys.executable,'-c',\"print('two')\"),5)))\n"
            "raise SystemExit(cli(plan,root))\n"
        ),
        encoding="utf-8",
    )
    command = [PYTHON, str(driver), str(ROOT / "tools")]

    listed = subprocess.run([*command, "--list"], cwd=root, text=True, capture_output=True)
    assert listed.returncode == 0 and "one" in listed.stdout and "two" in listed.stdout

    only_dir = root / ".agent-validation" / "only"
    only = subprocess.run(
        [*command, "--only", "two", "--artifacts-dir", str(only_dir)],
        cwd=root,
        text=True,
        capture_output=True,
    )
    assert only.returncode == 0, only.stderr
    only_summary = json.loads((only_dir / "summary.json").read_text(encoding="utf-8"))
    assert [record["status"] for record in only_summary["stages"]] == ["not-run", "pass"]

    from_dir = root / ".agent-validation" / "from"
    from_run = subprocess.run(
        [*command, "--from", "two", "--artifacts-dir", str(from_dir)],
        cwd=root,
        text=True,
        capture_output=True,
    )
    assert from_run.returncode == 0, from_run.stderr

    invalid = subprocess.run([*command, "--only", "missing"], cwd=root, text=True, capture_output=True)
    assert invalid.returncode == 2 and "Unknown stage" in invalid.stderr

    resume_dir = root / ".agent-validation" / "cli-resume"
    environment = os.environ.copy()
    environment["VAW_CLI_FAIL"] = "1"
    failed = subprocess.run(
        [*command, "--artifacts-dir", str(resume_dir)],
        cwd=root,
        env=environment,
        text=True,
        capture_output=True,
    )
    assert failed.returncode == 1
    resumed = subprocess.run([*command, "--resume", str(resume_dir)], cwd=root, text=True, capture_output=True)
    assert resumed.returncode == 0, resumed.stderr
    resumed_summary = json.loads((resume_dir / "summary.json").read_text(encoding="utf-8"))
    assert [record["status"] for record in resumed_summary["stages"]] == ["pass", "pass"]


def test_node_stage_receives_python_environment() -> None:
    root = make_repo()
    driver = root / "requires_python_env.js"
    driver.write_text(
        (
            "const fs = require('fs');\n"
            "if (!process.env.PYTHON) process.exit(9);\n"
            "fs.writeFileSync(process.argv[2], process.env.PYTHON);\n"
        ),
        encoding="utf-8",
    )
    previous = os.environ.pop("PYTHON", None)
    try:
        plan = Plan("node-python-env", (Stage("node-env", ("node", str(driver), "{run_dir}/python-env.txt"), 10),))
        code, _, summary = run_plan(plan, root)
    finally:
        if previous is not None:
            os.environ["PYTHON"] = previous
    assert code == 0
    assert summary["stages"][0]["status"] == "pass"
    run_dir = Path(summary["runDirectory"])
    assert (run_dir / "python-env.txt").read_text(encoding="utf-8") == PYTHON


def main() -> None:
    test_plan_validation_and_selection()
    test_pass_fail_timeout_and_basic_side_effects()
    test_snapshot_covers_ignored_modes_symlinks_and_unusual_paths()
    test_ignored_side_effects_fail_but_artifact_root_is_allowed()
    test_resume_after_failure_preserves_pass_and_reaches_later_stage()
    test_resume_after_timeout()
    test_resume_rejects_changed_tree_head_plan_corruption_and_missing_log()
    test_resume_preserves_selected_and_unselected_not_run_semantics()
    test_spawn_error_is_durable_failure_with_log()
    test_timeout_terminates_process_family()
    test_host_sigterm_persists_interruption_kills_family_and_resumes()
    test_run_directory_command_tokens_are_isolated()
    test_cli_list_only_from_invalid_and_resume()
    test_node_stage_receives_python_environment()
    print(
        {
            "passFailTimeout": "ok",
            "ignoredSideEffects": "ok",
            "ignoredPathSnapshot": "ok",
            "portableSpaceUnicodePathSnapshot": "ok",
            "newlineFilenameSnapshot": "not-run-on-windows" if os.name == "nt" else "ok",
            "modeAndSymlinkSnapshot": "ok",
            "resumeFailureTimeoutInterrupt": "ok",
            "resumeIdentityMatrix": "ok",
            "missingLogRejection": "ok",
            "processFamilyCleanup": "ok",
            "spawnErrorPersistence": "ok",
            "runDirectoryTokenIsolation": "ok",
            "cliControls": "ok",
            "pythonEnvPropagation": "ok",
            "hostSignals": "ok" if os.name != "nt" else "not-run-on-windows",
            "identicalDeleteRecreate": "final-state-only-known-limitation",
            "sigkillCleanup": "not-guaranteed-known-limitation",
        }
    )


if __name__ == "__main__":
    main()
