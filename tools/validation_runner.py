#!/usr/bin/env python3
from __future__ import annotations

import argparse
import contextlib
import hashlib
import json
import os
import signal
import stat
import subprocess
import sys
import threading
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Iterable, Iterator, Sequence

STATUS_PENDING = "pending"
STATUS_PASS = "pass"
STATUS_FAIL = "fail"
STATUS_TIMEOUT = "timeout"
STATUS_NOT_RUN = "not-run"
VALID_STATUSES = {STATUS_PENDING, STATUS_PASS, STATUS_FAIL, STATUS_TIMEOUT, STATUS_NOT_RUN}
SUMMARY_SCHEMA_VERSION = 3


class ValidationConfigurationError(ValueError):
    """Raised when a validation plan or selection is invalid."""


class ResumeRejected(RuntimeError):
    """Raised when saved results do not belong to the current repository/plan."""


@dataclass(frozen=True)
class Stage:
    name: str
    command: tuple[str, ...]
    timeout_seconds: float
    description: str = ""

    def __post_init__(self) -> None:
        if not self.name or any(char.isspace() for char in self.name):
            raise ValidationConfigurationError(f"Invalid stage name: {self.name!r}")
        if not self.command:
            raise ValidationConfigurationError(f"Stage {self.name!r} has no command")
        if self.timeout_seconds <= 0:
            raise ValidationConfigurationError(f"Stage {self.name!r} timeout must be positive")

    def serializable(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "command": list(self.command),
            "timeoutSeconds": self.timeout_seconds,
            "description": self.description,
        }


