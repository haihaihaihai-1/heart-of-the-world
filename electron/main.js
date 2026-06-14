// ============================================================
// electron/main.js — Electron 桌面应用主进程
// ------------------------------------------------------------
// Electron 把网页游戏包装成一个桌面应用程序（可双击运行的 exe）。
// 这个文件是"主进程"，负责创建窗口；网页内容（游戏本身）跑在
// "渲染进程"里。
// ============================================================
import { app, BrowserWindow, Menu } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

// 将 import.meta.url 转换为 __dirname（ESM 中没有原生的 __dirname）
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 判断是否处于开发模式（npm run electron:dev 时为 true）
const isDev = !app.isPackaged && process.env.NODE_ENV !== 'production';

// 是否使用本地 Vite 开发服务器
const USE_DEV_SERVER = process.env.VITE_DEV_SERVER === 'true';

// ------------------------------------------------------------
// 创建游戏窗口
// ------------------------------------------------------------
function createWindow() {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    title: '世界之心 — Heart of the World',
    backgroundColor: '#0a1929',
    // 隐藏菜单栏（看起来更像游戏）
    autoHideMenuBar: true,
    webPreferences: {
      // 关闭 Node 集成（安全），游戏只用浏览器 API
      nodeIntegration: false,
      contextIsolation: true
    }
  });

  // 移除菜单栏
  Menu.setApplicationMenu(null);

  if (USE_DEV_SERVER) {
    // 开发模式：加载本地 Vite 开发服务器（支持热重载）
    win.loadURL('http://localhost:5173');
    // 开发时打开开发者工具（调试用，可注释掉）
    // win.webContents.openDevTools();
  } else {
    // 生产模式：加载打包后的 index.html
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

// ------------------------------------------------------------
// 应用生命周期
// ------------------------------------------------------------
// 当 Electron 完成初始化后创建窗口
app.whenReady().then(() => {
  createWindow();

  // macOS 上点击 dock 图标时，如果没有窗口就重新创建一个
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

// 所有窗口关闭时退出应用（macOS 除外）
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
