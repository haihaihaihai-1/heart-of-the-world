// ============================================================
// story/Story.js — 故事系统主控
// ------------------------------------------------------------
// 协调任务进度、剧情演出（字幕/对话）、碎片收集触发等。
// 它把 Chapters.js（文本）、Quests.js（数据）和 UI（显示）
// 串在一起。
// ============================================================
import { QUESTS, QUEST_ID } from './Quests.js';
import { CHAPTERS } from './Chapters.js';
import { BLOCK } from '../blocks/Blocks.js';

// 故事阶段
export const STAGE = {
  PROLOGUE_INTRO: 'prologue_intro',       // 序章开场字幕
  PROLOGUE_TUTORIAL: 'prologue_tutorial', // 收集木材任务中
  CHAPTER1_INTRO: 'chapter1_intro',       // 第一章开场
  CHAPTER1_ACTIVE: 'chapter1_active',     // 第一章进行中
  CHAPTER1_DONE: 'chapter1_done',         // 第一章完成
};

export class Story {
  constructor(ui, player) {
    this.ui = ui;
    this.player = player;

    this.stage = STAGE.PROLOGUE_INTRO;
    this.currentQuestId = null;
    this.completedQuests = new Set();

    // 碎片被收集的标记（避免重复触发）
    this.fragmentsTriggered = new Set();
  }

  // ----------------------------------------------------------
  // 开始游戏：播放序章开场
  // ----------------------------------------------------------
  start() {
    const intro = CHAPTERS.prologue.intro;
    // 逐条显示字幕
    this._playSubtitleSequence(intro, () => {
      // 字幕播完，向导走过来打招呼
      this._startPrologueDialogue();
    });
  }

  // 逐条显示一组字幕，全部显示完后回调
  _playSubtitleSequence(lines, onDone) {
    let i = 0;
    const showNext = () => {
      if (i >= lines.length) {
        if (onDone) onDone();
        return;
      }
      this.ui.showSubtitle(lines[i], 3000);
      i++;
      setTimeout(showNext, 3200);
    };
    showNext();
  }

  // ----------------------------------------------------------
  // 序章：向导对话
  // ----------------------------------------------------------
  _startPrologueDialogue() {
    this.ui.showDialogue(CHAPTERS.prologue.guideGreeting, () => {
      // 对话结束 → 分配任务
      this._assignQuest(QUEST_ID.PROLOGUE_TUTORIAL);
      this.stage = STAGE.PROLOGUE_TUTORIAL;
      this.ui.showToast(CHAPTERS.prologue.questAssigned, 4000);
    });
  }

  // ----------------------------------------------------------
  // 分配任务
  // ----------------------------------------------------------
  _assignQuest(questId) {
    const quest = QUESTS[questId];
    if (!quest) return;
    // 重置目标进度
    quest.objectives.forEach(o => { o.current = 0; });
    this.currentQuestId = questId;
    this._refreshQuestPanel();
  }

  // 刷新任务面板 UI
  _refreshQuestPanel() {
    if (!this.currentQuestId) {
      this.ui.updateQuest(null);
      return;
    }
    const quest = QUESTS[this.currentQuestId];
    // 复制一份目标（避免修改原数据时的引用问题）
    this.ui.updateQuest({
      chapter: quest.chapter,
      title: quest.title,
      objectives: quest.objectives.map(o => ({
        desc: o.desc, current: o.current, target: o.target
      }))
    });
  }

  // ----------------------------------------------------------
  // 玩家破坏方块时被调用（统计收集）
  // ----------------------------------------------------------
  onBlockCollected(blockId) {
    if (!this.currentQuestId) return;
    const quest = QUESTS[this.currentQuestId];
    if (!quest) return;

    let changed = false;
    for (const obj of quest.objectives) {
      if (obj.type === 'collect_block' && obj.blockId === blockId) {
        if (obj.current < obj.target) {
          obj.current++;
          changed = true;
          // 顺便更新玩家统计
          if (blockId === BLOCK.WOOD) this.player.stats.woodCollected++;
          if (blockId === BLOCK.STONE) this.player.stats.stoneCollected++;
        }
      }
    }
    if (changed) {
      this._refreshQuestPanel();
      this._checkQuestComplete();
    }
  }

