// ============================================================
// player/Player.js — 玩家状态与数据
// ------------------------------------------------------------
// 维护玩家的位置、速度、朝向、生命值、物品栏等数据。
// 物理模拟在 Physics.js，输入控制在 Controls.js。
// ============================================================
import * as THREE from 'three';
import { BLOCK, PLACEABLE_BLOCKS } from '../blocks/Blocks.js';

export class Player {
  constructor(camera) {
    this.camera = camera;

    // 位置（相机所在位置 = 玩家眼睛）
    this.position = new THREE.Vector3(0, 40, 0);
    this.velocity = new THREE.Vector3(0, 0, 0);

    // 朝向（用相机自身的旋转）
    this.yaw = 0;    // 水平转角
    this.pitch = 0;  // 垂直俯仰

    // 物理参数
    this.onGround = false;
    this.flying = false;
    this.width = 0.6;   // 玩家碰撞箱宽度
    this.height = 1.8;  // 玩家高度
    this.eyeHeight = 1.62;  // 眼睛距脚的高度

    // 状态
    this.health = 20;       // 生命值（10 颗心）
    this.maxHealth = 20;
    this.isSneaking = false;

    // 物品栏：9 个格子，每格存 { id, count }
    this.inventory = new Array(9).fill(null).map(() => ({ id: 0, count: 0 }));
    this.selectedSlot = 0;  // 当前选中的格子（0-8）

    // 初始物品：给玩家一些起始方块（方便体验）
    this.inventory[0] = { id: BLOCK.GRASS, count: 64 };
    this.inventory[1] = { id: BLOCK.STONE, count: 64 };
    this.inventory[2] = { id: BLOCK.WOOD, count: 32 };
    this.inventory[3] = { id: BLOCK.PLANKS, count: 32 };
    this.inventory[4] = { id: BLOCK.SAND, count: 32 };
    this.inventory[5] = { id: BLOCK.LEAVES, count: 16 };
    this.inventory[6] = { id: BLOCK.CRAFTING_TABLE, count: 4 };

    // 收集统计（用于任务系统）
    this.stats = {
      woodCollected: 0,
      stoneCollected: 0,
      fragmentsCollected: 0,
    };
  }

  // 当前选中的方块
  getSelectedItem() {
    return this.inventory[this.selectedSlot];
  }

  // 减少选中物品数量（破坏/使用后）
  consumeSelectedItem() {
    const item = this.inventory[this.selectedSlot];
    if (item && item.count > 0) {
      item.count--;
      if (item.count <= 0) {
        this.inventory[this.selectedSlot] = { id: 0, count: 0 };
      }
      return true;
    }
    return false;
  }

  // 增加某方块到物品栏（收集到东西时调用）
  addItem(blockId, count = 1) {
    // 先尝试堆叠到已有的同种物品
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].id === blockId && this.inventory[i].count < 64) {
        this.inventory[i].count += count;
        return true;
      }
    }
    // 否则找空格子
    for (let i = 0; i < this.inventory.length; i++) {
      if (this.inventory[i].count === 0) {
        this.inventory[i] = { id: blockId, count };
        return true;
      }
    }
    return false;  // 物品栏满了
  }

  // 切换选中的物品栏格子
  selectSlot(i) {
    if (i >= 0 && i < this.inventory.length) {
      this.selectedSlot = i;
    }
  }

  // 滚轮切换
  scrollSlot(delta) {
    let i = this.selectedSlot + delta;
    if (i < 0) i = this.inventory.length - 1;
    if (i >= this.inventory.length) i = 0;
    this.selectedSlot = i;
  }

  // 更新相机位置（每帧调用）
  syncCamera() {
    // 眼睛位置 = 脚位置 + 眼睛高度
    this.camera.position.set(
      this.position.x,
      this.position.y + this.eyeHeight,
      this.position.z
    );
    // 朝向：用 Euler 角设置相机旋转
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = this.yaw;
    this.camera.rotation.x = this.pitch;
  }
}

export default Player;
