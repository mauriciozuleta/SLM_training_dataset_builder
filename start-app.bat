@echo off
setlocal enableextensions enabledelayedexpansion

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"
cd /d "%APP_DIR%"
set "LOG_FILE=%APP_DIR%\start-app.log"
echo [%date% %time%] Launcher started>"%LOG_FILE%"
set "PAIRGEN_PYTHON=%APP_DIR%\..\AI_FRESH24\.venv310\Scripts\python.exe"

if exist "%PAIRGEN_PYTHON%" (
	echo [%date% %time%] Using forced Python: "%PAIRGEN_PYTHON%">>"%LOG_FILE%"
) else (
	echo [%date% %time%] Forced Python not found, fallback launchers will be used.>>"%LOG_FILE%"
)

set "ELECTRON_EXE=%APP_DIR%\node_modules\electron\dist\electron.exe"

if not exist "%ELECTRON_EXE%" (
	echo [INFO] Electron runtime not found. Installing dependencies...
	echo [%date% %time%] Electron runtime missing. Installing dependencies...>>"%LOG_FILE%"

	where npm >nul 2>nul
	if errorlevel 1 (
		echo [ERROR] npm is not available on this computer.
		echo Install Node.js LTS once, then run this file again.
		echo [%date% %time%] npm not found in PATH.>>"%LOG_FILE%"
		if /I not "%~1"=="--from-vbs" pause
		exit /b 1
	)

	call npm install --no-audit --no-fund >>"%LOG_FILE%" 2>&1
	if errorlevel 1 (
		echo [ERROR] Dependency installation failed.
		echo [%date% %time%] npm install failed.>>"%LOG_FILE%"
		if /I not "%~1"=="--from-vbs" pause
		exit /b 1
	)
)

if not exist "%ELECTRON_EXE%" (
	echo [ERROR] Could not find Electron executable after install.
	echo [%date% %time%] electron.exe still missing after install.>>"%LOG_FILE%"
	if /I not "%~1"=="--from-vbs" pause
	exit /b 1
)

echo [%date% %time%] Launching Electron: "%ELECTRON_EXE%" "%APP_DIR%">>"%LOG_FILE%"
start "Pair Generation" /D "%APP_DIR%" "%ELECTRON_EXE%" .
set "APP_EXIT=!ERRORLEVEL!"
echo [%date% %time%] START command exit code: !APP_EXIT!>>"%LOG_FILE%"

if not "!APP_EXIT!"=="0" (
	echo [ERROR] Application failed to start. See start-app.log
	if /I not "%~1"=="--from-vbs" pause
	exit /b !APP_EXIT!
)

exit /b 0
