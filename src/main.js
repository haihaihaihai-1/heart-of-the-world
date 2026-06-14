// ============================================================
// main.js — 游戏入口（Vite 加载的第一个脚本）
// ------------------------------------------------------------
// 负责把开始画面和游戏连接起来：
//   - 显示标题画面
//   - 等"进入世界"按钮被点击
//   - 创建 Game 实例并启动
// ============================================================
import { Game } from './game/Game.js';

// 找到 HTML 中的元素
const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const loadingText = document.getElementById('loading-text');
const app = document.getElementById('app');

// 游戏实例（懒加载，等点击后再创建）
let game = null;

// 提前预热纹理图集（开始按钮显示前先准备资源）
import { buildAtlas } from './blocks/Textures.js';
try {
  buildAtlas();
  loadingText.textContent = '准备就绪 ✓';
  startBtn.disabled = false;
} catch (e) {
  loadingText.textContent = '资源加载失败：' + e.message;
  console.error(e);
}

// ----------------------------------------------------------
// 点击"进入世界"按钮
// ----------------------------------------------------------
startBtn.addEventListener('click', () => {
  // 隐藏开始画面
  startScreen.style.transition = 'opacity 0.6s';
  startScreen.style.opacity = '0';
  setTimeout(() => {
    startScreen.style.display = 'none';
  }, 600);

  // 创建游戏并启动
  if (!game) {
    game = new Game(app);
    game.start();
  }
});

// 防止页面被意外关闭时丢失进度（虽然现在没存档，但养成习惯）
window.addEventListener('beforeunload', (e) => {
  if (game && game.started) {
    e.preventDefault();
    e.returnValue = '';
  }
});
