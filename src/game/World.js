// ============================================================
// game/World.js — 世界管理器
// ------------------------------------------------------------
// 负责管理所有区块：加载玩家附近的、卸载远处的。
// 同时维护一个"玩家修改过的方块"记录，确保动态加载/卸载
// 区块时，玩家的改动不丢失。
// ============================================================
import * as THREE from 'three';
import { Chunk } from './Chunk.js';
import { TerrainGenerator, WORLD } from '../terrain/TerrainGenerator.js';
import { buildChunkGeometry } from '../terrain/Mesher.js';
import { BLOCK, isSolid } from '../blocks/Blocks.js';
import { buildAtlas } from '../blocks/Textures.js';

// 玩家周围渲染半径（区块数）。4 = 9x9=81 个区块
const RENDER_RADIUS = 4;

export class World {
  constructor(scene, seed = 1337) {
    this.scene = scene;
    this.generator = new TerrainGenerator(seed);
    this.chunks = new Map();  // "cx,cz" -> Chunk
    // 玩家修改过的方块（key: "x,y,z" -> blockId）
    this.edits = new Map();
    // 特殊方块（任务道具：世界之心碎片位置）
    this.specialBlocks = new Map();

    // 准备共享材质（所有区块用同一张纹理图集）
    const { texture } = buildAtlas();
    this.atlasTexture = texture;
    this.opaqueMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      side: THREE.FrontSide,
    });
    this.transparentMaterial = new THREE.MeshLambertMaterial({
      map: texture,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      side: THREE.DoubleSide,
      depthWrite: false,
    });

    // 玩家上次所在的区块（用于判断是否需要重新加载）
    this.lastPlayerChunk = { x: NaN, z: NaN };
  }

  // ----------------------------------------------------------
  // 全局坐标 → 区块坐标
  // ----------------------------------------------------------
  worldToChunk(wx, wz) {
    return {
      cx: Math.floor(wx / WORLD.CHUNK_SIZE),
      cz: Math.floor(wz / WORLD.CHUNK_SIZE),
    };
  }

  // ----------------------------------------------------------
  // 获取世界坐标的方块 ID（处理跨区块查询）
  // ----------------------------------------------------------
  getBlock(x, y, z) {
    if (y < 0 || y >= WORLD.CHUNK_HEIGHT) return BLOCK.AIR;
    const { cx, cz } = this.worldToChunk(x, z);
    const key = `${cx},${cz}`;
    const chunk = this.chunks.get(key);
    if (!chunk || !chunk.generated) return BLOCK.AIR;
    const lx = x - cx * WORLD.CHUNK_SIZE;
    const lz = z - cz * WORLD.CHUNK_SIZE;
    return chunk.get(lx, y, lz);
  }

  // ----------------------------------------------------------
  // 设置世界坐标的方块（玩家破坏/放置）
  // ----------------------------------------------------------
  setBlock(x, y, z, id) {
    if (y < 0 || y >= WORLD.CHUNK_HEIGHT) return false;
    const { cx, cz } = this.worldToChunk(x, z);
    const key = `${cx},${cz}`;
    const chunk = this.chunks.get(key);
    if (!chunk) return false;
    const lx = x - cx * WORLD.CHUNK_SIZE;
    const lz = z - cz * WORLD.CHUNK_SIZE;
    chunk.set(lx, y, lz, id);
    // 记录玩家的修改
    this.edits.set(`${x},${y},${z}`, id);

    // 标记邻居区块也需要重建（如果是边界方块）
    this._markNeighborDirty(chunk, lx, lz);

    return true;
  }

  // 边界方块的修改会影响邻居区块的网格
  _markNeighborDirty(chunk, lx, lz) {
    const candidates = [];
    if (lx === 0) candidates.push([chunk.cx - 1, chunk.cz]);
    if (lx === WORLD.CHUNK_SIZE - 1) candidates.push([chunk.cx + 1, chunk.cz]);
    if (lz === 0) candidates.push([chunk.cx, chunk.cz - 1]);
    if (lz === WORLD.CHUNK_SIZE - 1) candidates.push([chunk.cx, chunk.cz + 1]);
    for (const [cx, cz] of candidates) {
      const c = this.chunks.get(`${cx},${cz}`);
      if (c) c.dirty = true;
    }
  }

  // ----------------------------------------------------------
  // 获取/创建区块（只填充方块数据，不构建网格）
  // ----------------------------------------------------------
  ensureChunk(cx, cz) {
    const key = `${cx},${cz}`;
    let chunk = this.chunks.get(key);
    if (!chunk) {
      chunk = new Chunk(cx, cz);
      this.chunks.set(key, chunk);
    }
    if (!chunk.generated) {
      chunk.generate(this.generator);
      // 应用玩家之前的修改
      this._applyEdits(chunk);
      // 放置特殊方块（任务道具）
      this._placeSpecials(chunk);
    }
    return chunk;
  }

  // 应用此区块内被玩家修改过的方块
  _applyEdits(chunk) {
    const baseX = chunk.cx * WORLD.CHUNK_SIZE;
    const baseZ = chunk.cz * WORLD.CHUNK_SIZE;
    for (const [key, id] of this.edits) {
      const [x, y, z] = key.split(',').map(Number);
      const { cx, cz } = this.worldToChunk(x, z);
      if (cx === chunk.cx && cz === chunk.cz) {
        chunk.set(x - baseX, y, z - baseZ, id);
      }
    }
  }

  // 放置特殊方块（世界之心碎片等剧情道具）
  _placeSpecials(chunk) {
    const baseX = chunk.cx * WORLD.CHUNK_SIZE;
    const baseZ = chunk.cz * WORLD.CHUNK_SIZE;
    for (const [key, info] of this.specialBlocks) {
      const [x, y, z] = key.split(',').map(Number);
      const { cx, cz } = this.worldToChunk(x, z);
      if (cx === chunk.cx && cz === chunk.cz) {
        chunk.set(x - baseX, y, z - baseZ, info.id);
      }
    }
  }

  // 添加特殊方块（任务系统调用）
  addSpecialBlock(x, y, z, id, meta = {}) {
    this.specialBlocks.set(`${x},${y},${z}`, { id, ...meta });
    this.setBlock(x, y, z, id);
  }

  // ----------------------------------------------------------
  // 重建区块网格
  // ----------------------------------------------------------
  rebuildChunk(chunk) {
    // 删除旧网格
    if (chunk.opaqueMesh) {
      this.scene.remove(chunk.opaqueMesh);
      chunk.opaqueMesh.geometry.dispose();
      chunk.opaqueMesh = null;
    }
    if (chunk.transparentMesh) {
      this.scene.remove(chunk.transparentMesh);
      chunk.transparentMesh.geometry.dispose();
      chunk.transparentMesh = null;
    }

    // 构建新网格
    const { opaque, transparent } = buildChunkGeometry(chunk, (x, y, z) => this.getBlock(x, y, z));

    if (opaque.index && opaque.attributes.position) {
      const mesh = new THREE.Mesh(opaque, this.opaqueMaterial);
      mesh.frustumCulled = true;
      chunk.opaqueMesh = mesh;
      this.scene.add(mesh);
    }
    if (transparent.index && transparent.attributes.position) {
      const mesh = new THREE.Mesh(transparent, this.transparentMaterial);
      mesh.frustumCulled = true;
      mesh.renderOrder = 1;
      chunk.transparentMesh = mesh;
      this.scene.add(mesh);
    }
    chunk.dirty = false;
  }

  // ----------------------------------------------------------
  // 每帧调用：根据玩家位置加载/卸载区块
  // ----------------------------------------------------------
  update(playerX, playerZ) {
    const { cx, cz } = this.worldToChunk(
      Math.floor(playerX), Math.floor(playerZ)
    );

    // 加载/生成附近区块
    for (let dz = -RENDER_RADIUS; dz <= RENDER_RADIUS; dz++) {
      for (let dx = -RENDER_RADIUS; dx <= RENDER_RADIUS; dx++) {
        // 圆形渲染范围（比方形更省）
        if (dx * dx + dz * dz > RENDER_RADIUS * RENDER_RADIUS) continue;
        const chunk = this.ensureChunk(cx + dx, cz + dz);
        if (chunk.dirty) {
          this.rebuildChunk(chunk);
        }
      }
    }

    // 卸载远处的区块
    const maxDist = RENDER_RADIUS + 2;
    for (const [key, chunk] of this.chunks) {
      const ddx = chunk.cx - cx;
      const ddz = chunk.cz - cz;
      if (Math.abs(ddx) > maxDist || Math.abs(ddz) > maxDist) {
        chunk.dispose();
        if (chunk.opaqueMesh) this.scene.remove(chunk.opaqueMesh);
        if (chunk.transparentMesh) this.scene.remove(chunk.transparentMesh);
        this.chunks.delete(key);
      }
    }
  }

  // ----------------------------------------------------------
  // 查找地表高度（用于放置玩家/NPC/碎片）
  // ----------------------------------------------------------
  findSurfaceY(x, z) {
    const height = this.generator.getHeight(x, z);
    return Math.max(height + 1, WORLD.SEA_LEVEL + 1);
  }

  // ----------------------------------------------------------
  // 射线检测第一个实体方块（破坏/放置用）
  // ----------------------------------------------------------
  raycast(origin, direction, maxDistance = 6) {
    // 用快速体素遍历算法（Amanatides & Woo）
    let x = Math.floor(origin.x);
    let y = Math.floor(origin.y);
    let z = Math.floor(origin.z);

    const stepX = Math.sign(direction.x);
    const stepY = Math.sign(direction.y);
    const stepZ = Math.sign(direction.z);

    // 到下一个方块边界的距离
    const tDeltaX = stepX !== 0 ? Math.abs(1 / direction.x) : Infinity;
    const tDeltaY = stepY !== 0 ? Math.abs(1 / direction.y) : Infinity;
    const tDeltaZ = stepZ !== 0 ? Math.abs(1 / direction.z) : Infinity;

    let tMaxX = stepX !== 0 ?
      (stepX > 0 ? (x + 1 - origin.x) : (origin.x - x)) * Math.abs(1 / direction.x) : Infinity;
    let tMaxY = stepY !== 0 ?
      (stepY > 0 ? (y + 1 - origin.y) : (origin.y - y)) * Math.abs(1 / direction.y) : Infinity;
    let tMaxZ = stepZ !== 0 ?
      (stepZ > 0 ? (z + 1 - origin.z) : (origin.z - z)) * Math.abs(1 / direction.z) : Infinity;

    let face = null;
    let t = 0;
    while (t <= maxDistance) {
      const id = this.getBlock(x, y, z);
      if (isSolid(id) || id === BLOCK.HEART_FRAGMENT) {
        return { x, y, z, face, id };
      }
      // 步进到下一个方块
      if (tMaxX < tMaxY && tMaxX < tMaxZ) {
        x += stepX; t = tMaxX; tMaxX += tDeltaX;
        face = [-stepX, 0, 0];
      } else if (tMaxY < tMaxZ) {
        y += stepY; t = tMaxY; tMaxY += tDeltaY;
        face = [0, -stepY, 0];
      } else {
        z += stepZ; t = tMaxZ; tMaxZ += tDeltaZ;
        face = [0, 0, -stepZ];
      }
    }
    return null;
  }

  // 释放所有资源
  dispose() {
    for (const chunk of this.chunks.values()) {
      chunk.dispose();
    }
    this.chunks.clear();
  }
}

export default World;
