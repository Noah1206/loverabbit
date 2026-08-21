@echo off
REM Weekly content review by a headless Claude worker.
REM Windows Task Scheduler runs this - it survives Claude sessions closing.
REM ASCII only - Korean breaks cmd parsing (CP949).
setlocal
chcp 65001 > nul
set PYTHONUTF8=1
cd /d "%~dp0"
set LOG=%~dp0worker\worker.log

echo ==== %DATE% %TIME% weekly-review ==== >> "%LOG%"

REM The worker needs to read files and run npm - give it those, nothing else.
REM It must not approve or publish; worker\weekly-review.md spells that out.
type "worker\weekly-review.md" | claude -p ^
  --model sonnet ^
  --permission-mode acceptEdits ^
  --allowed-tools "Read,Write,Edit,Glob,Grep,Bash(npm run *)" ^
  >> "%LOG%" 2>&1

echo ==== done ==== >> "%LOG%"
exit /b %ERRORLEVEL%
