// ============================================================
// ui/UI.js — 游戏所有 HTML 界面的统一管理
// ------------------------------------------------------------
// 用 DOM 元素叠加在 Three.js 画布之上，实现：
//   - 准星（中心十字）
//   - 生命值（心形）
//   - 坐标/FPS（左下角调试信息）
//   - 物品栏（底部 9 格）
//   - 对话框（按 E 触发）
//   - 任务面板（右侧）
//   - 字幕（剧情演出）
//   - 提示信息（短暂的 toast）
// ============================================================
import { BLOCK, BLOCKS } from '../blocks/Blocks.js';
import { buildAtlas } from '../blocks/Textures.js';

// 方块名称的中文显示
const BLOCK_DISPLAY_NAME = {
  [BLOCK.GRASS]: '草地',
  [BLOCK.DIRT]: '泥土',
  [BLOCK.STONE]: '石头',
  [BLOCK.SAND]: '沙子',
  [BLOCK.WOOD]: '木头',
  [BLOCK.LEAVES]: '树叶',
  [BLOCK.WATER]: '水',
  [BLOCK.COAL_ORE]: '煤矿石',
  [BLOCK.IRON_ORE]: '铁矿石',
  [BLOCK.GOLD_ORE]: '金矿石',
  [BLOCK.DIAMOND_ORE]: '钻石矿石',
  [BLOCK.SNOW]: '雪',
  [BLOCK.BEDROCK]: '基岩',
  [BLOCK.PLANKS]: '木板',
  [BLOCK.HEART_FRAGMENT]: '世界之心碎片',
  [BLOCK.CRAFTING_TABLE]: '工作台',
};

export class UI {
  constructor() {
    this.root = this._createRoot();
    this.crosshair = this._createCrosshair();
    this.healthBar = this._createHealthBar();
    this.debugInfo = this._createDebugInfo();
    this.hotbar = this._createHotbar();
    this.dialogue = this._createDialogue();
    this.questPanel = this._createQuestPanel();
    this.subtitle = this._createSubtitle();
    this.toast = this._createToast();

    // 当前对话状态
    this.dialogueQueue = [];
    this.dialogueActive = false;
    this.onDialogueEnd = null;

    // 加载图标缓存
    this._iconCache = new Map();
  }

  // ----------------------------------------------------------
  // 创建各个 UI 元素
  // ----------------------------------------------------------
  _createRoot() {
    const div = document.createElement('div');
    div.id = 'ui-root';
    div.style.cssText = `
      position: fixed; inset: 0; z-index: 50;
      pointer-events: none; color: #fff;
      font-family: "Microsoft YaHei", "微软雅黑", sans-serif;
    `;
    document.body.appendChild(div);
    return div;
  }

