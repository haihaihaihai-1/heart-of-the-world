// ============================================================
// player/Controls.js — 第一人称输入控制
// ------------------------------------------------------------
// 使用 Pointer Lock API：点击游戏画面后，鼠标被锁定，移动
// 鼠标控制视角；按 ESC 解除锁定。
//
// 键盘：WASD 移动、空格跳跃、Shift 下蹲、E 对话、1-9 切槽
// 鼠标：移动转视角、左键破坏、右键放置、滚轮切槽
// ============================================================
import * as THREE from 'three';

export class Controls {
  constructor(camera, domElement) {
    this.camera = camera;
    this.dom = domElement;
    this.locked = false;

    // 移动方向意图（每帧由 Physics 读取）
    this.move = { forward: 0, right: 0 };  // [-1, 1]
    this.jumpPressed = false;
    this.sneakPressed = false;

    // 鼠标按键（每帧由 Game 读取并清零）
    this.leftClick = false;
    this.rightClick = false;

    // 对话/交互（按 E，由 Game 读取并清零）
    this.interactPressed = false;

    // 槽位切换事件
    this.slotChange = null;

    // 当前按下的键
    this.keys = new Set();

    this._bindEvents();
  }

  _bindEvents() {
    // 点击锁定鼠标
    this.dom.addEventListener('click', () => {
      if (!this.locked) this.dom.requestPointerLock();
    });

    // Pointer Lock 状态变化
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.dom;
    });

    // 鼠标移动 → 转视角
    document.addEventListener('mousemove', (e) => {
      if (!this.locked) return;
      this.onMouseMove(e.movementX, e.movementY);
    });

    // 键盘按下
    document.addEventListener('keydown', (e) => this.onKeyDown(e));
    document.addEventListener('keyup', (e) => this.onKeyUp(e));

    // 鼠标按键（破坏/放置）
    document.addEventListener('mousedown', (e) => {
      if (!this.locked) return;
      if (e.button === 0) this.leftClick = true;
      if (e.button === 2) this.rightClick = true;
    });

    // 阻止右键菜单
    this.dom.addEventListener('contextmenu', (e) => e.preventDefault());

    // 滚轮切换槽位
    document.addEventListener('wheel', (e) => {
      if (!this.locked) return;
      this.slotChange = Math.sign(e.deltaY);
    });
  }

  // 鼠标移动处理：更新 yaw 和 pitch
  onMouseMove(dx, dy) {
    const SENSITIVITY = 0.0025;
    // yaw 通过 camera.rotation.y 读取（在 Player.syncCamera 中设置）
    // 这里我们维护 Player 的 yaw/pitch，让 Game 读取后赋值给 Player
    // 但 Controls 不直接知道 Player，所以通过回调通知
    if (this.onLook) {
      this.onLook(-dx * SENSITIVITY, -dy * SENSITIVITY);
    }
  }

  // 把按键映射为移动意图
  _updateMove() {
    let f = 0, r = 0;
    if (this.keys.has('KeyW')) f += 1;
    if (this.keys.has('KeyS')) f -= 1;
    if (this.keys.has('KeyD')) r += 1;
    if (this.keys.has('KeyA')) r -= 1;
    this.move.forward = f;
    this.move.right = r;
    this.jumpPressed = this.keys.has('Space');
    this.sneakPressed = this.keys.has('ShiftLeft') || this.keys.has('ShiftRight');
  }

  onKeyDown(e) {
    // 对话键 E
    if (e.code === 'KeyE') {
      this.interactPressed = true;
      e.preventDefault();
      return;
    }
    // 数字键切换槽位
    if (e.code.startsWith('Digit')) {
      const n = parseInt(e.code.slice(5));
      if (n >= 1 && n <= 9) {
        this.slotChange = null;  // 清掉滚轮
        this._digitSlot = n - 1;
      }
    }
    // 防止空格滚动页面
    if (e.code === 'Space') e.preventDefault();
    this.keys.add(e.code);
    this._updateMove();
  }

  onKeyUp(e) {
    this.keys.delete(e.code);
    this._updateMove();
  }

  // 由 Game 每帧调用：取出并清空一次性事件
  consumeLeftClick() { const v = this.leftClick; this.leftClick = false; return v; }
  consumeRightClick() { const v = this.rightClick; this.rightClick = false; return v; }
  consumeInteract() { const v = this.interactPressed; this.interactPressed = false; return v; }
  consumeSlotChange() {
    if (this._digitSlot !== undefined) {
      const v = this._digitSlot;
      this._digitSlot = undefined;
      return { type: 'digit', value: v };
    }
    if (this.slotChange !== null) {
      const v = this.slotChange;
      this.slotChange = null;
      return { type: 'scroll', value: v };
    }
    return null;
  }
}

export default Controls;
