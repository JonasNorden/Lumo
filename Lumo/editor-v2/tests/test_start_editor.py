"""Real Windows batch/server smoke tests; Python standard library only."""
from pathlib import Path
import os
import queue
import socket
import subprocess
import sys
import tempfile
import threading
import unittest
import urllib.request

ROOT = Path(__file__).resolve().parents[2]


class LauncherTests(unittest.TestCase):
    def start(self, port, env=None):
        if os.name == 'nt':
            command = f'"{os.environ["COMSPEC"]}" /d /s /c ""{ROOT / "Start-Lumo-Editor-V2.bat"}" --no-browser --port {port}"'
        else:
            command = [sys.executable, str(ROOT / 'editor-v2/dev/start_editor.py'), '--no-browser', '--port', str(port)]
        process = subprocess.Popen(command, cwd=tempfile.gettempdir(), stdin=subprocess.PIPE,
                                   stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, env=env)
        self.addCleanup(self.stop, process)
        lines = queue.Queue()
        def read():
            for line in process.stdout:
                lines.put(line)
            lines.put(None)
        threading.Thread(target=read, daemon=True).start()
        output = []
        while True:
            line = lines.get(timeout=15)
            if line is None:
                self.fail(f'Launcher exited before readiness: {"".join(output)}')
            output.append(line)
            if 'ready: http://' in line:
                return process, line.split('ready: ', 1)[1].strip(), ''.join(output)

    @staticmethod
    def stop(process):
        if process.poll() is None:
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(process.pid), '/T', '/F'], capture_output=True)
            else:
                process.terminate()
            process.wait(timeout=10)
        process.stdin.close()
        process.stdout.close()

    def test_batch_starts_from_unrelated_directory(self):
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        _, url, _ = self.start(port)
        self.assertEqual(url, f'http://127.0.0.1:{port}/editor-v2/')
        with urllib.request.urlopen(url, timeout=5) as response:
            self.assertEqual(response.status, 200)
            self.assertIn(b'Play From Here', response.read())
        with urllib.request.urlopen(url.replace('editor-v2/', 'Lumo.html'), timeout=5) as response:
            self.assertEqual(response.status, 200)

    def test_occupied_port_chooses_next_and_explains(self):
        with socket.socket() as occupied:
            occupied.bind(('127.0.0.1', 0))
            occupied.listen()
            port = occupied.getsockname()[1]
            _, url, output = self.start(port)
            self.assertIn(f'Port {port} unavailable', output)
            self.assertNotIn(f':{port}/', url)
            with urllib.request.urlopen(url, timeout=5) as response:
                self.assertEqual(response.status, 200)

    def test_invalid_port_is_clear_failure(self):
        result = subprocess.run([sys.executable, str(ROOT / 'editor-v2/dev/start_editor.py'), '--port', '0'],
                                capture_output=True, text=True, timeout=10)
        self.assertNotEqual(result.returncode, 0)
        self.assertIn('between 1 and 65535', result.stderr)

    @unittest.skipUnless(os.name == 'nt', 'Windows Python launcher fallback')
    def test_unusable_py_launcher_falls_back_to_python(self):
        with tempfile.TemporaryDirectory() as directory:
            Path(directory, 'py.bat').write_text('@exit /b 1\n')
            env = dict(os.environ, PATH=os.pathsep.join([directory, str(Path(sys.executable).parent), str(Path(os.environ['SystemRoot']) / 'System32')]))
            with socket.socket() as probe:
                probe.bind(('127.0.0.1', 0))
                port = probe.getsockname()[1]
            _, url, _ = self.start(port, env)
            with urllib.request.urlopen(url, timeout=5) as response:
                self.assertEqual(response.status, 200)

    @unittest.skipUnless(os.name == 'nt', 'Windows PATH and batch behavior')
    def test_batch_reports_missing_python(self):
        env = dict(os.environ, PATH=str(Path(os.environ['SystemRoot']) / 'System32'))
        command = f'"{os.environ["COMSPEC"]}" /d /s /c ""{ROOT / "Start-Lumo-Editor-V2.bat"}""'
        result = subprocess.run(command,
                                cwd=tempfile.gettempdir(), env=env, input='\n', capture_output=True, text=True, timeout=10)
        self.assertEqual(result.returncode, 1)
        self.assertIn('Python 3 was not found', result.stdout)


if __name__ == '__main__':
    unittest.main()
