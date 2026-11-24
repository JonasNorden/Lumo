@echo off
setlocal
cd /d "%~dp0"
call py -3 --version >nul 2>nul
if not errorlevel 1 (
  call py -3 "%~dp0editor-v2\dev\start_editor.py" %*
  goto done
)
call python --version >nul 2>nul
if not errorlevel 1 (
  call python "%~dp0editor-v2\dev\start_editor.py" %*
  goto done
)
echo ERROR: Python 3 was not found. Install Python or enable py/python on PATH.
pause
exit /b 1
:done
if errorlevel 1 (
  echo ERROR: Lumo Editor server could not start. See the message above.
  pause
  exit /b 1
)
