@echo off
echo Starting Payanam Development Servers...
echo.

echo Starting Backend (port 3001)...
start "Payanam API" cmd /k "cd apps\api && npm run dev"

timeout /t 3 /nobreak >nul

echo Starting Frontend (port 5173)...
start "Payanam Web" cmd /k "cd apps\web && npm run dev"

echo.
echo Both servers starting!
echo Backend:  http://localhost:3001/api/health
echo Frontend: http://localhost:5173
echo.
echo Keep both windows open while developing.
pause
