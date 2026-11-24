"""Loopback-only Editor V2 launcher; Python standard library, no installation."""
import argparse
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import threading
import urllib.request
import webbrowser


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--port', type=int, default=4173)
    parser.add_argument('--no-browser', action='store_true', help='Serve without opening a browser')
    args = parser.parse_args()
    if not 1 <= args.port <= 65535:
        parser.error('port must be between 1 and 65535')
    root = Path(__file__).resolve().parents[2]
    handler = partial(SimpleHTTPRequestHandler, directory=str(root))
    server = None
    # Binding, not probing, reserves the chosen port without a race.
    for port in range(args.port, min(args.port + 20, 65536)):
        try:
            server = ThreadingHTTPServer(('127.0.0.1', port), handler)
            break
        except OSError as error:
            print(f'Port {port} unavailable: {error}. Trying next port.', flush=True)
    if server is None:
        print('ERROR: No available local port. Close another server or use --port 8080.', flush=True)
        return 1
    url = f'http://127.0.0.1:{server.server_port}/editor-v2/'
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()
    try:
        with urllib.request.urlopen(url, timeout=5) as response:
            if response.status != 200:
                raise RuntimeError(f'HTTP {response.status}')
        print(f'Lumo Editor V2 ready: {url}', flush=True)
        print('Keep this window open. Press Ctrl+C to stop.', flush=True)
        if not args.no_browser:
            if not webbrowser.open(url):
                print(f'Browser could not open automatically. Open {url}', flush=True)
        thread.join()
    except KeyboardInterrupt:
        print('\nStopping Lumo server.', flush=True)
    except Exception as error:
        print(f'ERROR: Server readiness failed: {error}', flush=True)
        return 1
    finally:
        server.shutdown()
        server.server_close()
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
