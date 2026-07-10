#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
BOOTSTRAP = (ROOT / 'src/foundation/bootstrap.js').read_text(encoding='utf-8')


def main() -> None:
    required = (
        'const mobileProfileListeners = new Set();',
        'function notifyMobileProfileListener(listener, profile)',
        'function publishMobileProfile(profile)',
        'onProfileChanged: publishMobileProfile',
        'mobileProfileListeners.add(listener);',
        'const current = mobileShell?.current?.() || null;',
        'if (current) notifyMobileProfileListener(listener, current);',
        'return () => mobileProfileListeners.delete(listener);',
    )
    for token in required:
        assert token in BOOTSTRAP, f'Mobile profile context contract missing {token!r}'

    forbidden = (
        'mobileShell?.subscribe?.(',
        'mobileShell.subscribe(',
    )
    for token in forbidden:
        assert token not in BOOTSTRAP, f'Mobile context must not delegate to absent shell subscription API: {token!r}'

    assert BOOTSTRAP.index('const mobileProfileListeners = new Set();') < BOOTSTRAP.index('mobileShell = MobileRuntimeShell.create({')
    assert BOOTSTRAP.index('onProfileChanged: publishMobileProfile') < BOOTSTRAP.index('initialMobileProfile = mobileShell.initialize();')

    print('OK mobile profile context contract')


if __name__ == '__main__':
    main()
