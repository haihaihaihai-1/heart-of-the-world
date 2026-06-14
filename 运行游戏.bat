@echo off
chcp 65001 >nul
title 世界之心 — Heart of the World
color 0a

echo ============================================================
echo   《世界之心》— Minecraft 风格 3D 冒险游戏
echo ============================================================
echo.

REM 检查 Node.js 是否安装
where node >nul 2>nul
if errorlevel 1 (
    echo [错误] 未检测到 Node.js！
    echo.
    echo 请先安装 Node.js（建议 LTS 版本）：
    echo   https://nodejs.org/
    echo.
    pause
    exit /b 1
)

REM 检查 node_modules 是否存在（首次运行需要安装依赖）
if not exist "node_modules" (
    echo [首次运行] 正在安装游戏依赖，可能需要几分钟，请耐心等待...
    echo.
    call npm install
    if errorlevel 1 (
        echo.
        echo [错误] 依赖安装失败。请检查网络连接后重试。
        pause
        exit /b 1
    )
    echo.
    echo [完成] 依赖安装成功！
    echo.
)

echo ============================================================
echo  正在启动游戏服务器...
echo.
echo  请注意：
echo  ^* 游戏会自动在浏览器中打开（地址 http://localhost:5173）
echo  ^* 不要直接双击 index.html 打开！必须通过本脚本启动！
echo  ^* 这个黑色命令行窗口请保持打开，关闭它游戏也会关闭。
echo  ^* 想结束游戏：关闭浏览器标签 + 关闭这个黑色窗口。
echo ============================================================
echo.

call npm run dev

pause
