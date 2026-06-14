// ============================================================
// terrain/TerrainGenerator.js — 程序化地形生成器
// ------------------------------------------------------------
// 使用 Simplex 噪声生成自然的地形高度、生物群系、洞穴、矿石、
// 树木等。给定同样的"种子"，每次生成的世界完全相同。
//
// 核心算法：
//  1. 用 2D 噪声生成"高度图"（哪里高哪里低）—— 形成山丘
//  2. 用另一个 2D 噪声决定"生物群系"（草原/沙漠/雪原）
//  3. 用 3D 噪声生成洞穴（密度低于阈值的方块变空）
//  4. 按高度和噪声放置矿石（深层有钻石，浅层有煤）
//  5. 在草地表面随机种树
// ============================================================
import { createNoise2D, createNoise3D } from 'simplex-noise';
import alea from './alea.js';  // 轻量级可种子化 PRNG
import { BLOCK } from '../blocks/Blocks.js';

// 世界常量
export const WORLD = {
  CHUNK_SIZE: 16,     // 区块边长（方块）
  CHUNK_HEIGHT: 64,   // 世界高度（方块）
  SEA_LEVEL: 24,      // 海平面高度（低于此的空气填水）
  BEDROCK_LEVEL: 0,   // 基岩层
};

// 生物群系
export const BIOME = {
  PLAINS: 'plains',     // 草原
  FOREST: 'forest',     // 森林
  DESERT: 'desert',     // 沙漠
  SNOW: 'snow',         // 雪原
};

// ------------------------------------------------------------
// 地形生成器类
// ------------------------------------------------------------
export class TerrainGenerator {
  constructor(seed = 1337) {
    // 用种子初始化多个噪声场（每个用途独立，互不干扰）
    const rng1 = alea(seed);
    const rng2 = alea(seed + 1);
    const rng3 = alea(seed + 2);
    const rng4 = alea(seed + 3);
    const rng5 = alea(seed + 4);
    const rng6 = alea(seed + 5);

    this.noiseHeight = createNoise2D(rng1);    // 地形高度
    this.noiseDetail = createNoise2D(rng2);    // 高频细节
    this.noiseBiome = createNoise2D(rng3);     // 生物群系
    this.noiseTemp = createNoise2D(rng4);      // 温度（决定沙漠/雪）
    this.noiseCave = createNoise3D(rng5);      // 3D 洞穴
    this.noiseOre = createNoise3D(rng6);       // 矿石分布

    this.seed = seed;
    // 树木分布表（同一坐标总是产生相同结果）
    this._treeRng = alea(seed + 100);
  }

  // ----------------------------------------------------------
  // 获取某列(x,z)的地表高度（基础地形 + 细节）
  // ----------------------------------------------------------
  getHeight(x, z) {
    // 大尺度高度（低频）—— 决定基本起伏
    const base = this.noiseHeight(x * 0.008, z * 0.008);  // [-1,1]
    // 小尺度细节（高频）—— 添加小山丘
    const detail = this.noiseDetail(x * 0.03, z * 0.03);
    // 组合：基础高度 + 细节
    let h = WORLD.SEA_LEVEL + base * 12 + detail * 4;
    return Math.floor(h);
  }

  // ----------------------------------------------------------
  // 获取生物群系
  // ----------------------------------------------------------
  getBiome(x, z) {
    const temp = this.noiseTemp(x * 0.004, z * 0.004);   // 温度 [-1,1]
    const moist = this.noiseBiome(x * 0.006, z * 0.006); // 湿度 [-1,1]

    if (temp < -0.4) return BIOME.SNOW;        // 冷 → 雪
    if (temp > 0.3 && moist < -0.1) return BIOME.DESERT; // 热+干 → 沙漠
    if (moist > 0.2) return BIOME.FOREST;      // 湿 → 森林
    return BIOME.PLAINS;                        // 默认草原
  }

  // ----------------------------------------------------------
  // 判断某坐标是否应该生成洞穴
  // ----------------------------------------------------------
  isCave(x, y, z) {
    if (y < 3 || y > WORLD.SEA_LEVEL + 8) return false;
    const n = this.noiseCave(x * 0.05, y * 0.05, z * 0.05);
    return n > 0.55;  // 阈值：高于此值的地方变空气（挖空）
  }

