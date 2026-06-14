// ============================================================
// terrain/Mesher.js — 区块网格构建器（面剔除法）
// ------------------------------------------------------------
// 这是性能关键文件。一个 16×64×16 的区块最多有 16384 个方块，
// 如果每个方块画 6 个面就是 10 万个面——会很卡。
//
// 面剔除的核心思想：
//   只渲染「暴露在空气或透明方块旁」的面。
//   一个方块如果它的 6 个邻居都是固体不透明方块，
//   那它所有面都被挡住了，完全不需要画。
//
// 对于每个可见面，我们写入：
//   - 4 个顶点（position 属性）
//   - 4 个法线（normal 属性）
//   - 4 个 UV 坐标（uv 属性，指向纹理图集中的对应贴图）
//   - 6 个顶点索引（组成 2 个三角形）
// ============================================================
import * as THREE from 'three';
import { getTextureName, isTransparent } from '../blocks/Blocks.js';
import { getTileUV } from '../blocks/Textures.js';
import { WORLD } from './TerrainGenerator.js';

// 6 个面的定义：方向 + 法线 + 4 个顶点的相对位置
// 顶点顺序：从面的"外侧"看，逆时针（符合 WebGL 默认的正面）
const FACES = [
  { // +X（右面）
    dir: [1, 0, 0],
    normal: [1, 0, 0],
    corners: [
      [1, 1, 0], [1, 0, 0], [1, 1, 1], [1, 0, 1]
    ],
  },
  { // -X（左面）
    dir: [-1, 0, 0],
    normal: [-1, 0, 0],
    corners: [
      [0, 1, 1], [0, 0, 1], [0, 1, 0], [0, 0, 0]
    ],
  },
  { // +Y（顶面）
    dir: [0, 1, 0],
    normal: [0, 1, 0],
    corners: [
      [0, 1, 1], [1, 1, 1], [0, 1, 0], [1, 1, 0]
    ],
  },
  { // -Y（底面）
    dir: [0, -1, 0],
    normal: [0, -1, 0],
    corners: [
      [1, 0, 1], [0, 0, 1], [1, 0, 0], [0, 0, 0]
    ],
  },
  { // +Z（前面）
    dir: [0, 0, 1],
    normal: [0, 0, 1],
    corners: [
      [0, 1, 0], [1, 1, 0], [0, 1, 1], [1, 1, 1]
    ],
  },
  { // -Z（后面）
    dir: [0, 0, -1],
    normal: [0, 0, -1],
    corners: [
      [1, 1, 1], [0, 1, 1], [1, 1, 0], [0, 1, 0]
    ],
  },
];

// 面名称（用于查找贴图：top/bottom/side）
const FACE_NAME = ['side', 'side', 'top', 'bottom', 'side', 'side'];

// UV 顺序：对应上面 corners 的 4 个顶点
// (u0,v0)=左下 (u1,v0)=右下 (u0,v1)=左上 (u1,v1)=右上
// 这里 corners 顺序是 [上, 下, 上, 下]，所以 UV 也要对应
const UV_PATTERN = [
  [0, 1], [0, 0], [1, 1], [1, 0]  // 对应 [左上, 左下, 右上, 右下]
];

