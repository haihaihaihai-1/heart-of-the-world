// ============================================================
// blocks/Textures.js — 程序化生成像素贴图（纹理图集）
// ------------------------------------------------------------
// 核心思想：用 Canvas API 在内存中"画"出所有方块的 16×16 像素
// 贴图，然后把它们拼成一张大图（纹理图集/atlas），交给 Three.js
// 作为唯一的纹理使用。这样游戏无需任何外部图片素材即可运行。
//
// 贴图风格：模仿 Minecraft 原版的 16×16 像素方块，用"像素噪点"
// 增加质感（每个像素稍微抖动颜色，避免纯色显得太假）。
// ============================================================
import * as THREE from 'three';

// 单个贴图的像素尺寸（Minecraft 原版是 16×16）
export const TILE_SIZE = 16;

// 图集中每行多少个贴图
const TILES_PER_ROW = 8;

// ------------------------------------------------------------
// 工具函数：基于种子生成伪随机数（保证贴图每次生成相同）
// ------------------------------------------------------------
function makeRng(seed) {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

// ------------------------------------------------------------
// 工具：在 ctx 上画一个像素
// ------------------------------------------------------------
function px(ctx, x, y, color) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, 1, 1);
}

// ------------------------------------------------------------
// 工具：画一个铺满的底色，然后添加噪点（模拟像素纹理）
// ------------------------------------------------------------
function fillNoisy(ctx, baseColor, variants, seed) {
  const rng = makeRng(seed);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = rng();
      if (r < 0.25) px(ctx, x, y, variants[0]);
      else if (r < 0.5) px(ctx, x, y, variants[1]);
      else px(ctx, x, y, baseColor);
    }
  }
}

// ------------------------------------------------------------
// 各方块的绘制函数（每个返回一个 16×16 的 canvas）
// ------------------------------------------------------------

// 草地顶面：绿色像素
function drawGrassTop() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#5a9b3a', ['#4a8a2a', '#6bab4a'], 111);
  return c;
}

// 泥土：棕色
function drawDirt() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#8a5a2b', ['#7a4a1b', '#9a6a3b'], 222);
  return c;
}

// 草地侧面：上面一条草，下面泥土
function drawGrassSide() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  // 先画满泥土
  fillNoisy(ctx, '#8a5a2b', ['#7a4a1b', '#9a6a3b'], 333);
  // 顶部 3-4 行画草色（不规则边缘）
  const rng = makeRng(444);
  const grassDepth = [4, 3, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4, 3, 4, 5, 4];
  for (let x = 0; x < TILE_SIZE; x++) {
    const d = grassDepth[x % grassDepth.length];
    for (let y = 0; y < d; y++) {
      const r = rng();
      const color = r < 0.3 ? '#4a8a2a' : (r < 0.6 ? '#6bab4a' : '#5a9b3a');
      px(ctx, x, y, color);
    }
  }
  return c;
}

// 石头：灰色
function drawStone() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#888888', ['#777777', '#999999'], 555);
  // 加几个深色裂纹点
  const rng = makeRng(666);
  for (let i = 0; i < 8; i++) {
    px(ctx, Math.floor(rng() * 16), Math.floor(rng() * 16), '#666666');
  }
  return c;
}

// 沙子：浅黄
function drawSand() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#e6d39b', ['#d6c38b', '#f6e3ab'], 777);
  return c;
}

// 木头侧面：树皮纹理
function drawWoodSide() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  // 垂直纹理的棕色
  const rng = makeRng(888);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = rng();
      // 偶尔有竖直的深色条纹（树皮）
      if (x === 3 || x === 8 || x === 12) {
        px(ctx, x, y, r < 0.5 ? '#4a3520' : '#5a4530');
      } else {
        px(ctx, x, y, r < 0.3 ? '#5a4530' : (r < 0.6 ? '#7a5530' : '#6a4a30'));
      }
    }
  }
  return c;
}

