#!/usr/bin/env python3
from __future__ import annotations
import argparse
import http.server
import socketserver
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_PORT = 8080

class ReusableTCPServer(socketserver.TCPServer):
    allow_reuse_address = True

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=str(ROOT), **kwargs)

    def end_headers(self):
        self.send_header('Cache-Control', 'no-store')
        super().end_headers()

def main() -> int:
    parser = argparse.ArgumentParser(description='Serve VAW Blockbench Import Studio locally.')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=DEFAULT_PORT)
    args = parser.parse_args()
    with ReusableTCPServer((args.host, args.port), Handler) as httpd:
        print(f'VAW Import Studio serving http://{args.host}:{args.port}/index.html', flush=True)
        print(f'V1 preview smoke URL: http://{args.host}:{args.port}/index.html?sample=visual', flush=True)
        httpd.serve_forever()
    return 0

if __name__ == '__main__':
    raise SystemExit(main())
