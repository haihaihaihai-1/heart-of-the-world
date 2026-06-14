// ============================================================
// story/Quests.js — 任务数据
// ------------------------------------------------------------
// 定义所有任务的目标、奖励、解锁条件。
// 数据驱动设计：要加新任务，只需在 QUESTS 里加一条数据。
// ============================================================

// 任务 ID 常量
export const QUEST_ID = {
  PROLOGUE_TUTORIAL: 'prologue_tutorial',  // 序章：收集木材
  CHAPTER1_FOREST: 'chapter1_forest',      // 第一章：森林试炼
};

// 所有任务定义
export const QUESTS = {
  // ----------------------------------------------------------
  // 序章：教学任务——收集 5 个木材
  // ----------------------------------------------------------
  [QUEST_ID.PROLOGUE_TUTORIAL]: {
    id: QUEST_ID.PROLOGUE_TUTORIAL,
    chapter: '序章',
    title: '苏醒者的第一步',
    desc: '艾尔登长老让你收集一些木材，学习基本的生存技能。',
    objectives: [
      {
        type: 'collect_block',
        blockId: 5,  // WOOD
        target: 5,
        current: 0,
        desc: '砍伐树木收集 5 个木材'
      }
    ],
    reward: {
      message: '掌握了基本的生存技能！',
      // 奖励一些石头，方便进入第一章
      giveItems: [{ id: 3, count: 16 }],  // STONE x16
    },
    next: QUEST_ID.CHAPTER1_FOREST,  // 完成后解锁的下一个任务
  },

  // ----------------------------------------------------------
  // 第一章：森林试炼——寻找世界之心碎片
  // ----------------------------------------------------------
  [QUEST_ID.CHAPTER1_FOREST]: {
    id: QUEST_ID.CHAPTER1_FOREST,
    chapter: '第一章',
    title: '森林的试炼',
    desc: '在古老的森林深处，寻找第一块世界之心碎片。',
    objectives: [
      {
        type: 'collect_fragment',
        target: 1,
        current: 0,
        desc: '找到第一块世界之心碎片'
      }
    ],
    reward: {
      message: '第一块世界之心碎片已收集！身世之谜开始浮现……',
    },
    next: null,  // 首版到此为止（第二章预留）
  },
};

export default QUESTS;
