@echo off
rem Edit these two lines, then double-click this file (or put a shortcut to it in shell:startup).
set PAVA_ALLOWED_ORIGINS=https://pava.mizzenmast.dev
set PAVA_PRINTER=
node "%~dp0pava-print-helper.mjs"
pause