  // ----------------------------------------------------------
  // 玩家收集到世界之心碎片时被调用
  // ----------------------------------------------------------
  onFragmentCollected(x, y, z) {
    const key = `${x},${y},${z}`;
    if (this.fragmentsTriggered.has(key)) return;
    this.fragmentsTriggered.add(key);

    // 更新当前任务（如果有"收集碎片"目标）
    if (this.currentQuestId) {
      const quest = QUESTS[this.currentQuestId];
      if (quest) {
        for (const obj of quest.objectives) {
          if (obj.type === 'collect_fragment' && obj.current < obj.target) {
            obj.current++;
          }
        }
        this._refreshQuestPanel();
      }
    }

    // 播放碎片剧情
    this._playSubtitleSequence(CHAPTERS.chapter1.fragmentFound, () => {
      // 字幕结束后检查任务完成
      this._checkQuestComplete();
    });
  }

  // ----------------------------------------------------------
  // 检查当前任务是否完成
  // ----------------------------------------------------------
  _checkQuestComplete() {
    if (!this.currentQuestId) return;
    const quest = QUESTS[this.currentQuestId];
    if (!quest) return;
    const allDone = quest.objectives.every(o => o.current >= o.target);
    if (!allDone) return;

    // 任务完成！
    this.completedQuests.add(quest.id);
    this._grantReward(quest);
    this.ui.showToast('✓ 任务完成：' + quest.title, 4000);

    // 根据任务 ID 触发后续剧情
    if (quest.id === QUEST_ID.PROLOGUE_TUTORIAL) {
      this._onPrologueComplete();
    } else if (quest.id === QUEST_ID.CHAPTER1_FOREST) {
      this._onChapter1Complete();
    }

    this.currentQuestId = null;
    this._refreshQuestPanel();
  }

  // 发放奖励
  _grantReward(quest) {
    const r = quest.reward;
    if (!r) return;
    if (r.giveItems) {
      for (const item of r.giveItems) {
        this.player.addItem(item.id, item.count);
      }
    }
    if (r.message) {
      this.ui.showToast(r.message, 4000);
    }
  }

  // 序章完成 → 进入第一章
  _onPrologueComplete() {
    this.stage = STAGE.CHAPTER1_INTRO;
    // 播放向导的"告别"对话
    this.ui.showDialogue(CHAPTERS.prologue.questComplete, () => {
      // 然后是第一章开场字幕
      this._playSubtitleSequence(CHAPTERS.chapter1.intro, () => {
        this._assignQuest(QUEST_ID.CHAPTER1_FOREST);
        this.stage = STAGE.CHAPTER1_ACTIVE;
        this.ui.showToast(CHAPTERS.chapter1.nextHint, 5000);
      });
    });
  }

  // 第一章完成
  _onChapter1Complete() {
    this.stage = STAGE.CHAPTER1_DONE;
    this.ui.showDialogue(CHAPTERS.chapter1.complete, () => {
      this.ui.showSubtitle('—— 第一章 完 ——', 5000);
      setTimeout(() => {
        this.ui.showSubtitle('未完待续……感谢游玩！', 6000);
      }, 5500);
    });
  }

  // ----------------------------------------------------------
  // 玩家按 E 与向导 NPC 对话（再次交互）
  // ----------------------------------------------------------
  onTalkToGuide() {
    // 根据当前阶段给出不同的提示
    if (this.stage === STAGE.PROLOGUE_INTRO) {
      // 开场还没结束，引导继续
      this._startPrologueDialogue();
      return;
    }
    if (this.stage === STAGE.PROLOGUE_TUTORIAL) {
      this.ui.showDialogue([
        { name: '艾尔登长老', text: '砍树很简单——把准星对准木头，按住鼠标左键。' },
        { name: '艾尔登长老', text: '每砍一块就有一个木材进入你的物品栏。收集 5 个就够了。' }
      ]);
      return;
    }
    if (this.stage === STAGE.CHAPTER1_ACTIVE) {
      this.ui.showDialogue([
        { name: '艾尔登长老', text: '碎片散发着粉色的微光，远远就能看到。' },
        { name: '艾尔登长老', text: '它就在森林深处。小心那些史莱姆——它们虽然弱，但很烦人。' },
        { name: '艾尔登长老', text: '挖掉碎片方块就能收集它。试试看吧！' }
      ]);
      return;
    }
    if (this.stage === STAGE.CHAPTER1_DONE) {
      this.ui.showDialogue([
        { name: '艾尔登长老', text: '你做到了，苏醒者！第一块碎片已经回归。' },
        { name: '艾尔登长老', text: '但我们的旅程才刚刚开始……' }
      ]);
      return;
    }
    this.ui.showDialogue([
      { name: '艾尔登长老', text: '愿世界之心指引你前行。' }
    ]);
  }
}

export default Story;