// ------------------------------------------------------------
// 构建一个区块的几何体
// ------------------------------------------------------------
// 参数：
//   chunk: Chunk 对象（提供 getBlockLocal 和世界坐标基址）
//   getBlockGlobal(x,y,z): 获取世界坐标方块（处理跨区块查询）
// 返回：THREE.BufferGeometry（不透明）和 THREE.BufferGeometry（透明/水）
// ------------------------------------------------------------
export function buildChunkGeometry(chunk, getBlockGlobal) {
  const { CHUNK_SIZE, CHUNK_HEIGHT } = WORLD;
  const baseX = chunk.cx * CHUNK_SIZE;
  const baseZ = chunk.cz * CHUNK_SIZE;

  // 不透明方块的顶点数据
  const opaque = {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],     // 用顶点色实现简单光照
    indices: [],
    indexOffset: 0,
  };
  // 透明方块（水/树叶/世界之心碎片）单独一个 mesh
  const transparent = {
    positions: [],
    normals: [],
    uvs: [],
    colors: [],
    indices: [],
    indexOffset: 0,
  };

  // 遍历区块内的每个方块
  for (let y = 0; y < CHUNK_HEIGHT; y++) {
    for (let z = 0; z < CHUNK_SIZE; z++) {
      for (let x = 0; x < CHUNK_SIZE; x++) {
        const blockId = chunk.get(x, y, z);
        if (blockId === 0) continue;  // 空气跳过

        const wx = baseX + x;
        const wy = y;
        const wz = baseZ + z;

        const blockDef = { id: blockId, transparent: isTransparent(blockId) };
        const target = blockDef.transparent ? transparent : opaque;

        // 遍历 6 个面
        for (let f = 0; f < 6; f++) {
          const face = FACES[f];
          const nx = wx + face.dir[0];
          const ny = wy + face.dir[1];
          const nz = wz + face.dir[2];

          // 查询邻居方块
          const neighborId = getBlockGlobal(nx, ny, nz);

          // 面剔除规则：
          // - 如果邻居是不透明固体 → 这个面被挡住，跳过
          // - 如果邻居是同种透明方块（如水接水） → 跳过
          // - 否则渲染这个面
          if (isTransparent(neighborId)) {
            if (neighborId === blockId && blockDef.transparent) {
              continue;  // 水接水/叶接叶：不画
            }
          } else {
            continue;  // 邻居不透明：挡住了
          }

          // 这个面要画！
          // 1. 找到对应贴图
          const texName = getTextureName(blockId, FACE_NAME[f]);
          const uv = getTileUV(texName);

          // 2. 写入 4 个顶点
          for (let c = 0; c < 4; c++) {
            const corner = face.corners[c];
            target.positions.push(
              wx + corner[0],
              wy + corner[1],
              wz + corner[2]
            );
            target.normals.push(face.normal[0], face.normal[1], face.normal[2]);

            // UV（根据图集中贴图的范围插值）
            const up = UV_PATTERN[c];
            target.uvs.push(
              uv.u0 + (uv.u1 - uv.u0) * up[0],
              uv.v0 + (uv.v1 - uv.v0) * up[1]
            );

            // 简单的方向光照（顶面最亮，底面最暗）
            // 这样不依赖灯光就能看出立体感
            let light = 0.7;
            if (f === 2) light = 1.0;       // 顶面
            else if (f === 3) light = 0.5;  // 底面
            else if (f === 0 || f === 1) light = 0.8;  // 左右
            else light = 0.85;              // 前后

            // 世界之心碎片发光：所有面都很亮
            if (blockId === 15) light = 1.3;

            target.colors.push(light, light, light);
          }

          // 3. 写入 2 个三角形（6 个索引）
          const io = target.indexOffset;
          target.indices.push(io, io + 1, io + 2, io + 2, io + 1, io + 3);
          target.indexOffset += 4;
        }
      }
    }
  }

  return {
    opaque: arrayToGeometry(opaque),
    transparent: arrayToGeometry(transparent),
  };
}

// ------------------------------------------------------------
// 把数据数组转换成 Three.js BufferGeometry
// ------------------------------------------------------------
function arrayToGeometry(data) {
  const geo = new THREE.BufferGeometry();
  if (data.indices.length === 0) return geo;  // 空几何体

  geo.setAttribute('position', new THREE.Float32BufferAttribute(data.positions, 3));
  geo.setAttribute('normal', new THREE.Float32BufferAttribute(data.normals, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(data.uvs, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(data.colors, 3));
  geo.setIndex(data.indices);
  geo.computeBoundingSphere();  // 用于视锥剔除
  return geo;
}
