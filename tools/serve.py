#!/usr/bin/env python3
from __future__ import annotations

import argparse
import functools
import http.server
import socketserver
import threading
import webbrowser
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    parser = argparse.ArgumentParser(description='Serve the workshop from a local development server.')
    parser.add_argument('--port', type=int, default=8765)
    parser.add_argument('--no-browser', action='store_true')
    args = parser.parse_args()

    handler = functools.partial(http.server.SimpleHTTPRequestHandler, directory=ROOT)
    with socketserver.TCPServer(('127.0.0.1', args.port), handler) as server:
        url = f'http://127.0.0.1:{args.port}/index.html'
        print(f'Voxel Aeronautics Workshop: {url}')
        print('Press Ctrl+C to stop the server.')
        if not args.no_browser:
            threading.Timer(0.35, lambda: webbrowser.open(url)).start()
        try:
            server.serve_forever()
        except KeyboardInterrupt:
            print('\nServer stopped.')


if __name__ == '__main__':
    main()
