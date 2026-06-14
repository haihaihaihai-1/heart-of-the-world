// ============================================================
// player/Physics.js — 玩家物理模拟
// ------------------------------------------------------------
// 处理重力、跳跃、移动、碰撞检测。
// 碰撞检测采用"分轴 AABB 扫掠"——分别检查 X、Y、Z 三个轴
// 的移动，每次遇到固体方块就停止。这样能正确实现：
//   - 站在地上不掉下去（Y 轴受阻）
//   - 沿着墙壁滑动（X 或 Z 受阻，另一个轴还能动）
// ============================================================
import * as THREE from 'three';
import { isSolid } from '../blocks/Blocks.js';

// 物理常量
const GRAVITY = -28;        // 重力加速度（块/秒²）
const JUMP_SPEED = 9;       // 跳跃初速度
const MOVE_SPEED = 5.5;     // 行走速度
const SNEAK_SPEED = 2.5;    // 下蹲速度
const AIR_CONTROL = 0.7;    // 空中操控性（0-1）

export class Physics {
  constructor(world) {
    this.world = world;
  }

  // ----------------------------------------------------------
  // 每帧更新玩家位置（dt 是时间增量，秒）
  // ----------------------------------------------------------
  update(player, dt, moveInput, jumpPressed, sneakPressed) {
    // 1. 计算水平移动方向（基于玩家朝向）
    const speed = sneakPressed ? SNEAK_SPEED : MOVE_SPEED;
    const forward = moveInput.forward;
    const right = moveInput.right;

    // 把"前后/左右"意图转换为世界坐标的速度向量
    // yaw=0 时玩家面向 -Z 方向
    const sin = Math.sin(player.yaw);
    const cos = Math.cos(player.yaw);

    // 前/后方向（俯视下）：玩家"前方"在世界坐标是 (-sin, 0, -cos)
    // 右方向：(cos, 0, -sin)
    let vx = (-sin * forward + cos * right);
    let vz = (-cos * forward - sin * right);

    // 归一化（防止斜向移动更快）
    const len = Math.hypot(vx, vz);
    if (len > 0) {
      vx = (vx / len) * speed;
      vz = (vz / len) * speed;
    }

    // 空中操控性降低
    if (!player.onGround) {
      vx *= AIR_CONTROL;
      vz *= AIR_CONTROL;
    }

    player.velocity.x = vx;
    player.velocity.z = vz;

    // 2. 重力 + 跳跃
    if (jumpPressed && player.onGround) {
      player.velocity.y = JUMP_SPEED;
      player.onGround = false;
    }
    player.velocity.y += GRAVITY * dt;
    // 限制下落速度
    if (player.velocity.y < -40) player.velocity.y = -40;

    // 3. 分轴碰撞扫掠
    // X 轴
    this._moveAxis(player, player.velocity.x * dt, 0, 0);
    // Z 轴
    this._moveAxis(player, 0, 0, player.velocity.z * dt);
    // Y 轴（最后做，便于检测是否着地）
    const groundedBefore = player.onGround;
    player.onGround = false;
    this._moveAxis(player, 0, player.velocity.y * dt, 0);

    // 4. 掉出世界底部 → 拉回
    if (player.position.y < -10) {
      player.position.y = 50;
      player.velocity.set(0, 0, 0);
    }
  }

  // ----------------------------------------------------------
  // 沿单个轴移动并处理碰撞
  // ----------------------------------------------------------
  _moveAxis(player, dx, dy, dz) {
    // 先尝试移动
    player.position.x += dx;
    player.position.y += dy;
    player.position.z += dz;

    // 检查玩家 AABB 是否与任何固体方块重叠
    const hw = player.width / 2;  // 半宽
    const min = {
      x: player.position.x - hw,
      y: player.position.y,
      z: player.position.z - hw,
    };
    const max = {
      x: player.position.x + hw,
      y: player.position.y + player.height,
      z: player.position.z + hw,
    };

    // 遍历玩家覆盖的所有方块
    const x0 = Math.floor(min.x), x1 = Math.floor(max.x);
    const y0 = Math.floor(min.y), y1 = Math.floor(max.y);
    const z0 = Math.floor(min.z), z1 = Math.floor(max.z);

    let collided = false;
    for (let x = x0; x <= x1; x++) {
      for (let y = y0; y <= y1; y++) {
        for (let z = z0; z <= z1; z++) {
          if (isSolid(this.world.getBlock(x, y, z))) {
            collided = true;
            break;
          }
        }
        if (collided) break;
      }
      if (collided) break;
    }

    if (collided) {
      // 撤回这一轴的移动
      player.position.x -= dx;
      player.position.y -= dy;
      player.position.z -= dz;

      // 如果是 Y 轴移动且向下，则玩家着地
      if (dy < 0) {
        player.onGround = true;
        player.velocity.y = 0;
      } else if (dy > 0) {
        // 头顶撞到方块
        player.velocity.y = 0;
      } else {
        // 水平方向撞墙：水平速度归零
        player.velocity.x = 0;
        player.velocity.z = 0;
      }
    }
  }
}

export default Physics;
