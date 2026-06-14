// ============================================================
// game/Chunk.js — 区块（Chunk）类
// ------------------------------------------------------------
// 一个区块是 16×64×16 个方块的集合。所有方块存放在一个
// Uint8Array 中（每个元素是一个方块 ID）。这是最高效的存储
// 方式。
//
// 区块坐标 cx, cz 是区块在水平方向上的索引（不是世界坐标）。
// 世界坐标 = 区块坐标 * 16 + 局部坐标。
// ============================================================
import { WORLD } from '../terrain/TerrainGenerator.js';

export class Chunk {
  constructor(cx, cz) {
    this.cx = cx;
    this.cz = cz;
    const { CHUNK_SIZE, CHUNK_HEIGHT } = WORLD;
    this.size = CHUNK_SIZE;
    this.height = CHUNK_HEIGHT;
    // 方块数据：长度 = 16*64*16 = 16384 字节
    this.blocks = new Uint8Array(CHUNK_SIZE * CHUNK_HEIGHT * CHUNK_SIZE);
    // 区块的网格对象（生成后赋值）
    this.opaqueMesh = null;
    this.transparentMesh = null;
    this.dirty = true;  // 是否需要重建网格
    this.generated = false;
  }

  // 局部坐标 → 数组索引
  _idx(x, y, z) {
    return y * this.size * this.size + z * this.size + x;
  }

  // 获取局部坐标的方块
  get(x, y, z) {
    if (x < 0 || x >= this.size) return 0;
    if (z < 0 || z >= this.size) return 0;
    if (y < 0 || y >= this.height) return 0;
    return this.blocks[this._idx(x, y, z)];
  }

  // 设置局部坐标的方块
  set(x, y, z, id) {
    if (x < 0 || x >= this.size) return;
    if (z < 0 || z >= this.size) return;
    if (y < 0 || y >= this.height) return;
    this.blocks[this._idx(x, y, z)] = id;
    this.dirty = true;
  }

  // 用地形生成器填充区块（不构建网格）
  generate(generator) {
    const baseX = this.cx * this.size;
    const baseZ = this.cz * this.size;
    for (let y = 0; y < this.height; y++) {
      for (let z = 0; z < this.size; z++) {
        for (let x = 0; x < this.size; x++) {
          const id = generator.getBlock(baseX + x, y, baseZ + z);
          this.blocks[this._idx(x, y, z)] = id;
        }
      }
    }
    // 在地表种树
    this._plantTrees(generator);
    this.generated = true;
    this.dirty = true;
  }

  // 在本区块内种树（基于地形生成器的判定）
  _plantTrees(generator) {
    const baseX = this.cx * this.size;
    const baseZ = this.cz * this.size;
    for (let z = 0; z < this.size; z++) {
      for (let x = 0; x < this.size; x++) {
        const wx = baseX + x, wz = baseZ + z;
        const biome = generator.getBiome(wx, wz);
        if (generator.shouldHaveTree(wx, wz, biome)) {
          const h = generator.getHeight(wx, wz);
          if (h + 7 >= this.height) continue;
          // 检查脚下是不是草/沙
          const ground = this.get(x, h, z);
          if (ground === 1 || ground === 4) {  // 草或沙
            const tree = generator.generateTree(wx, h + 1, wz);
            for (const b of tree) {
              const lx = b.x - baseX;
              const lz = b.z - baseZ;
              // 树可能溢出到邻近区块，这里只放本区块内的部分
              if (lx >= 0 && lx < this.size && lz >= 0 && lz < this.size &&
                  b.y >= 0 && b.y < this.height) {
                this.blocks[this._idx(lx, b.y, lz)] = b.id;
              }
            }
          }
        }
      }
    }
  }

  // 释放网格资源（区块卸载时调用，避免显存泄漏）
  dispose() {
    if (this.opaqueMesh) {
      this.opaqueMesh.geometry.dispose();
      this.opaqueMesh = null;
    }
    if (this.transparentMesh) {
      this.transparentMesh.geometry.dispose();
      this.transparentMesh = null;
    }
  }
}

export default Chunk;
