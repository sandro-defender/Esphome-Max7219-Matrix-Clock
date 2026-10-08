@echo off
setlocal
cd /d "%~dp0.."
python scripts\generate_date_font.py
if errorlevel 1 pause