// 木头顶/底：年轮
function drawWoodTop() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  const rng = makeRng(999);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = rng();
      // 计算到中心的距离（年轮效果）
      const dx = x - 7.5, dy = y - 7.5;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const ring = Math.floor(dist) % 2;
      px(ctx, x, y, ring === 0 ? '#8a6535' : (r < 0.3 ? '#7a5525' : '#9a7545'));
    }
  }
  return c;
}

// 树叶：深绿带透明感
function drawLeaves() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#3a7a2a', ['#2a6a1a', '#4a8a3a'], 1010);
  // 加一些深色斑点（叶子层次）
  const rng = makeRng(1111);
  for (let i = 0; i < 12; i++) {
    px(ctx, Math.floor(rng() * 16), Math.floor(rng() * 16), '#1a4a0a');
  }
  return c;
}

// 水：蓝色半透明
function drawWater() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#2a6ada', ['#1a5aca', '#3a7aea'], 1212);
  return c;
}

// 各种矿石：在石头底色上加矿物斑点
function drawOre(spotsColor, spotColor2, seed) {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  // 先画石头底
  fillNoisy(ctx, '#888888', ['#777777', '#999999'], 555);
  // 加矿物斑点
  const rng = makeRng(seed);
  for (let i = 0; i < 14; i++) {
    const x = Math.floor(rng() * 14) + 1;
    const y = Math.floor(rng() * 14) + 1;
    px(ctx, x, y, rng() < 0.5 ? spotsColor : spotColor2);
    // 偶尔画 2x2 的矿块
    if (rng() < 0.3) {
      px(ctx, x + 1, y, spotColor2);
      px(ctx, x, y + 1, spotColor2);
    }
  }
  return c;
}

// 雪：白色
function drawSnow() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#f0f0f5', ['#e0e0e5', '#ffffff'], 1414);
  return c;
}

// 基岩：深灰带黑色斑点
function drawBedrock() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#555555', ['#333333', '#666666'], 1515);
  const rng = makeRng(1616);
  for (let i = 0; i < 10; i++) {
    px(ctx, Math.floor(rng() * 16), Math.floor(rng() * 16), '#222222');
  }
  return c;
}

// 木板：横纹
function drawPlanks() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  const rng = makeRng(1717);
  for (let y = 0; y < TILE_SIZE; y++) {
    for (let x = 0; x < TILE_SIZE; x++) {
      const r = rng();
      // 每隔 4 行有一条接缝（深色）
      if (y % 4 === 3) {
        px(ctx, x, y, '#5a4520');
      } else {
        px(ctx, x, y, r < 0.3 ? '#8a6535' : (r < 0.6 ? '#9a7545' : '#7a5535'));
      }
    }
  }
  return c;
}

// 世界之心碎片：粉色发光，带心形图案
function drawHeartFragment() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  // 粉色发光底
  fillNoisy(ctx, '#ff5599', ['#ff77bb', '#ff3377'], 1818);
  // 中心画一个像素心形
  const heart = [
    [0,1,1,0,1,1,0],
    [1,1,1,1,1,1,1],
    [1,1,1,1,1,1,1],
    [0,1,1,1,1,1,0],
    [0,0,1,1,1,0,0],
    [0,0,0,1,0,0,0],
  ];
  const ox = 5, oy = 4;
  for (let y = 0; y < heart.length; y++) {
    for (let x = 0; x < heart[y].length; x++) {
      if (heart[y][x]) px(ctx, ox + x, oy + y, '#ffffff');
    }
  }
  // 闪光点
  const rng = makeRng(1919);
  for (let i = 0; i < 6; i++) {
    px(ctx, Math.floor(rng() * 16), Math.floor(rng() * 16), '#ffffaa');
  }
  return c;
}

// 工作台顶面
function drawCraftTop() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  // 木板底
  fillNoisy(ctx, '#8a6535', ['#7a5535', '#9a7545'], 2020);
  // 画一个网格（工作台标志）
  ctx.fillStyle = '#3a2515';
  for (let i = 0; i < 16; i++) {
    px(ctx, i, 5, '#3a2515');
    px(ctx, i, 10, '#3a2515');
    px(ctx, 5, i, '#3a2515');
    px(ctx, 10, i, '#3a2515');
  }
  return c;
}

