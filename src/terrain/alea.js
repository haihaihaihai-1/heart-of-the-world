// ============================================================
// terrain/alea.js — 轻量级可种子化伪随机数生成器（PRNG）
// ------------------------------------------------------------
// simplex-noise v4 需要外部传入一个返回 [0,1) 的 PRNG 函数。
// 这里实现经典的 alea 算法（基于 Johannes Baagøe 的工作），
// 这样给定同样的种子字符串/数字，每次生成的"随机"序列都
// 完全一致——这是可复现世界生成的关键。
//
// 参考：https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
// ============================================================
export default function alea(seed) {
  // 把种子归一化为字符串
  const s = String(seed);
  // Mash 哈希函数
  let n = 0xefc8249d;
  function mash() {
    let h = 0;
    for (let i = 0; i < s.length; i++) {
      h = (h * 0.10) + s.charCodeAt(i);
      h = h - Math.floor(h);  // 取小数部分
    }
    return h;
  }

  // 初始化三个内部状态
  let a = 0xdeb1ce66;
  let b = 0x9e3779b9;
  let c = 0;
  for (let i = 0; i < 3; i++) {
    n -= mash();
    if (n < 0) n += 1;
    a -= n;
    if (a < 0) a += 4294967296;
    b -= n;
    if (b < 0) b += 4294967296;
  }
  a = a >>> 0;
  b = b >>> 0;
  c = (a + b) >>> 0;
  if (c < 0) c += 4294967296;

  // 返回一个 PRNG 函数（每次调用返回 [0,1)）
  return function () {
    let t = (a * 0x5851f42d4c957f2d + b) >>> 0;
    let u = (a * 0x14057b7ef767814f + c) >>> 0;
    a = t >>> 0;
    b = u >>> 0;
    c = (t ^ u) >>> 0;
    return (a >>> 0) / 4294967296;
  };
}