@dataclass(frozen=True)
class Plan:
    name: str
    stages: tuple[Stage, ...]

    def __post_init__(self) -> None:
        names = [stage.name for stage in self.stages]
        duplicates = sorted({name for name in names if names.count(name) > 1})
        if duplicates:
            raise ValidationConfigurationError(f"Duplicate stage names: {', '.join(duplicates)}")
        if not self.stages:
            raise ValidationConfigurationError("Validation plan has no stages")

    @property
    def digest(self) -> str:
        payload = {
            "name": self.name,
            "stages": [stage.serializable() for stage in self.stages],
        }
        encoded = json.dumps(payload, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
        return hashlib.sha256(encoded).hexdigest()


def utc_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _fsync_directory(path: Path) -> None:
    """Best-effort directory fsync after an atomic replace on POSIX."""
    if os.name == "nt":
        return
    flags = os.O_RDONLY | getattr(os, "O_DIRECTORY", 0)
    try:
        descriptor = os.open(path, flags)
    except OSError:
        return
    try:
        os.fsync(descriptor)
    finally:
        os.close(descriptor)


def atomic_write_json(path: Path, payload: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(f".{path.name}.{os.getpid()}.tmp")
    try:
        with temporary.open("w", encoding="utf-8", newline="\n") as handle:
            json.dump(payload, handle, ensure_ascii=True, indent=2, sort_keys=True)
            handle.write("\n")
            handle.flush()
            os.fsync(handle.fileno())
        os.replace(temporary, path)
        _fsync_directory(path.parent)
    finally:
        try:
            temporary.unlink()
        except FileNotFoundError:
            pass


class EventLog:
    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self._handle = path.open("a", encoding="utf-8", newline="\n")

    def emit(self, event: str, **fields: Any) -> None:
        record = {"time": utc_now(), "event": event, **fields}
        self._handle.write(json.dumps(record, ensure_ascii=True, sort_keys=True) + "\n")
        self._handle.flush()
        os.fsync(self._handle.fileno())

    def close(self) -> None:
        self._handle.close()

    def __enter__(self) -> "EventLog":
        return self

    def __exit__(self, exc_type: Any, exc: Any, traceback: Any) -> None:
        self.close()


def _run_git(root: Path, *args: str, strip: bool = True) -> str:
    result = subprocess.run(
        ["git", *args],
        cwd=root,
        text=True,
        encoding="utf-8",
        errors="surrogateescape",
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        check=False,
    )
    if result.returncode != 0:
        message = result.stderr.strip() or result.stdout.strip() or "unknown git error"
        raise ValidationConfigurationError(f"git {' '.join(args)} failed: {message}")
    return result.stdout.strip() if strip else result.stdout


def git_head(root: Path) -> str:
    return _run_git(root, "rev-parse", "HEAD")


def _normalized_relative(path: Path, root: Path) -> str:
    return path.relative_to(root).as_posix()


def _is_inside(relative: str, excluded_prefixes: Sequence[str]) -> bool:
    return any(relative == prefix or relative.startswith(prefix + "/") for prefix in excluded_prefixes)


def _git_list_paths(root: Path, *args: str) -> set[str]:
    output = _run_git(root, "-c", "core.quotepath=false", "ls-files", *args, "-z", strip=False)
    return {entry for entry in output.split("\0") if entry}


def _file_digest(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def repository_snapshot(root: Path, excluded_paths: Iterable[Path] = ()) -> dict[str, str]:
    """Return final-state identities for tracked, untracked and ignored files.

    Only paths explicitly supplied in ``excluded_paths`` are omitted. The runner uses
    this for its own artifact directory. Ignored files elsewhere (for example
    ``dist/`` or ``*.log``) remain observable side effects.
    """

    root = root.resolve()
    excluded_prefixes: list[str] = []
    for path in excluded_paths:
        try:
            relative = _normalized_relative(path.resolve(), root).rstrip("/")
        except ValueError:
            continue
        if relative:
            excluded_prefixes.append(relative)

    visible = _git_list_paths(root, "--cached", "--others", "--exclude-standard")
    ignored = _git_list_paths(root, "--others", "--ignored", "--exclude-standard")
    entries = visible | ignored

    snapshot: dict[str, str] = {}
    for relative in sorted(entries):
        normalized = Path(relative).as_posix()
        if normalized == ".git" or normalized.startswith(".git/") or _is_inside(normalized, excluded_prefixes):
            continue
        absolute = root / relative
        try:
            metadata = absolute.lstat()
        except FileNotFoundError:
            snapshot[normalized] = "missing"
            continue
        mode = stat.S_IMODE(metadata.st_mode)
        if stat.S_ISLNK(metadata.st_mode):
            snapshot[normalized] = f"symlink:{mode:04o}:{os.readlink(absolute)}"
        elif stat.S_ISREG(metadata.st_mode):
            snapshot[normalized] = f"file:{mode:04o}:{metadata.st_size}:{_file_digest(absolute)}"
        else:
            snapshot[normalized] = f"other:{mode:04o}:{metadata.st_size}"
    return snapshot


def snapshot_digest(snapshot: dict[str, str]) -> str:
    encoded = json.dumps(snapshot, ensure_ascii=True, sort_keys=True, separators=(",", ":")).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def changed_paths(before: dict[str, str], after: dict[str, str]) -> list[dict[str, str]]:
    changes: list[dict[str, str]] = []
    for path in sorted(set(before) | set(after)):
        previous = before.get(path)
        current = after.get(path)
        if previous == current:
            continue
        if previous is None:
            kind = "created"
        elif current is None or current == "missing":
            kind = "deleted"
        else:
            kind = "modified"
        changes.append({"path": path, "kind": kind})
    return changes


def select_stages(plan: Plan, only: Sequence[str] | None, from_stage: str | None) -> set[str]:
    names = [stage.name for stage in plan.stages]
    if only and from_stage:
        raise ValidationConfigurationError("--only and --from cannot be combined")
    if only:
        unknown = sorted(set(only) - set(names))
        if unknown:
            raise ValidationConfigurationError(f"Unknown stage name(s): {', '.join(unknown)}")
        return set(only)
    if from_stage:
        if from_stage not in names:
            raise ValidationConfigurationError(f"Unknown stage name: {from_stage}")
        return set(names[names.index(from_stage) :])
    return set(names)


def _process_group_options() -> dict[str, Any]:
    if os.name == "nt":
        return {"creationflags": subprocess.CREATE_NEW_PROCESS_GROUP}
    return {"start_new_session": True}


def _windows_descendant_pids(root_pid: int) -> list[int]:
    if os.name != "nt":
        return []
    import ctypes
    from ctypes import wintypes

    class PROCESSENTRY32W(ctypes.Structure):
        _fields_ = [
            ("dwSize", wintypes.DWORD),
            ("cntUsage", wintypes.DWORD),
            ("th32ProcessID", wintypes.DWORD),
            ("th32DefaultHeapID", ctypes.c_void_p),
            ("th32ModuleID", wintypes.DWORD),
            ("cntThreads", wintypes.DWORD),
            ("th32ParentProcessID", wintypes.DWORD),
            ("pcPriClassBase", wintypes.LONG),
            ("dwFlags", wintypes.DWORD),
            ("szExeFile", wintypes.WCHAR * 260),
        ]

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.CreateToolhelp32Snapshot.argtypes = [wintypes.DWORD, wintypes.DWORD]
    kernel32.CreateToolhelp32Snapshot.restype = wintypes.HANDLE
    kernel32.Process32FirstW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
    kernel32.Process32FirstW.restype = wintypes.BOOL
    kernel32.Process32NextW.argtypes = [wintypes.HANDLE, ctypes.POINTER(PROCESSENTRY32W)]
    kernel32.Process32NextW.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    snapshot = kernel32.CreateToolhelp32Snapshot(0x00000002, 0)
    if snapshot == ctypes.c_void_p(-1).value:
        return []
    children_by_parent: dict[int, list[int]] = {}
    try:
        entry = PROCESSENTRY32W()
        entry.dwSize = ctypes.sizeof(entry)
        if not kernel32.Process32FirstW(snapshot, ctypes.byref(entry)):
            return []
        while True:
            pid = int(entry.th32ProcessID)
            parent_pid = int(entry.th32ParentProcessID)
            children_by_parent.setdefault(parent_pid, []).append(pid)
            if not kernel32.Process32NextW(snapshot, ctypes.byref(entry)):
                break
    finally:
        kernel32.CloseHandle(snapshot)

    ordered: list[int] = []
    seen = {root_pid, os.getpid()}
    stack = [root_pid]
    while stack:
        parent = stack.pop()
        for child in children_by_parent.get(parent, []):
            if child in seen:
                continue
            seen.add(child)
            ordered.append(child)
            stack.append(child)
    return ordered


def _windows_terminate_pids(pids: Iterable[int]) -> None:
    if os.name != "nt":
        return
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.TerminateProcess.argtypes = [wintypes.HANDLE, wintypes.UINT]
    kernel32.TerminateProcess.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    seen: set[int] = set()
    for pid in pids:
        pid = int(pid)
        if pid <= 0 or pid == os.getpid() or pid in seen:
            continue
        seen.add(pid)
        handle = kernel32.OpenProcess(0x0001, False, pid)
        if not handle:
            continue
        try:
            kernel32.TerminateProcess(handle, 1)
        finally:
            kernel32.CloseHandle(handle)


def _windows_process_is_active(pid: int) -> bool:
    if os.name != "nt":
        return False
    import ctypes
    from ctypes import wintypes

    kernel32 = ctypes.WinDLL("kernel32", use_last_error=True)
    kernel32.OpenProcess.argtypes = [wintypes.DWORD, wintypes.BOOL, wintypes.DWORD]
    kernel32.OpenProcess.restype = wintypes.HANDLE
    kernel32.GetExitCodeProcess.argtypes = [wintypes.HANDLE, ctypes.POINTER(wintypes.DWORD)]
    kernel32.GetExitCodeProcess.restype = wintypes.BOOL
    kernel32.CloseHandle.argtypes = [wintypes.HANDLE]
    kernel32.CloseHandle.restype = wintypes.BOOL

    handle = kernel32.OpenProcess(0x1000, False, int(pid))
    if not handle:
        return False
    try:
        exit_code = wintypes.DWORD()
        if not kernel32.GetExitCodeProcess(handle, ctypes.byref(exit_code)):
            return False
        return exit_code.value == 259
    finally:
        kernel32.CloseHandle(handle)


def _windows_wait_for_pids(pids: Iterable[int], timeout_seconds: float) -> None:
    if os.name != "nt":
        return
    candidates = {int(pid) for pid in pids if int(pid) > 0 and int(pid) != os.getpid()}
    deadline = time.monotonic() + timeout_seconds
    while candidates and time.monotonic() < deadline:
        candidates = {pid for pid in candidates if _windows_process_is_active(pid)}
        if candidates:
            time.sleep(0.05)


def terminate_process_family(process: subprocess.Popen[str], grace_seconds: float = 2.0) -> None:
    if os.name == "nt":
        descendant_pids = _windows_descendant_pids(process.pid)
        if process.poll() is None:
            subprocess.run(
                ["taskkill", "/PID", str(process.pid), "/T", "/F"],
                stdout=subprocess.DEVNULL,
                stderr=subprocess.DEVNULL,
                check=False,
            )
        _windows_terminate_pids([*reversed(descendant_pids), process.pid])
        try:
            process.wait(timeout=grace_seconds)
        except subprocess.TimeoutExpired:
            process.kill()
            with contextlib.suppress(subprocess.TimeoutExpired):
                process.wait(timeout=grace_seconds)
        _windows_wait_for_pids(descendant_pids, grace_seconds)
        return
    if process.poll() is not None:
        return
    try:
        os.killpg(process.pid, signal.SIGTERM)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=grace_seconds)
        return
    except subprocess.TimeoutExpired:
        pass
    try:
        os.killpg(process.pid, signal.SIGKILL)
    except ProcessLookupError:
        return
    try:
        process.wait(timeout=grace_seconds)
    except subprocess.TimeoutExpired:
        process.kill()


def _safe_log_name(stage_name: str) -> str:
    return "".join(char if char.isalnum() or char in "-_." else "_" for char in stage_name) + ".log"


def _resolve_stage_command(stage: Stage, root: Path, run_dir: Path) -> tuple[str, ...]:
    replacements = {
        "{root}": str(root),
        "{run_dir}": str(run_dir),
    }
    resolved: list[str] = []
    for argument in stage.command:
        value = argument
        for token, replacement in replacements.items():
            value = value.replace(token, replacement)
        resolved.append(value)
    return tuple(resolved)


def _durable_log_line(log: Any, text: str) -> None:
    log.write(text)
    log.flush()
    os.fsync(log.fileno())


def run_stage(
    stage: Stage, root: Path, log_path: Path, command: Sequence[str] | None = None
) -> tuple[str, int | None, float]:
    log_path.parent.mkdir(parents=True, exist_ok=True)
    started = time.monotonic()
    process: subprocess.Popen[str] | None = None
    resolved_command = tuple(command or stage.command)
    with log_path.open("w", encoding="utf-8", newline="\n") as log:
        _durable_log_line(log, f"$ {' '.join(resolved_command)}\ntimeout={stage.timeout_seconds}s\n\n")
        child_environment = os.environ.copy()
        child_environment["PYTHONDONTWRITEBYTECODE"] = "1"
        child_environment.setdefault("PYTHON", sys.executable)
        try:
            process = subprocess.Popen(
                list(resolved_command),
                cwd=root,
                text=True,
                stdout=log,
                stderr=subprocess.STDOUT,
                env=child_environment,
                **_process_group_options(),
            )
            try:
                process.communicate(timeout=stage.timeout_seconds)
                return_code = process.returncode
            except subprocess.TimeoutExpired:
                terminate_process_family(process)
                with contextlib.suppress(subprocess.TimeoutExpired, OSError):
                    process.communicate(timeout=0.25)
                duration = time.monotonic() - started
                _durable_log_line(log, f"\nVALIDATION_TIMEOUT after {duration:.3f}s\n")
                return STATUS_TIMEOUT, None, duration
        except BaseException as error:
            if process is not None:
                terminate_process_family(process)
            duration = time.monotonic() - started
            _durable_log_line(
                log,
                f"\nVALIDATION_INTERRUPTED type={type(error).__name__} duration={duration:.3f}s\n",
            )
            raise
        duration = time.monotonic() - started
        status = STATUS_PASS if return_code == 0 else STATUS_FAIL
        _durable_log_line(
            log,
            f"\nVALIDATION_EXIT status={status} code={return_code} duration={duration:.3f}s\n",
        )
        return status, return_code, duration


def _new_summary(plan: Plan, root: Path, run_dir: Path, selected: set[str], fingerprint: str) -> dict[str, Any]:
    stages: list[dict[str, Any]] = []
    for stage in plan.stages:
        stages.append(
            {
                **stage.serializable(),
                "selected": stage.name in selected,
                "status": STATUS_PENDING if stage.name in selected else STATUS_NOT_RUN,
                "exitCode": None,
                "error": None,
                "durationSeconds": None,
                "startedAt": None,
                "finishedAt": None,
                "log": f"logs/{_safe_log_name(stage.name)}",
                "sideEffects": [],
                "resumed": False,
            }
        )
    return {
        "schemaVersion": SUMMARY_SCHEMA_VERSION,
        "plan": plan.name,
        "planDigest": plan.digest,
        "repositoryRoot": str(root),
        "repositoryHead": git_head(root),
        "repositoryFingerprint": fingerprint,
        "runDirectory": str(run_dir),
        "startedAt": utc_now(),
        "finishedAt": None,
        "outcome": "running",
        "interrupted": False,
        "resumeCount": 0,
        "runnerError": None,
        "stages": stages,
    }


def _load_resume_summary(path: Path) -> dict[str, Any]:
    summary_path = path / "summary.json" if path.is_dir() else path
    if not summary_path.is_file():
        raise ResumeRejected(f"Resume summary does not exist: {summary_path}")
    try:
        data = json.loads(summary_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as error:
        raise ResumeRejected(f"Cannot read resume summary: {error}") from error
    if not isinstance(data, dict):
        raise ResumeRejected("Resume summary root must be an object")
    return data


def _resolve_log_path(run_dir: Path, value: Any, stage_name: str) -> Path:
    if not isinstance(value, str) or not value:
        raise ResumeRejected(f"Resume stage {stage_name!r} has no valid log path")
    relative = Path(value)
    if relative.is_absolute():
        raise ResumeRejected(f"Resume stage {stage_name!r} has an absolute log path")
    resolved = (run_dir / relative).resolve()
    try:
        resolved.relative_to(run_dir.resolve())
    except ValueError as error:
        raise ResumeRejected(f"Resume stage {stage_name!r} log escapes the run directory") from error
    return resolved


def validate_resume_structure(summary: dict[str, Any], plan: Plan, run_dir: Path) -> None:
    if summary.get("schemaVersion") != SUMMARY_SCHEMA_VERSION:
        raise ResumeRejected(
            f"Unsupported resume schema: {summary.get('schemaVersion')!r}; expected {SUMMARY_SCHEMA_VERSION}"
        )
    if summary.get("plan") != plan.name:
        raise ResumeRejected(f"Resume plan name changed: saved={summary.get('plan')!r} current={plan.name!r}")
    records = summary.get("stages")
    if not isinstance(records, list):
        raise ResumeRejected("Resume summary has no valid stages list")
    if not all(isinstance(record, dict) for record in records):
        raise ResumeRejected("Resume stages must all be objects")
    expected_names = [stage.name for stage in plan.stages]
    actual_names = [record.get("name") for record in records]
    if actual_names != expected_names:
        raise ResumeRejected(f"Resume stage order changed: saved={actual_names!r} current={expected_names!r}")

    for record, stage in zip(records, plan.stages, strict=True):
        for key, expected in stage.serializable().items():
            if record.get(key) != expected:
                raise ResumeRejected(
                    f"Resume stage {stage.name!r} definition changed at {key}: "
                    f"saved={record.get(key)!r} current={expected!r}"
                )
        status = record.get("status")
        if status not in VALID_STATUSES:
            raise ResumeRejected(f"Resume stage {stage.name!r} has invalid status {status!r}")
        selected = record.get("selected")
        if not isinstance(selected, bool):
            raise ResumeRejected(f"Resume stage {stage.name!r} has no selection marker")
        if not selected and status != STATUS_NOT_RUN:
            raise ResumeRejected(f"Unselected resume stage {stage.name!r} must remain not-run")
        log_path = _resolve_log_path(run_dir, record.get("log"), stage.name)
        if status == STATUS_PASS:
            if record.get("exitCode") != 0 or record.get("error") is not None:
                raise ResumeRejected(f"Passed resume stage {stage.name!r} has inconsistent exit/error data")
            if record.get("sideEffects") not in ([], None):
                raise ResumeRejected(f"Passed resume stage {stage.name!r} contains side effects")
            if not log_path.is_file():
                raise ResumeRejected(f"Passed resume stage {stage.name!r} is missing its log: {log_path}")


def validate_resume(summary: dict[str, Any], plan: Plan, root: Path, run_dir: Path, fingerprint: str) -> None:
    validate_resume_structure(summary, plan, run_dir)
    expected = {
        "repositoryRoot": str(root),
        "repositoryHead": git_head(root),
        "repositoryFingerprint": fingerprint,
        "planDigest": plan.digest,
    }
    mismatches = [key for key, value in expected.items() if summary.get(key) != value]
    if mismatches:
        details = ", ".join(
            f"{key}: saved={summary.get(key)!r} current={expected[key]!r}" for key in mismatches
        )
        raise ResumeRejected(f"Resume rejected because validation identity changed ({details})")


def _default_run_dir(root: Path, plan_name: str) -> Path:
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%S.%fZ")
    return root / ".agent-validation" / f"{plan_name}-{stamp}-{os.getpid()}"


@contextlib.contextmanager
def _termination_signal_guard() -> Iterator[None]:
    """Convert controlled termination signals into KeyboardInterrupt for cleanup.

    SIGKILL and abrupt host loss cannot be intercepted; summaries remain non-pass in
    those cases, but process-family cleanup cannot be guaranteed.
    """

    if threading.current_thread() is not threading.main_thread():
        yield
        return

    previous: dict[int, Any] = {}

    def interrupt(signum: int, frame: Any) -> None:
        raise KeyboardInterrupt(f"received signal {signum}")

    candidates = [getattr(signal, name, None) for name in ("SIGTERM", "SIGHUP", "SIGBREAK")]
    for candidate in candidates:
        if candidate is None or candidate == signal.SIGINT:
            continue
        try:
            previous[candidate] = signal.getsignal(candidate)
            signal.signal(candidate, interrupt)
        except (OSError, RuntimeError, ValueError):
            previous.pop(candidate, None)
    try:
        yield
    finally:
        for candidate, handler in previous.items():
            try:
                signal.signal(candidate, handler)
            except (OSError, RuntimeError, ValueError):
                pass


def _persist_interruption(
    summary: dict[str, Any], summary_path: Path, events: EventLog, stage_name: str | None
) -> tuple[int, dict[str, Any]]:
    summary["outcome"] = "interrupted"
    summary["interrupted"] = True
    summary["finishedAt"] = utc_now()
    if stage_name is not None:
        record = next(record for record in summary["stages"] if record["name"] == stage_name)
        record["status"] = STATUS_PENDING
        record["error"] = "interrupted"
        record["finishedAt"] = utc_now()
    atomic_write_json(summary_path, summary)
    events.emit("run-interrupted", stage=stage_name)
    return 130, summary


def run_plan(
    plan: Plan,
    root: Path,
    *,
    only: Sequence[str] | None = None,
    from_stage: str | None = None,
    resume: Path | None = None,
    run_dir: Path | None = None,
) -> tuple[int, Path, dict[str, Any]]:
    root = root.resolve()
    selected = select_stages(plan, only, from_stage)
    if resume is not None and (only or from_stage):
        raise ValidationConfigurationError("--resume cannot be combined with --only or --from")

    if resume is not None:
        resolved_resume = resume.resolve()
        run_dir = resolved_resume if resolved_resume.is_dir() else resolved_resume.parent
    else:
        run_dir = (run_dir or _default_run_dir(root, plan.name)).resolve()
    run_dir.mkdir(parents=True, exist_ok=True)

    artifact_root = root / ".agent-validation"
    initial_snapshot = repository_snapshot(root, [run_dir, artifact_root])
    fingerprint = snapshot_digest(initial_snapshot)
    if resume is not None:
        summary = _load_resume_summary(resume)
        validate_resume(summary, plan, root, run_dir, fingerprint)
        summary["outcome"] = "running"
        summary["interrupted"] = False
        summary["finishedAt"] = None
        summary["runnerError"] = None
        summary["resumeCount"] = int(summary.get("resumeCount", 0)) + 1
        for record in summary["stages"]:
            if record["status"] == STATUS_PASS:
                record["resumed"] = True
            elif record["selected"]:
                record["status"] = STATUS_PENDING
                record["exitCode"] = None
                record["error"] = None
                record["durationSeconds"] = None
                record["startedAt"] = None
                record["finishedAt"] = None
                record["sideEffects"] = []
                record["resumed"] = False
            else:
                record["status"] = STATUS_NOT_RUN
    else:
        summary = _new_summary(plan, root, run_dir, selected, fingerprint)

    summary_path = run_dir / "summary.json"
    events_path = run_dir / "events.jsonl"
    atomic_write_json(summary_path, summary)

    records_by_name = {record["name"]: record for record in summary["stages"]}
    exit_code = 0
    active_stage: str | None = None
    with EventLog(events_path) as events, _termination_signal_guard():
        events.emit("run-started", plan=plan.name, planDigest=plan.digest, resumed=resume is not None)
        try:
            for stage in plan.stages:
                record = records_by_name[stage.name]
                if record["status"] in (STATUS_PASS, STATUS_NOT_RUN):
                    events.emit("stage-skipped", stage=stage.name, status=record["status"])
                    continue
                active_stage = stage.name
                before = repository_snapshot(root, [run_dir, artifact_root])
                record["status"] = STATUS_PENDING
                record["startedAt"] = utc_now()
                record["error"] = None
                atomic_write_json(summary_path, summary)
                resolved_command = _resolve_stage_command(stage, root, run_dir)
                events.emit("stage-started", stage=stage.name, command=list(resolved_command), timeout=stage.timeout_seconds)
                stage_clock = time.monotonic()
                error_message = None
                try:
                    status, return_code, duration = run_stage(
                        stage, root, run_dir / record["log"], command=resolved_command
                    )
                except KeyboardInterrupt:
                    code, interrupted = _persist_interruption(summary, summary_path, events, stage.name)
                    return code, run_dir, interrupted
                except Exception as error:
                    duration = time.monotonic() - stage_clock
                    status = STATUS_FAIL
                    return_code = None
                    error_message = f"{type(error).__name__}: {error}"
                    log_path = run_dir / record["log"]
                    log_path.parent.mkdir(parents=True, exist_ok=True)
                    with log_path.open("a", encoding="utf-8", newline="\n") as log:
                        _durable_log_line(log, f"\nVALIDATION_RUNNER_ERROR {error_message}\n")
                after = repository_snapshot(root, [run_dir, artifact_root])
                side_effects = changed_paths(before, after)
                if side_effects and status == STATUS_PASS:
                    status = STATUS_FAIL
                    return_code = return_code if return_code not in (None, 0) else 97
                record.update(
                    {
                        "status": status,
                        "exitCode": return_code,
                        "error": error_message,
                        "durationSeconds": round(duration, 6),
                        "finishedAt": utc_now(),
                        "sideEffects": side_effects,
                    }
                )
                events.emit(
                    "stage-finished",
                    stage=stage.name,
                    status=status,
                    exitCode=return_code,
                    error=error_message,
                    durationSeconds=round(duration, 6),
                    sideEffects=side_effects,
                )
                atomic_write_json(summary_path, summary)
                active_stage = None
                if status != STATUS_PASS:
                    exit_code = 1
                    break
        except KeyboardInterrupt:
            code, interrupted = _persist_interruption(summary, summary_path, events, active_stage)
            return code, run_dir, interrupted
        except Exception as error:
            error_message = f"{type(error).__name__}: {error}"
            summary["runnerError"] = error_message
            summary["outcome"] = "fail"
            summary["finishedAt"] = utc_now()
            if active_stage is not None:
                record = records_by_name[active_stage]
                record["status"] = STATUS_FAIL
                record["error"] = error_message
                record["finishedAt"] = utc_now()
            atomic_write_json(summary_path, summary)
            events.emit("run-error", stage=active_stage, error=error_message)
            return 1, run_dir, summary

        for record in summary["stages"]:
            if record["status"] == STATUS_PENDING:
                record["status"] = STATUS_NOT_RUN
        summary["finishedAt"] = utc_now()
        summary["outcome"] = "pass" if exit_code == 0 else "fail"
        atomic_write_json(summary_path, summary)
        events.emit("run-finished", outcome=summary["outcome"], exitCode=exit_code)
    return exit_code, run_dir, summary


def _parse_only(value: str | None) -> list[str] | None:
    if value is None:
        return None
    names = [item.strip() for item in value.split(",") if item.strip()]
    if not names:
        raise ValidationConfigurationError("--only requires at least one stage name")
    return names


def print_plan(plan: Plan) -> None:
    print(f"Plan: {plan.name} ({plan.digest})")
    for stage in plan.stages:
        print(f"- {stage.name:28} timeout={stage.timeout_seconds:g}s  {' '.join(stage.command)}")


def cli(plan: Plan, root: Path) -> int:
    parser = argparse.ArgumentParser(description=f"Run the {plan.name} validation plan")
    parser.add_argument("--only", metavar="NAMES", help="comma-separated stage names")
    parser.add_argument("--from", dest="from_stage", metavar="NAME", help="run NAME and every later stage")
    parser.add_argument("--resume", type=Path, metavar="RUN_DIR", help="resume an interrupted/failed run directory")
    parser.add_argument("--list", action="store_true", help="list stages without running them")
    parser.add_argument("--artifacts-dir", type=Path, metavar="PATH", help="explicit run artifact directory")
    args = parser.parse_args()
    try:
        if args.list:
            print_plan(plan)
            return 0
        code, run_dir, summary = run_plan(
            plan,
            root,
            only=_parse_only(args.only),
            from_stage=args.from_stage,
            resume=args.resume,
            run_dir=args.artifacts_dir,
        )
    except (ValidationConfigurationError, ResumeRejected) as error:
        parser.error(str(error))
    print(f"Validation outcome: {summary['outcome']}")
    print(f"Artifacts: {run_dir}")
    for record in summary["stages"]:
        duration = record["durationSeconds"]
        suffix = "" if duration is None else f" ({duration:.3f}s)"
        print(f"  {record['status']:8} {record['name']}{suffix}")
        for side_effect in record["sideEffects"]:
            print(f"           side-effect {side_effect['kind']}: {side_effect['path']}")
    return code
