// ============================================================
// game/Game.js — 游戏主类（串联所有系统）
// ------------------------------------------------------------
// 这是整个游戏的中枢。它负责：
//   1. 创建 Three.js 场景、相机、渲染器、灯光
//   2. 创建世界、玩家、NPC、UI、故事系统
//   3. 运行主循环（每帧更新物理、渲染、UI）
//   4. 处理输入事件（鼠标/键盘 → 玩家动作）
// ============================================================
import * as THREE from 'three';
import { World } from './World.js';
import { Player } from '../player/Player.js';
import { Controls } from '../player/Controls.js';
import { Physics } from '../player/Physics.js';
import { Interaction } from '../player/Interaction.js';
import { UI } from '../ui/UI.js';
import { Story } from '../story/Story.js';
import { Guide } from '../npc/Guide.js';
import { BLOCK } from '../blocks/Blocks.js';
import { WORLD } from '../terrain/TerrainGenerator.js';

// 世界种子（同样的种子 → 同样的世界）
const SEED = 1337;

export class Game {
  constructor(container) {
    this.container = container;
    this.started = false;
    this.paused = false;

    // ---------- Three.js 基础设置 ----------
    this._initRenderer();
    this._initScene();
    this._initCamera();
    this._initLights();
    this._initSky();

    // ---------- 游戏系统 ----------
    this.world = new World(this.scene, SEED);
    this.player = new Player(this.camera);
    this.physics = new Physics(this.world);
    this.ui = new UI();
    this.story = new Story(this.ui, this.player);
    this.interaction = new Interaction(this.world, this.player, this.story);

    // 把方块高亮线框加到场景
    this.scene.add(this.interaction.highlight);

    // ---------- 控件 ----------
    this.controls = new Controls(this.camera, this.renderer.domElement);
    this._setupLookControl();

    // ---------- NPC ----------
    this.npcs = [];

    // ---------- 时间统计 ----------
    this.lastTime = performance.now();
    this.fps = 0;
    this.fpsFrames = 0;
    this.fpsTimer = 0;

    // 绑定主循环
    this._loop = this._loop.bind(this);

    // 监听对话时的点击/空格推进
    this._setupDialogueAdvance();
  }