  _createCrosshair() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; top: 50%; left: 50%;
      width: 24px; height: 24px;
      transform: translate(-50%, -50%);
      pointer-events: none;
    `;
    div.innerHTML = `
      <svg width="24" height="24" viewBox="0 0 24 24">
        <line x1="12" y1="4" x2="12" y2="9" stroke="white" stroke-width="2" stroke-opacity="0.85"/>
        <line x1="12" y1="15" x2="12" y2="20" stroke="white" stroke-width="2" stroke-opacity="0.85"/>
        <line x1="4" y1="12" x2="9" y2="12" stroke="white" stroke-width="2" stroke-opacity="0.85"/>
        <line x1="15" y1="12" x2="20" y2="12" stroke="white" stroke-width="2" stroke-opacity="0.85"/>
      </svg>
    `;
    this.root.appendChild(div);
    return div;
  }

  _createHealthBar() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; bottom: 70px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 2px;
    `;
    // 10 颗心（每颗代表 2 点生命）
    for (let i = 0; i < 10; i++) {
      const heart = document.createElement('div');
      heart.style.cssText = 'width: 18px; height: 18px;';
      heart.innerHTML = `<svg viewBox="0 0 16 16" width="18" height="18">
        <path d="M8 14L1.5 7.5C-0.5 5.5 0.5 2 3.5 2C5 2 6.5 3 8 4.5C9.5 3 11 2 12.5 2C15.5 2 16.5 5.5 14.5 7.5L8 14Z"
          fill="#ff3355" stroke="#000" stroke-width="1"/>
      </svg>`;
      div.appendChild(heart);
    }
    this.root.appendChild(div);
    return div;
  }

  _createDebugInfo() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; top: 10px; left: 10px;
      font-size: 13px; line-height: 1.6;
      text-shadow: 1px 1px 2px #000;
      color: #ffe;
    `;
    div.innerHTML = '加载中…';
    this.root.appendChild(div);
    return div;
  }

  _createHotbar() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; bottom: 15px; left: 50%;
      transform: translateX(-50%);
      display: flex; gap: 4px;
      padding: 4px;
      background: rgba(0,0,0,0.4);
      border: 2px solid rgba(255,255,255,0.3);
      border-radius: 4px;
    `;
    this.hotbarSlots = [];
    for (let i = 0; i < 9; i++) {
      const slot = document.createElement('div');
      slot.dataset.index = i;
      slot.style.cssText = `
        width: 50px; height: 50px;
        background: rgba(0,0,0,0.3);
        border: 2px solid rgba(120,120,120,0.6);
        display: flex; flex-direction: column;
        align-items: center; justify-content: center;
        position: relative;
        image-rendering: pixelated;
      `;
      const icon = document.createElement('canvas');
      icon.width = 32; icon.height = 32;
      icon.style.cssText = 'width:32px; height:32px; image-rendering: pixelated;';
      slot.appendChild(icon);
      const count = document.createElement('div');
      count.style.cssText = `
        position: absolute; bottom: 1px; right: 3px;
        font-size: 14px; font-weight: bold;
        color: #fff; text-shadow: 1px 1px 2px #000;
      `;
      slot.appendChild(count);
      const keynum = document.createElement('div');
      keynum.style.cssText = `
        position: absolute; top: 0; left: 3px;
        font-size: 11px; color: #aaa;
      `;
      keynum.textContent = (i + 1);
      slot.appendChild(keynum);
      div.appendChild(slot);
      this.hotbarSlots.push({ slot, icon, count });
    }
    this.root.appendChild(div);
    return div;
  }

  _createDialogue() {
    const wrap = document.createElement('div');
    wrap.style.cssText = `
      position: absolute; bottom: 130px; left: 50%;
      transform: translateX(-50%);
      width: min(720px, 90vw);
      background: rgba(15,20,35,0.92);
      border: 3px solid #6ab;
      border-radius: 8px;
      padding: 20px 24px;
      box-shadow: 0 0 30px rgba(80,180,200,0.4);
      display: none;
      pointer-events: auto;
    `;
    wrap.innerHTML = `
      <div id="dlg-name" style="font-size:18px; color:#9df; font-weight:bold; margin-bottom:8px;"></div>
      <div id="dlg-text" style="font-size:16px; line-height:1.7; color:#fff;"></div>
      <div style="margin-top:14px; text-align:right; font-size:13px; color:#799;">
        点击或按 <b style="color:#cef">空格</b> 继续 · 按 <b style="color:#cef">ESC</b> 关闭
      </div>
    `;
    this.root.appendChild(wrap);
    return wrap;
  }

  _createQuestPanel() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; top: 10px; right: 10px;
      width: 280px;
      background: rgba(15,20,35,0.85);
      border: 2px solid #6ab;
      border-radius: 6px;
      padding: 12px 14px;
      font-size: 13px;
      color: #fff;
      box-shadow: 0 0 20px rgba(0,0,0,0.5);
    `;
    div.innerHTML = `
      <div style="font-size:14px; color:#fc6; font-weight:bold; margin-bottom:8px; border-bottom:1px solid #446; padding-bottom:4px;">
        📜 当前任务
      </div>
      <div id="quest-content">无任务</div>
    `;
    this.root.appendChild(div);
    return div;
  }

  _createSubtitle() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; top: 18%; left: 50%;
      transform: translateX(-50%);
      font-size: 26px; font-weight: bold;
      color: #fff; text-align: center;
      text-shadow: 0 0 12px #000, 0 0 24px #000;
      max-width: 80vw; line-height: 1.5;
      opacity: 0; transition: opacity 0.6s;
      pointer-events: none;
    `;
    this.root.appendChild(div);
    return div;
  }

  _createToast() {
    const div = document.createElement('div');
    div.style.cssText = `
      position: absolute; top: 80px; left: 50%;
      transform: translateX(-50%);
      background: rgba(0,0,0,0.75);
      color: #ff8; padding: 10px 24px;
      border-radius: 4px; font-size: 15px;
      border: 1px solid #886;
      opacity: 0; transition: opacity 0.3s;
    `;
    this.root.appendChild(div);
    return div;
  }

  // ----------------------------------------------------------
  // 公共方法
  // ----------------------------------------------------------

  // 更新调试信息
  updateDebug(player, fps) {
    const p = player.position;
    this.debugInfo.innerHTML = `
      <div>FPS: <b style="color:#9f9">${fps}</b></div>
      <div>坐标: ${p.x.toFixed(1)}, ${p.y.toFixed(1)}, ${p.z.toFixed(1)}</div>
      <div>世界之心碎片: <b style="color:#f9c">${player.stats.fragmentsCollected}</b></div>
    `;
  }

  // 更新物品栏显示
  updateHotbar(player) {
    for (let i = 0; i < 9; i++) {
      const item = player.inventory[i];
      const slot = this.hotbarSlots[i];
      // 高亮选中格
      if (i === player.selectedSlot) {
        slot.slot.style.borderColor = '#fff';
        slot.slot.style.background = 'rgba(255,255,255,0.15)';
      } else {
        slot.slot.style.borderColor = 'rgba(120,120,120,0.6)';
        slot.slot.style.background = 'rgba(0,0,0,0.3)';
      }
      // 绘制图标和数量
      const ctx = slot.icon.getContext('2d');
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, 32, 32);
      if (item.id !== 0 && item.count > 0) {
        this._drawBlockIcon(ctx, item.id);
        slot.count.textContent = item.count > 1 ? item.count : '';
      } else {
        slot.count.textContent = '';
      }
    }
  }

  // 在物品栏格子里绘制方块图标（用纹理图集）
  _drawBlockIcon(ctx, blockId) {
    const def = BLOCKS[blockId];
    if (!def || !def.textures) return;
    // 优先用"侧面"贴图，没有就用 all
    let texName;
    if (def.textures.side) texName = def.textures.side;
    else if (def.textures.all) texName = def.textures.all;
    else if (def.textures.top) texName = def.textures.top;
    else return;

    const { uvMap } = buildAtlas();
    const uv = uvMap[texName];
    if (!uv) return;
    // 从图集画布裁出对应贴图，放大绘制
    const atlas = buildAtlas().atlas;
    const TILE = 16;
    const col = Math.floor((uv.u0 + uv.u1) / 2 * atlas.width / TILE) * 0;  // 简化：用 index
    // 简化：用 uv.index 直接算位置
    const idx = uv.index;
    const TILES_PER_ROW = 8;
    const sx = (idx % TILES_PER_ROW) * TILE;
    const sy = Math.floor(idx / TILES_PER_ROW) * TILE;
    ctx.drawImage(atlas, sx, sy, TILE, TILE, 0, 0, 32, 32);
  }

  // 更新生命值显示
  updateHealth(player) {
    const hearts = this.healthBar.children;
    const fullHearts = Math.ceil(player.health / 2);
    for (let i = 0; i < 10; i++) {
      const heart = hearts[i].querySelector('path');
      if (i < fullHearts) {
        heart.setAttribute('fill', '#ff3355');
      } else {
        heart.setAttribute('fill', '#333');
      }
    }
  }

  // ----------------------------------------------------------
  // 对话系统
  // ----------------------------------------------------------

  // 显示一组对话（lines 是数组，每个元素 { name, text }）
  showDialogue(lines, onEnd) {
    this.dialogueQueue = [...lines];
    this.onDialogueEnd = onEnd || null;
    this._nextDialogueLine();
  }

  _nextDialogueLine() {
    if (this.dialogueQueue.length === 0) {
      this.dialogue.style.display = 'none';
      this.dialogueActive = false;
      if (this.onDialogueEnd) {
        const cb = this.onDialogueEnd;
        this.onDialogueEnd = null;
        cb();
      }
      return;
    }
    const line = this.dialogueQueue.shift();
    this.dialogue.style.display = 'block';
    this.dialogueActive = true;
    this.dialogue.querySelector('#dlg-name').textContent = line.name || '';
    // 逐字显示效果
    this._typeText(this.dialogue.querySelector('#dlg-text'), line.text);
  }

  _typeText(el, text) {
    el.textContent = '';
    let i = 0;
    if (this._typingInterval) clearInterval(this._typingInterval);
    this._typingInterval = setInterval(() => {
      el.textContent += text[i];
      i++;
      if (i >= text.length) {
        clearInterval(this._typingInterval);
        this._typingInterval = null;
      }
    }, 18);
  }

  // 推进对话（点击/空格）
  advanceDialogue() {
    if (!this.dialogueActive) return false;
    // 如果还在打字，先显示完整
    if (this._typingInterval) {
      clearInterval(this._typingInterval);
      this._typingInterval = null;
      const line = this.dialogue.querySelector('#dlg-text');
      // 这里没法拿到完整文本，简化：直接进入下一句
    }
    this._nextDialogueLine();
    return true;
  }

  // 关闭对话
  closeDialogue() {
    this.dialogueQueue = [];
    this.dialogue.style.display = 'none';
    this.dialogueActive = false;
    if (this._typingInterval) clearInterval(this._typingInterval);
  }

  isDialogueActive() { return this.dialogueActive; }

  // ----------------------------------------------------------
  // 任务面板
  // ----------------------------------------------------------
  updateQuest(quest) {
    const content = this.questPanel.querySelector('#quest-content');
    if (!quest) {
      content.innerHTML = '<div style="color:#888;">暂无任务</div>';
      return;
    }
    let html = `
      <div style="color:#fc6; font-weight:bold; margin-bottom:6px;">${quest.title}</div>
      <div style="color:#9cf; font-size:12px; margin-bottom:6px;">【${quest.chapter}】</div>
    `;
    for (const obj of quest.objectives) {
      const done = obj.current >= obj.target;
      html += `<div style="margin-bottom:4px; color:${done ? '#9f9' : '#ddd'};">
        ${done ? '✓' : '○'} ${obj.desc}
        ${obj.target > 1 ? `<span style="color:#aaa;">(${Math.min(obj.current, obj.target)}/${obj.target})</span>` : ''}
      </div>`;
    }
    content.innerHTML = html;
  }

  // ----------------------------------------------------------
  // 字幕（剧情演出）
  // ----------------------------------------------------------
  showSubtitle(text, duration = 4000) {
    this.subtitle.textContent = text;
    this.subtitle.style.opacity = '1';
    if (this._subtitleTimer) clearTimeout(this._subtitleTimer);
    this._subtitleTimer = setTimeout(() => {
      this.subtitle.style.opacity = '0';
    }, duration);
  }

  // ----------------------------------------------------------
  // Toast 提示（短暂浮起的消息）
  // ----------------------------------------------------------
  showToast(message, duration = 2500) {
    this.toast.textContent = message;
    this.toast.style.opacity = '1';
    if (this._toastTimer) clearTimeout(this._toastTimer);
    this._toastTimer = setTimeout(() => {
      this.toast.style.opacity = '0';
    }, duration);
  }

  // 隐藏所有游戏 UI（开始画面时）
  hideGameUI() {
    this.root.style.display = 'none';
  }
  showGameUI() {
    this.root.style.display = 'block';
  }
}

export default UI;
