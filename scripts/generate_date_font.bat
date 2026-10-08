@echo off
setlocal
cd /d "%~dp0.."
echo.
echo === MAX7219 Georgian Date Font Generator ===
echo Source: fonts\max7219.ttf
echo.
python scripts\generate_date_font.py
set "RESULT=%ERRORLEVEL%"
echo.
if not "%RESULT%"=="0" (
  echo Date font generation FAILED. Read the log above, fix the font, then try again.
) else (
  echo Date font generation completed successfully.
  echo Updated firmware and configurator date-font tables are ready to commit.
)
echo.
echo Press any key to close this window.
pause >nul
exit /b %RESULT%
