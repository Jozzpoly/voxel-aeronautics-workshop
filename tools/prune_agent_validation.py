from __future__ import annotations

import argparse
import json
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
VALIDATION_DIR = ROOT / '.agent-validation'


def artifact_group(path: Path) -> str:
    if '-' not in path.name:
        return 'misc'
    return path.name.split('-', 1)[0]


def directory_size(path: Path) -> int:
    total = 0
    for child in path.rglob('*'):
        if child.is_symlink():
            continue
        if child.is_file():
            total += child.stat().st_size
    return total


def collect_candidates(keep: int) -> list[Path]:
    if not VALIDATION_DIR.exists():
        return []
    groups: dict[str, list[Path]] = {}
    for child in VALIDATION_DIR.iterdir():
        if not child.is_dir() or child.is_symlink():
            continue
        groups.setdefault(artifact_group(child), []).append(child)

    candidates: list[Path] = []
    for paths in groups.values():
        paths.sort(key=lambda path: path.stat().st_mtime, reverse=True)
        candidates.extend(paths[keep:])
    candidates.sort(key=lambda path: (artifact_group(path), path.stat().st_mtime))
    return candidates


def main() -> int:
    parser = argparse.ArgumentParser(
        description='Dry-run first pruning helper for .agent-validation artifacts.'
    )
    parser.add_argument(
        '--keep',
        type=int,
        default=5,
        help='Number of newest artifact directories to keep per validation group.',
    )
    parser.add_argument(
        '--apply',
        action='store_true',
        help='Actually delete candidates. Without this flag the command is a dry run.',
    )
    args = parser.parse_args()
    if args.keep < 0:
        parser.error('--keep must be zero or greater')

    candidates = collect_candidates(args.keep)
    report = {
        'target': str(VALIDATION_DIR),
        'mode': 'apply' if args.apply else 'dry-run',
        'keepPerGroup': args.keep,
        'candidateCount': len(candidates),
        'candidateBytes': sum(directory_size(path) for path in candidates),
        'candidates': [path.relative_to(ROOT).as_posix() for path in candidates],
        'removed': [],
    }

    if args.apply:
        for path in candidates:
            shutil.rmtree(path)
            report['removed'].append(path.relative_to(ROOT).as_posix())

    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
