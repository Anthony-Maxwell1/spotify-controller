@echo off
setlocal enabledelayedexpansion

echo [0/5] Checking dependencies...

where spicetify >nul 2>&1
if errorlevel 1 (
    echo Error: spicetify is not installed or not in PATH.
    exit /b 1
)

where openssl >nul 2>&1
if errorlevel 1 (
    echo Error: openssl is not installed or not in PATH.
    exit /b 1
)

:: Resolve base dir (script location)
set BASE_DIR=%~dp0
cd /d "%BASE_DIR%"

:: Normalize paths
for %%i in ("%BASE_DIR%..") do set ROOT_DIR=%%~fi

set CNF=%ROOT_DIR%\localhost.cnf
set KEY=%ROOT_DIR%\key.pem
set CERT=%ROOT_DIR%\cert.pem
set MAIN=%ROOT_DIR%\main.py
set CONTROLLER=%ROOT_DIR%\controller.js

echo [1/5] Generating key and certificate...
openssl req -x509 -nodes -days 365 ^
 -newkey rsa:2048 ^
 -keyout "%KEY%" ^
 -out "%CERT%" ^
 -config "%CNF%"

echo [2/5] Installing certificate (Windows trust store)...

powershell -Command "Import-Certificate -FilePath '%CERT%' -CertStoreLocation Cert:\LocalMachine\Root" >nul 2>&1
if errorlevel 1 (
    echo Warning: Certificate install failed (try running as Administrator)
)

echo [3/5] Adding to startup...

set STARTUP=%APPDATA%\Microsoft\Windows\Start Menu\Programs\Startup

:: Create a launcher script
set LAUNCHER=%STARTUP%\deskos_runner.bat

echo @echo off > "%LAUNCHER%"
echo cd /d "%ROOT_DIR%" >> "%LAUNCHER%"
echo python "%MAIN%" >> "%LAUNCHER%"

echo Startup script created at:
echo %LAUNCHER%

echo [4/5] Running once now...
start "" python "%MAIN%"

echo [5/5] Configuring Spicetify...

for /f "delims=" %%i in ('spicetify -c') do set SPICETIFY_CONF=%%i

for %%i in ("%SPICETIFY_CONF%") do set SPICETIFY_DIR=%%~dpi

set EXT_DIR=%SPICETIFY_DIR%Extensions

if not exist "%EXT_DIR%" mkdir "%EXT_DIR%"

copy "%CONTROLLER%" "%EXT_DIR%\controller.js" >nul

spicetify config extensions controller.js

echo Done, run "spicetify apply" to apply the changes.