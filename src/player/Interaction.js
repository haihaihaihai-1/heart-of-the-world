// ============================================================
// player/Interaction.js — 方块破坏与放置
// ------------------------------------------------------------
// 处理"鼠标左键破坏方块"、"右键放置方块"的逻辑。
// 使用 World.raycast 从玩家眼睛向前投射射线，找到目标方块。
// ============================================================
import * as THREE from 'three';
import { BLOCK, isUnbreakable } from '../blocks/Blocks.js';

export class Interaction {
  constructor(world, player, story) {
    this.world = world;
    this.player = player;
    this.story = story;
    // 高亮选中方块的线框
    this.highlight = null;
    this._initHighlight();
  }

  _initHighlight() {
    const geo = new THREE.BoxGeometry(1.002, 1.002, 1.002);
    const edges = new THREE.EdgesGeometry(geo);
    const mat = new THREE.LineBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.4 });
    this.highlight = new THREE.LineSegments(edges, mat);
    this.highlight.visible = false;
  }

  // 计算玩家视线方向
  _getLookDirection() {
    const dir = new THREE.Vector3(0, 0, -1);
    dir.applyEuler(new THREE.Euler(this.player.pitch, this.player.yaw, 0, 'YXZ'));
    return dir;
  }

  // 每帧更新高亮（在 Game 主循环里调用）
  updateHighlight() {
    const origin = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + this.player.eyeHeight,
      this.player.position.z
    );
    const dir = this._getLookDirection();
    const hit = this.world.raycast(origin, dir, 6);
    if (hit) {
      this.highlight.visible = true;
      this.highlight.position.set(hit.x + 0.5, hit.y + 0.5, hit.z + 0.5);
    } else {
      this.highlight.visible = false;
    }
    return hit;
  }

  // 鼠标左键：破坏方块
  onBreak() {
    const origin = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + this.player.eyeHeight,
      this.player.position.z
    );
    const dir = this._getLookDirection();
    const hit = this.world.raycast(origin, dir, 6);
    if (!hit) return;

    const blockId = hit.id;

    // 世界之心碎片：特殊处理（触发剧情）
    if (blockId === BLOCK.HEART_FRAGMENT) {
      this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);
      this.player.stats.fragmentsCollected++;
      if (this.story) {
        this.story.onFragmentCollected(hit.x, hit.y, hit.z);
      }
      return;
    }

    // 不可破坏（基岩等）
    if (isUnbreakable(blockId)) return;

    // 破坏方块
    this.world.setBlock(hit.x, hit.y, hit.z, BLOCK.AIR);

    // 加入物品栏
    this.player.addItem(blockId, 1);

    // 任务系统：统计收集
    if (this.story) {
      this.story.onBlockCollected(blockId);
    }
  }

  // 鼠标右键：放置方块
  onPlace() {
    const item = this.player.getSelectedItem();
    if (!item || item.count <= 0 || item.id === 0) return;

    const origin = new THREE.Vector3(
      this.player.position.x,
      this.player.position.y + this.player.eyeHeight,
      this.player.position.z
    );
    const dir = this._getLookDirection();
    const hit = this.world.raycast(origin, dir, 6);
    if (!hit) return;

    // 放置位置：被击中方块的"法线方向"那一格
    const px = hit.x + hit.face[0];
    const py = hit.y + hit.face[1];
    const pz = hit.z + hit.face[2];

    // 检查目标位置是否为空（不能覆盖已有方块）
    const target = this.world.getBlock(px, py, pz);
    if (target !== BLOCK.AIR && target !== BLOCK.WATER) return;

    // 检查是否会卡到玩家身上（避免把自己困住）
    if (this._wouldCollideWithPlayer(px, py, pz)) return;

    // 放置
    if (this.world.setBlock(px, py, pz, item.id)) {
      this.player.consumeSelectedItem();
    }
  }

  // 判断某方块是否会和玩家身体重叠
  _wouldCollideWithPlayer(bx, by, bz) {
    const p = this.player;
    const hw = p.width / 2;
    const minX = p.position.x - hw, maxX = p.position.x + hw;
    const minY = p.position.y, maxY = p.position.y + p.height;
    const minZ = p.position.z - hw, maxZ = p.position.z + hw;
    // 方块的 AABB 是 [bx, bx+1] 等
    return !(maxX <= bx || minX >= bx + 1 ||
             maxY <= by || minY >= by + 1 ||
             maxZ <= bz || minZ >= bz + 1);
  }
}

export default Interaction;
