@echo off
setlocal enableextensions

set "APP_DIR=%~dp0"
cd /d "%APP_DIR%"

set "ELECTRON_EXE=%APP_DIR%node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
	echo [INFO] Electron runtime not found. Installing dependencies...

	where npm >nul 2>nul
	if errorlevel 1 (
		echo [ERROR] npm is not available on this computer.
		echo Install Node.js LTS once, then run this file again.
		pause
		exit /b 1
	)

	call npm install --no-audit --no-fund
	if errorlevel 1 (
		echo [ERROR] Dependency installation failed.
		pause
		exit /b 1
	)
)

if not exist "%ELECTRON_EXE%" (
	echo [ERROR] Could not find Electron executable after install.
	pause
	exit /b 1
)

start "Pair Generation" "%ELECTRON_EXE%" .
exit /b 0