// 工作台侧面
function drawCraftSide() {
  const c = document.createElement('canvas');
  c.width = c.height = TILE_SIZE;
  const ctx = c.getContext('2d');
  fillNoisy(ctx, '#9a7545', ['#8a6535', '#aa8555'], 2121);
  // 画工具图案（简单两条竖线代表工具）
  ctx.fillStyle = '#5a4520';
  for (let y = 4; y < 12; y++) {
    px(ctx, 5, y, '#5a4520');
    px(ctx, 10, y, '#5a4520');
  }
  return c;
}

// ------------------------------------------------------------
// 所有贴图定义（名字 -> 绘制函数）
// ------------------------------------------------------------
const TEXTURE_DEFS = {
  grass_top: drawGrassTop,
  dirt: drawDirt,
  grass_side: drawGrassSide,
  stone: drawStone,
  sand: drawSand,
  wood_side: drawWoodSide,
  wood_top: drawWoodTop,
  leaves: drawLeaves,
  water: drawWater,
  coal_ore: () => drawOre('#1a1a1a', '#333333', 3131),
  iron_ore: () => drawOre('#c9a079', '#a98059', 3232),
  gold_ore: () => drawOre('#fcee4b', '#dace3b', 3333),
  diamond_ore: () => drawOre('#4eece0', '#2dcac0', 3434),
  snow: drawSnow,
  bedrock: drawBedrock,
  planks: drawPlanks,
  heart_fragment: drawHeartFragment,
  craft_top: drawCraftTop,
  craft_side: drawCraftSide,
};

// ------------------------------------------------------------
// 构建纹理图集（一张大图，包含所有方块贴图）
// ------------------------------------------------------------
// 返回：{ texture: THREE.Texture, uvMap: { 名字 -> [u0,v0,u1,v1] } }
let _atlasCache = null;

export function buildAtlas() {
  if (_atlasCache) return _atlasCache;

  const names = Object.keys(TEXTURE_DEFS);
  const count = names.length;
  const rows = Math.ceil(count / TILES_PER_ROW);
  const atlasW = TILES_PER_ROW * TILE_SIZE;
  const atlasH = rows * TILE_SIZE;

  // 创建图集画布
  const atlas = document.createElement('canvas');
  atlas.width = atlasW;
  atlas.height = atlasH;
  const ctx = atlas.getContext('2d');
  ctx.imageSmoothingEnabled = false;  // 关闭平滑，保持像素风

  // 逐个绘制贴图到图集
  const uvMap = {};
  names.forEach((name, i) => {
    const col = i % TILES_PER_ROW;
    const row = Math.floor(i / TILES_PER_ROW);
    const tile = TEXTURE_DEFS[name]();
    ctx.drawImage(tile, col * TILE_SIZE, row * TILE_SIZE);
    // 计算 UV 坐标（留 0.5 像素的边距避免接缝）
    const pad = 0.5 / atlasW;
    uvMap[name] = {
      u0: (col * TILE_SIZE) / atlasW + pad,
      v0: 1 - ((row + 1) * TILE_SIZE) / atlasH + pad,
      u1: ((col + 1) * TILE_SIZE) / atlasW - pad,
      v1: 1 - (row * TILE_SIZE) / atlasH - pad,
      index: i
    };
  });

  // 转换为 Three.js 纹理
  const texture = new THREE.CanvasTexture(atlas);
  texture.magFilter = THREE.NearestFilter;  // 像素风：最近邻过滤
  texture.minFilter = THREE.NearestMipmapNearestFilter;
  texture.generateMipmaps = true;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 1;

  _atlasCache = { texture, uvMap, atlas, names };
  return _atlasCache;
}

// 获取贴图 UV（按名字）
export function getTileUV(name) {
  const { uvMap } = buildAtlas();
  return uvMap[name] || uvMap['stone'];
}
