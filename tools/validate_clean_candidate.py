#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
AGENT_VALIDATION_DIR = ROOT / '.agent-validation'
DEFAULT_COMMAND = ('node', 'tools/run_with_python_env.js', 'python', 'tools/validate_full.py')
PROTECTED_DIR_PREFIXES = ('assets/visual_packs/local_working_visuals/',)
PROTECTED_FILES = ('assets/visual_packs/installed_visual_packs.json',)


def normalize_repo_path(path: str) -> str:
    return path.replace('\\', '/').strip()


def is_protected_path(path: str) -> bool:
    normalized = normalize_repo_path(path)
    return normalized in PROTECTED_FILES or any(normalized.startswith(prefix) for prefix in PROTECTED_DIR_PREFIXES)


def git_command(*args: str) -> list[str]:
    return [
        'git',
        '-c', f'safe.directory={ROOT.as_posix()}',
        '-c', f'safe.directory={(ROOT / ".git").as_posix()}',
        *args,
    ]


def run_capture(command: list[str], *, cwd: Path = ROOT, text: bool = True) -> subprocess.CompletedProcess:
    return subprocess.run(command, cwd=cwd, check=False, stdout=subprocess.PIPE, stderr=subprocess.PIPE, text=text)


def run_checked(command: list[str], *, cwd: Path = ROOT) -> subprocess.CompletedProcess:
    result = run_capture(command, cwd=cwd)
    if result.returncode != 0:
        raise RuntimeError(
            f"command failed ({result.returncode}): {' '.join(command)}\n"
            f"stdout:\n{result.stdout}\nstderr:\n{result.stderr}"
        )
    return result


def changed_paths(*git_args: str) -> list[str]:
    result = run_checked(git_command(*git_args))
    return [normalize_repo_path(line) for line in result.stdout.splitlines() if line.strip()]


def root_dirty_paths() -> tuple[list[str], list[str]]:
    paths = set(changed_paths('diff', '--name-only'))
    paths.update(changed_paths('ls-files', '--others', '--exclude-standard'))
    filtered = sorted(path for path in paths if path and not path.startswith('.agent-validation/'))
    protected = [path for path in filtered if is_protected_path(path)]
    other = [path for path in filtered if not is_protected_path(path)]
    return protected, other


def staged_patch_bytes() -> bytes:
    result = run_capture(git_command('diff', '--cached', '--binary'), text=False)
    if result.returncode != 0:
        stderr = result.stderr.decode('utf-8', errors='replace') if isinstance(result.stderr, bytes) else str(result.stderr)
        raise RuntimeError(f'failed to read staged diff: {stderr}')
    return result.stdout or b''


def unique_candidate_dir(label: str) -> Path:
    timestamp = datetime.now(timezone.utc).strftime('%Y%m%dT%H%M%SZ')
    stem = ''.join(ch if ch.isalnum() or ch in ('-', '_') else '-' for ch in label).strip('-') or 'candidate'
    base = AGENT_VALIDATION_DIR / f'clean-candidate-{timestamp}-{stem}'
    candidate = base
    suffix = 1
    while candidate.exists():
        suffix += 1
        candidate = Path(f'{base}-{suffix}')
    return candidate


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description='Validate a clean staged/HEAD candidate without copying protected dirty visual-pack work.'
    )
    parser.add_argument(
        '--name',
        default='validate-full',
        help='Label used for the .agent-validation candidate directory.',
    )
    parser.add_argument(
        '--head-only',
        action='store_true',
        help='Ignore staged changes and validate HEAD only.',
    )
    parser.add_argument(
        '--allow-unstaged',
        action='store_true',
        help='Allow non-protected unstaged/untracked paths; normally this is a candidate mismatch.',
    )
    parser.add_argument(
        'command',
        nargs=argparse.REMAINDER,
        help='Optional validation command after --. Defaults to bundled validate_full.py.',
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    command = list(args.command)
    if command and command[0] == '--':
        command = command[1:]
    if not command:
        command = list(DEFAULT_COMMAND)

    protected_dirty, other_dirty = root_dirty_paths()
    if other_dirty and not args.allow_unstaged:
        print(json.dumps({
            'status': 'REFUSED',
            'reason': 'non-protected unstaged or untracked paths would not be part of the clean candidate',
            'nonProtectedDirty': other_dirty,
            'protectedRootDirty': protected_dirty,
            'hint': 'stage the intended candidate or rerun with --allow-unstaged when validating HEAD intentionally',
        }, indent=2), file=sys.stderr)
        return 2

    patch = b'' if args.head_only else staged_patch_bytes()
    has_staged_patch = bool(patch.strip())
    candidate_dir = unique_candidate_dir(args.name)
    AGENT_VALIDATION_DIR.mkdir(parents=True, exist_ok=True)

    clone_command = git_command(
        '-c', 'core.autocrlf=false',
        '-c', 'core.longpaths=true',
        'clone', '--no-hardlinks', str(ROOT), str(candidate_dir),
    )
    run_checked(clone_command)
    run_checked(git_command('-C', str(candidate_dir), 'config', 'core.autocrlf', 'false'))
    run_checked(git_command('-C', str(candidate_dir), 'config', 'core.longpaths', 'true'))

    patch_path = None
    if has_staged_patch:
        patch_path = candidate_dir.parent / f'{candidate_dir.name}.staged.patch'
        patch_path.write_bytes(patch)
        run_checked(git_command('-C', str(candidate_dir), 'apply', '--whitespace=nowarn', str(patch_path)))

    print(json.dumps({
        'status': 'RUNNING',
        'candidateDir': str(candidate_dir),
        'appliedStagedPatch': has_staged_patch,
        'protectedRootDirty': protected_dirty,
        'command': command,
    }, indent=2), flush=True)

    result = subprocess.run(command, cwd=candidate_dir, check=False)
    summary = {
        'status': 'PASS' if result.returncode == 0 else 'FAIL',
        'candidateDir': str(candidate_dir),
        'appliedStagedPatch': has_staged_patch,
        'patchFile': str(patch_path) if patch_path else None,
        'protectedRootDirty': protected_dirty,
        'ignoredNonProtectedDirty': other_dirty if args.allow_unstaged else [],
        'command': command,
        'returnCode': result.returncode,
    }
    print(json.dumps(summary, indent=2))
    return result.returncode


if __name__ == '__main__':
    sys.exit(main())
