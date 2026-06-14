// ============================================================
// vite.config.js — Vite 构建工具配置
// ------------------------------------------------------------
// Vite 是一个现代化的前端构建工具，提供超快的开发服务器（热重载）
// 和优化的打包功能。这里是它的配置文件。
// ============================================================
import { defineConfig } from 'vite';

export default defineConfig({
  // 项目根目录（index.html 所在位置）
  root: '.',
  // 开发服务器配置
  server: {
    port: 5173,        // 端口号
    host: 'localhost',
    // 自动打开默认浏览器到游戏页面。
    // 注意：必须在浏览器中通过 http:// 访问，不能用 file:// 双击 html 打开，
    // 因为 ES Modules 在 file:// 协议下会被浏览器 CORS 策略拦截。
    open: true,
    // 启动后自动打开的路径
    openPath: '/'
  },
  // 构建配置
  build: {
    outDir: 'dist',    // 输出目录
    chunkSizeWarningLimit: 2000  // three.js 较大，调高警告阈值
  },
  // 让 Vite 能正确处理 three.js 的示例模块（addons）
  optimizeDeps: {
    include: ['three']
  }
});