  // ----------------------------------------------------------
  // 初始化渲染器
  // ----------------------------------------------------------
  _initRenderer() {
    this.renderer = new THREE.WebGLRenderer({ antialias: false, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
    this.renderer.setSize(window.innerWidth, window.innerHeight);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.container.appendChild(this.renderer.domElement);

    // 窗口大小变化
    window.addEventListener('resize', () => {
      this.camera.aspect = window.innerWidth / window.innerHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(window.innerWidth, window.innerHeight);
    });
  }

  // ----------------------------------------------------------
  // 初始化场景
  // ----------------------------------------------------------
  _initScene() {
    this.scene = new THREE.Scene();
    // 雾：让远处的区块淡入背景色（掩盖区块加载边界）
    this.scene.fog = new THREE.Fog(0x9ec7e8, 30, 70);
  }

  // ----------------------------------------------------------
  // 初始化相机
  // ----------------------------------------------------------
  _initCamera() {
    this.camera = new THREE.PerspectiveCamera(
      75, window.innerWidth / window.innerHeight, 0.1, 500
    );
  }

  // ----------------------------------------------------------
  // 初始化灯光（环境光 + 太阳光）
  // ----------------------------------------------------------
  _initLights() {
    // 环境光：整体提亮，避免阴影里全黑
    const ambient = new THREE.AmbientLight(0xffffff, 0.55);
    this.scene.add(ambient);

    // 太阳（平行光）：主要光源，投阴影
    const sun = new THREE.DirectionalLight(0xfff4d6, 0.8);
    sun.position.set(50, 100, 30);
    this.scene.add(sun);

    // 天空光（半球光）：蓝色天光 + 绿色地光
    const hemi = new THREE.HemisphereLight(0x9ec7e8, 0x5a7a3a, 0.4);
    this.scene.add(hemi);
  }

  // ----------------------------------------------------------
  // 天空背景色
  // ----------------------------------------------------------
  _initSky() {
    this.scene.background = new THREE.Color(0x9ec7e8);
  }

  // ----------------------------------------------------------
  // 把鼠标视角变化连接到玩家的 yaw/pitch
  // ----------------------------------------------------------
  _setupLookControl() {
    this.controls.onLook = (dyaw, dpitch) => {
      this.player.yaw += dyaw;
      this.player.pitch += dpitch;
      // 限制俯仰角（不能翻转）
      const limit = Math.PI / 2 - 0.01;
      if (this.player.pitch > limit) this.player.pitch = limit;
      if (this.player.pitch < -limit) this.player.pitch = -limit;
    };
  }

  // ----------------------------------------------------------
  // 对话推进（点击对话框 或 按空格）
  // ----------------------------------------------------------
  _setupDialogueAdvance() {
    const advance = (e) => {
      if (!this.ui.isDialogueActive()) return;
      // 鼠标点击 或 空格/回车
      if (e.type === 'click' || e.code === 'Space' || e.code === 'Enter') {
        this.ui.advanceDialogue();
        if (e.preventDefault) e.preventDefault();
      }
    };
    this.ui.dialogue.addEventListener('click', advance);
    document.addEventListener('keydown', (e) => {
      if (this.ui.isDialogueActive() && (e.code === 'Space' || e.code === 'Escape')) {
        if (e.code === 'Escape') {
          this.ui.closeDialogue();
        } else {
          this.ui.advanceDialogue();
        }
        e.preventDefault();
      }
    });
  }

  // ----------------------------------------------------------
  // 启动游戏（玩家点击"进入世界"按钮后调用）
  // ----------------------------------------------------------
  start() {
    if (this.started) return;
    this.started = true;

    // 找一个合适的出生点（草地上）
    const spawnX = 0, spawnZ = 0;
    // 确保出生点附近区块已生成
    for (let dz = -2; dz <= 2; dz++) {
      for (let dx = -2; dx <= 2; dx++) {
        this.world.ensureChunk(dx, dz);
      }
    }
    const groundY = this.world.findSurfaceY(spawnX, spawnZ);
    this.player.position.set(spawnX + 0.5, groundY + 1, spawnZ + 0.5);

    // 在出生点附近放置向导 NPC
    const guidePos = new THREE.Vector3(spawnX + 3, groundY, spawnZ + 1);
    this.guide = new Guide(guidePos, this.story);
    this.guide.addToScene(this.scene);
    this.npcs.push(this.guide);

    // 在森林深处放置第一块世界之心碎片
    // 找一个离出生点有一定距离的位置
    this._placeFirstFragment(spawnX, spawnZ);

    // 启动故事（序章开场字幕）
    setTimeout(() => this.story.start(), 800);

    // 显示游戏 UI
    this.ui.showGameUI();
    this.ui.updateHotbar(this.player);
    this.ui.updateHealth(this.player);

    // 启动主循环
    this.lastTime = performance.now();
    requestAnimationFrame(this._loop);
  }

  // 在森林中放第一块世界之心碎片
  _placeFirstFragment(originX, originZ) {
    // 在东偏南方向 25-35 格的位置放置碎片
    const fx = originX + 28;
    const fz = originZ + 18;
    // 确保该位置区块已生成
    const { cx, cz } = this.world.worldToChunk(fx, fz);
    for (let dz = -1; dz <= 1; dz++) {
      for (let dx = -1; dx <= 1; dx++) {
        this.world.ensureChunk(cx + dx, cz + dz);
      }
    }
    const fy = this.world.findSurfaceY(fx, fz);
    // 把碎片放在地表上一个显眼位置（柱状台座）
    this.world.addSpecialBlock(fx, fy + 1, fz, BLOCK.HEART_FRAGMENT, { isFragment: true });
    // 周围搭一圈石头基座，更显眼
    for (let dx = -1; dx <= 1; dx++) {
      for (let dz = -1; dz <= 1; dz++) {
        if (dx === 0 && dz === 0) continue;
        this.world.setBlock(fx + dx, fy, fz + dz, BLOCK.STONE);
      }
    }
  }

  // ----------------------------------------------------------
  // 主循环
  // ----------------------------------------------------------
  _loop(now) {
    if (!this.started) return;
    requestAnimationFrame(this._loop);

    // 计算 delta time（秒），限制最大值避免标签切换后的大跳
    let dt = (now - this.lastTime) / 1000;
    this.lastTime = now;
    if (dt > 0.1) dt = 0.1;

    // FPS 统计
    this.fpsFrames++;
    this.fpsTimer += dt;
    if (this.fpsTimer >= 0.5) {
      this.fps = Math.round(this.fpsFrames / this.fpsTimer);
      this.fpsFrames = 0;
      this.fpsTimer = 0;
    }

    // 对话激活时暂停游戏逻辑（但仍然渲染）
    const inDialogue = this.ui.isDialogueActive();

    if (!inDialogue) {
      // 1. 处理输入事件
      this._handleInput();

      // 2. 物理更新
      this.physics.update(
        this.player,
        dt,
        this.controls.move,
        this.controls.jumpPressed,
        this.controls.sneakPressed
      );
      this.player.isSneaking = this.controls.sneakPressed;
    }

    // 3. 同步相机位置
    this.player.syncCamera();

    // 4. 更新世界（加载/卸载区块）
    this.world.update(this.player.position.x, this.player.position.z);

    // 5. 更新方块高亮
    this.interaction.updateHighlight();

    // 6. 更新 NPC
    for (const npc of this.npcs) {
      npc.update(dt, this.player.position);
    }

    // 7. 更新 UI（每几帧更新一次以省性能）
    if (this.fpsFrames % 6 === 0) {
      this.ui.updateDebug(this.player, this.fps);
      this.ui.updateHotbar(this.player);
    }

    // 8. 渲染
    this.renderer.render(this.scene, this.camera);
  }

  // ----------------------------------------------------------
  // 处理一次性输入（点击/按键事件）
  // ----------------------------------------------------------
  _handleInput() {
    // 鼠标左键：破坏
    if (this.controls.consumeLeftClick()) {
      this.interaction.onBreak();
      this.ui.updateHotbar(this.player);
    }
    // 鼠标右键：放置
    if (this.controls.consumeRightClick()) {
      this.interaction.onPlace();
      this.ui.updateHotbar(this.player);
    }
    // 槽位切换
    const slot = this.controls.consumeSlotChange();
    if (slot) {
      if (slot.type === 'digit') this.player.selectSlot(slot.value);
      else if (slot.type === 'scroll') this.player.scrollSlot(slot.value);
      this.ui.updateHotbar(this.player);
    }
    // E 键：与 NPC 交互
    if (this.controls.consumeInteract()) {
      this._tryInteractWithNPC();
    }
  }

  // 尝试与附近的 NPC 交互
  _tryInteractWithNPC() {
    for (const npc of this.npcs) {
      if (npc.isInRange(this.player.position)) {
        npc.interact();
        return;
      }
    }
    // 没有附近的 NPC
    this.ui.showToast('附近没有可交互的对象', 1500);
  }
}

export default Game;
