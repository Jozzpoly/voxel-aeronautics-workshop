#!/usr/bin/env python3
from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
CSS = (ROOT / 'styles.css').read_text(encoding='utf-8')


def require(pattern: str, description: str, flags: int = re.S) -> None:
    assert re.search(pattern, CSS, flags), f'Missing mobile workspace CSS contract: {description}'


def main() -> None:
    scope = r'html\[data-vaw-presentation=["\']mobile["\']\]'
    require(scope, 'mobile presentation scope')
    require(scope + r'\s*\{[^}]*--vaw-mobile-toolbar-height:', 'mobile toolbar sizing variables')
    require(scope + r'[^}]*height:\s*var\(--vaw-viewport-height,\s*100dvh\)', 'dynamic viewport height')

    for inset in ('top', 'right', 'bottom', 'left'):
        require(r'env\(safe-area-inset-' + inset + r'\)', f'safe-area {inset}')

    require(scope + r'[^}]*overflow:\s*hidden', 'mobile root overflow containment')
    require(scope + r'[^}]*body\s*\{[^}]*overflow:\s*hidden', 'mobile body overflow containment')
    require(scope + r'[^}]*\.workspace-toolbar\s*\{[^}]*overflow-x:\s*auto', 'horizontally scrollable primary toolbar')
    require(scope + r'[^}]*\.workspace-layout-actions\s*\{[^}]*overflow-x:\s*auto', 'reachable horizontally scrollable secondary actions')
    require(scope + r'[^}]*\.workspace-tab\s*\{[^}]*min-height:\s*44px', '44px toolbar touch target height')
    require(scope + r'[^}]*\.workspace-tab\s*\{[^}]*min-width:\s*44px', '44px toolbar touch target width')

    require(r'data-vaw-mobile-sheet=["\']true["\'][^\{]*\{[^}]*display:\s*none\s*!important', 'inactive mobile sheets hidden')
    require(r'data-vaw-mobile-sheet=["\']true["\'][^\]]*data-vaw-mobile-active=["\']true["\'][^\]]*data-vaw-mobile-available=["\']true["\'][^\{]*\{[^}]*display:\s*flex\s*!important', 'single active mobile sheet shown')
    require(r'data-vaw-mobile-parts-open=["\']true["\'][^\{]*data-vaw-mobile-sheet=["\']true["\'][^\{]*bottom:\s*calc\(', 'sheet offset above open parts tray')
    require(r'data-vaw-mobile-tray=["\']true["\'][^\{]*\{[^}]*display:\s*none\s*!important', 'closed parts tray hidden')
    require(r'data-vaw-mobile-tray=["\']true["\'][^\]]*data-vaw-mobile-open=["\']true["\'][^\]]*data-vaw-mobile-available=["\']true["\'][^\{]*\{[^}]*display:\s*flex\s*!important', 'open parts tray shown')
    require(scope + r'[^}]*\.parts-hotbar-scroll\s*\{[^}]*overflow-x:\s*auto', 'horizontal parts tray scrolling')
    require(scope + r'[^}]*\.hotbar-tool-btn\s*\{[^}]*min-height:\s*44px', 'parts tray touch targets')

    require(r'@media\s*\([^)]*orientation:\s*landscape[^)]*\)[^{]*\{.*?' + scope + r'[^}]*data-vaw-mobile-sheet=["\']true["\'][^\{]*\{[^}]*width:\s*min\(46vw,\s*420px\)', 'bounded landscape side sheet')
    require(r'@media\s*\([^)]*orientation:\s*landscape[^)]*\)[^{]*\{.*?' + scope + r'[^}]*data-vaw-mobile-sheet=["\']true["\'][^\{]*right:\s*env\(safe-area-inset-right\)', 'landscape sheet right alignment')

    global_touch_action = re.compile(r'(^|\})\s*(canvas|body|html|\*)[^\{]*\{[^}]*touch-action:\s*none', re.M | re.S)
    assert not global_touch_action.search(CSS), 'MT1 must not disable browser gestures globally'

    print('OK mobile workspace CSS contract')


if __name__ == '__main__':
    main()