  // ----------------------------------------------------------
  // 判断某坐标应该放什么矿石（按深度和噪声）
  // ----------------------------------------------------------
  getOre(x, y, z) {
    if (y > 28) return null;
    const n = this.noiseOre(x * 0.1, y * 0.1, z * 0.1);
    // 钻石：极深且噪声高
    if (y < 10 && n > 0.75) return BLOCK.DIAMOND_ORE;
    // 金矿：较深
    if (y < 18 && n > 0.7) return BLOCK.GOLD_ORE;
    // 铁矿：中等深度
    if (y < 25 && n > 0.65) return BLOCK.IRON_ORE;
    // 煤矿：到处都有
    if (n > 0.6) return BLOCK.COAL_ORE;
    return null;
  }

  // ----------------------------------------------------------
  // 判断某列(x,z)是否应该种树（确定性，基于坐标）
  // ----------------------------------------------------------
  shouldHaveTree(x, z, biome) {
    if (biome === BIOME.DESERT) return false;
    // 用坐标作为种子的伪随机
    const r = this._hash2D(x, z, 98765);
    if (biome === BIOME.FOREST) return r < 0.08;  // 森林：8% 概率
    if (biome === BIOME.SNOW) return r < 0.02;
    return r < 0.02;  // 草原：2% 概率
  }

  // 简单的 2D 哈希到 [0,1)
  _hash2D(x, z, salt) {
    let h = (x * 374761393 + z * 668265263 + salt * 2147483647) >>> 0;
    h = (h ^ (h >>> 13)) * 1274126177;
    return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
  }

  // ----------------------------------------------------------
  // 生成单个方块：给定世界坐标，返回方块 ID
  // ----------------------------------------------------------
  getBlock(x, y, z) {
    // 世界底部是基岩
    if (y <= WORLD.BEDROCK_LEVEL) return BLOCK.BEDROCK;
    if (y >= WORLD.CHUNK_HEIGHT) return BLOCK.AIR;

    const height = this.getHeight(x, z);
    const biome = this.getBiome(x, z);

    // 先判断是否在洞穴里
    if (this.isCave(x, y, z)) {
      // 洞穴内不填充（除非低于海平面且有水逻辑）
      if (y <= WORLD.SEA_LEVEL) return BLOCK.WATER;  // 洞穴水
      return BLOCK.AIR;
    }

    // 在地表以下 → 石头/矿石
    if (y < height) {
      // 最底层几格保证是基岩（玩家无法挖穿世界）
      if (y < 3) {
        return this._hash2D(x, z, y) < 0.5 ? BLOCK.BEDROCK : BLOCK.STONE;
      }
      // 矿石
      const ore = this.getOre(x, y, z);
      if (ore !== null) return ore;
      return BLOCK.STONE;
    }

    // 在地表高度 → 表层方块（草/沙/雪）
    if (y === height) {
      if (biome === BIOME.DESERT) return BLOCK.SAND;
      if (biome === BIOME.SNOW) return BLOCK.SNOW;
      return BLOCK.GRASS;
    }

    // 紧贴地表下 1-3 层
    if (y < height + 0 && y > height - 3) {
      if (biome === BIOME.DESERT) return BLOCK.SAND;
      if (biome === BIOME.SNOW) return BLOCK.SNOW;
      return BLOCK.DIRT;
    }

    // 在海平面以下、地表以上的空气 → 填水
    if (y <= WORLD.SEA_LEVEL) return BLOCK.WATER;

    return BLOCK.AIR;
  }

  // ----------------------------------------------------------
  // 生成一棵树的方块列表（返回相对坐标和方块 ID）
  // 调用者负责把这些方块写进区块
  // ----------------------------------------------------------
  generateTree(worldX, worldY, worldZ) {
    const blocks = [];
    // 树干高度 4-6 格
    const trunkH = 4 + Math.floor(this._hash2D(worldX, worldZ, 555) * 3);

    // 树干
    for (let i = 0; i < trunkH; i++) {
      blocks.push({ x: worldX, y: worldY + i, z: worldZ, id: BLOCK.WOOD });
    }
    // 树冠：球形树叶
    const top = worldY + trunkH;
    for (let dy = -1; dy <= 2; dy++) {
      const r = dy <= 0 ? 2 : 1;  // 下层大上层小
      for (let dx = -r; dx <= r; dx++) {
        for (let dz = -r; dz <= r; dz++) {
          if (dx === 0 && dz === 0 && dy < 2) continue;  // 树干位置不放叶
          const dist = Math.sqrt(dx * dx + dz * dz + dy * dy * 0.7);
          if (dist <= r + 0.5) {
            // 边缘随机剪掉一些，让树看起来自然
            if (this._hash2D(worldX + dx, worldZ + dz, dy * 100) < 0.85) {
              blocks.push({ x: worldX + dx, y: top + dy, z: worldZ + dz, id: BLOCK.LEAVES });
            }
          }
        }
      }
    }
    return blocks;
  }
}

export default TerrainGenerator;
