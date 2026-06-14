@echo off
chcp 65001 >nul
title 世界之心 — 桌面版打包运行
color 0b

echo ============================================================
echo   《世界之心》桌面应用打包运行（Electron）
echo ============================================================
echo.

where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js！请先安装：https://nodejs.org/
    pause
    exit /b 1
)

if not exist "node_modules" (
    echo [首次运行] 安装依赖中...
    call npm install
)

echo 正在打包并启动桌面应用（首次较慢）...
echo.
call npm run electron

pause
