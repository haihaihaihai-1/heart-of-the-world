// ============================================================
// npc/Guide.js — 向导 NPC「艾尔登长老」
// ------------------------------------------------------------
// 继承自 NPC，使用基础模型即可（已经做成巫师长老外观）。
// 这里只是封装一下，方便后续添加更多 NPC 时区分。
// ============================================================
import { NPC } from './NPC.js';

export class Guide extends NPC {
  constructor(position, story) {
    super('艾尔登长老 · 守望者', position, story);
  }

  // 玩家走近并按 E
  interact() {
    super.interact();
  }
}

export default Guide;
