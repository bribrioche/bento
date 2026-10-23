@echo off
setlocal
cd /d "%~dp0"
where npm >nul 2>nul || (
  echo Node.js and npm are required. Install Node.js 20 or newer, then try again.
  pause
  exit /b 1
)
if not exist "bento\node_modules" call npm run setup || goto :error
call npm run dev
exit /b %errorlevel%
:error
echo.
echo Bento could not install its development dependencies.
pause
exit /b 1
