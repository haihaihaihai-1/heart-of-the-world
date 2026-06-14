// ============================================================
// blocks/Blocks.js — 方块定义表
// ------------------------------------------------------------
// 这里集中定义游戏中所有方块的信息。每个方块有一个数字 ID，
// 以及对应的属性（名称、硬度、是否固体、贴图索引等）。
// 使用数字 ID 是为了性能（数组索引比字符串快得多）。
// ============================================================

// 方块 ID 常量（用名字代替魔法数字，代码更易读）
export const BLOCK = {
  AIR: 0,           // 空气（不可见、可穿过）
  GRASS: 1,         // 草地方块
  DIRT: 2,          // 泥土
  STONE: 3,         // 石头
  SAND: 4,          // 沙子
  WOOD: 5,          // 木头（树干）
  LEAVES: 6,        // 树叶
  WATER: 7,         // 水（半透明、可穿过）
  COAL_ORE: 8,      // 煤矿石
  IRON_ORE: 9,      // 铁矿
  GOLD_ORE: 10,     // 金矿
  DIAMOND_ORE: 11,  // 钻石矿
  SNOW: 12,         // 雪
  BEDROCK: 13,      // 基岩（不可破坏，世界最底层）
  PLANKS: 14,       // 木板（玩家合成）
  HEART_FRAGMENT: 15, // 世界之心碎片（剧情道具，发光）
  CRAFTING_TABLE: 16, // 工作台
};

// ------------------------------------------------------------
// 方块详细定义表
// ------------------------------------------------------------
// textures 字段说明：方块 6 个面的贴图索引 [top, bottom, sides]
//   - 如果 6 面相同，用一个值即可（这里统一用数组）
// textureIndex 指向 Textures.js 中的纹理图集位置
// hardness: 破坏所需时间系数（秒），-1 表示不可破坏
// solid: 是否阻挡玩家移动和视线（水/空气为 false）
// transparent: 是否透明（影响相邻面是否被剔除）
// liquid: 是否液体
// emissive: 是否发光（世界之心碎片）
// ------------------------------------------------------------
export const BLOCKS = {
  [BLOCK.AIR]: {
    name: '空气', solid: false, transparent: true,
    hardness: 0, textures: [], liquid: false
  },
  [BLOCK.GRASS]: {
    name: '草地', solid: true, transparent: false,
    hardness: 0.6,
    textures: { top: 'grass_top', bottom: 'dirt', side: 'grass_side' }
  },
  [BLOCK.DIRT]: {
    name: '泥土', solid: true, transparent: false,
    hardness: 0.5, textures: { all: 'dirt' }
  },
  [BLOCK.STONE]: {
    name: '石头', solid: true, transparent: false,
    hardness: 1.5, textures: { all: 'stone' }
  },
  [BLOCK.SAND]: {
    name: '沙子', solid: true, transparent: false,
    hardness: 0.5, textures: { all: 'sand' }
  },
  [BLOCK.WOOD]: {
    name: '木头', solid: true, transparent: false,
    hardness: 1.0,
    textures: { top: 'wood_top', bottom: 'wood_top', side: 'wood_side' }
  },
  [BLOCK.LEAVES]: {
    name: '树叶', solid: true, transparent: true,  // 半透明，能看到内部
    hardness: 0.2,
    textures: { all: 'leaves' }, transparentAlpha: 0.85
  },
  [BLOCK.WATER]: {
    name: '水', solid: false, transparent: true, liquid: true,
    hardness: -1,
    textures: { all: 'water' }, transparentAlpha: 0.6
  },
  [BLOCK.COAL_ORE]: {
    name: '煤矿石', solid: true, transparent: false,
    hardness: 3.0, textures: { all: 'coal_ore' }
  },
  [BLOCK.IRON_ORE]: {
    name: '铁矿石', solid: true, transparent: false,
    hardness: 3.0, textures: { all: 'iron_ore' }
  },
  [BLOCK.GOLD_ORE]: {
    name: '金矿石', solid: true, transparent: false,
    hardness: 3.0, textures: { all: 'gold_ore' }
  },
  [BLOCK.DIAMOND_ORE]: {
    name: '钻石矿石', solid: true, transparent: false,
    hardness: 4.0, textures: { all: 'diamond_ore' }
  },
  [BLOCK.SNOW]: {
    name: '雪', solid: true, transparent: false,
    hardness: 0.3, textures: { all: 'snow' }
  },
  [BLOCK.BEDROCK]: {
    name: '基岩', solid: true, transparent: false,
    hardness: -1,   // 不可破坏
    textures: { all: 'bedrock' }
  },
  [BLOCK.PLANKS]: {
    name: '木板', solid: true, transparent: false,
    hardness: 1.0, textures: { all: 'planks' }
  },
  [BLOCK.HEART_FRAGMENT]: {
    name: '世界之心碎片', solid: true, transparent: false,
    hardness: 2.0, emissive: true,  // 发光！
    textures: { all: 'heart_fragment' }
  },
  [BLOCK.CRAFTING_TABLE]: {
    name: '工作台', solid: true, transparent: false,
    hardness: 1.0,
    textures: { top: 'craft_top', bottom: 'planks', side: 'craft_side' }
  },
};

// ------------------------------------------------------------
// 工具函数
// ------------------------------------------------------------

// 判断某方块是否为空气（直接比较 ID，最快）
export function isAir(id) {
  return id === BLOCK.AIR;
}

// 判断方块是否固体（用于碰撞检测）
export function isSolid(id) {
  const b = BLOCKS[id];
  return b ? b.solid : false;
}

// 判断方块是否透明（用于面剔除）
export function isTransparent(id) {
  const b = BLOCKS[id];
  return b ? b.transparent : true;
}

// 判断方块是否不可破坏
export function isUnbreakable(id) {
  const b = BLOCKS[id];
  return !b || b.hardness < 0;
}

// 获取方块某面的贴图名称
export function getTextureName(id, face) {
  const def = BLOCKS[id];
  if (!def || !def.textures) return 'stone';
  const t = def.textures;
  if (t.all) return t.all;
  switch (face) {
    case 'top': return t.top || t.all || 'stone';
    case 'bottom': return t.bottom || t.all || 'stone';
    default: return t.side || t.all || 'stone';
  }
}

// 方块列表（用于物品栏等遍历场景）
export const PLACEABLE_BLOCKS = [
  BLOCK.GRASS, BLOCK.DIRT, BLOCK.STONE, BLOCK.SAND,
  BLOCK.WOOD, BLOCK.LEAVES, BLOCK.PLANKS, BLOCK.CRAFTING_TABLE,
];
