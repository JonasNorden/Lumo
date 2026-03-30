@echo off
setlocal

echo Converting files to OGG...
echo.

:loop
if "%~1"=="" goto done

echo Processing: %~1
ffmpeg -i "%~1" -c:a libvorbis -qscale:a 5 "%~dpn1.ogg"

shift
goto loop

:done
echo.
echo Done!
pause
