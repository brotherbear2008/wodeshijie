/* 我的世界 · designer：AI 世界设计师（调用 Claude）+ 本地设计师（听懂关键词，离线也能用） */
(function () {
  'use strict';
  const MW = window.MW;
  const D = (MW.designer = {});

  // ---------- 词典 ----------
  D.MODES = {
    combat: { label: '打击空间', icon: '⚔️' },
    gentle: { label: '温柔空间', icon: '🌸' },
    math: { label: '数学闯关', icon: '🔢' },
    snake: { label: '贪吃蛇乐园', icon: '🐍' },
  };
  D.modeLabel = (spec) => (spec.mode === 'math' ? (spec.settings.mathType === 'arith' ? '口算闯关' : '数独闯关') : D.MODES[spec.mode].label);
  D.SCENES = {
    sky: { label: '高空', colors: ['#7fdcff', '#ff9ad5', '#ffe45c'] },
    space: { label: '太空', colors: ['#8f9bff', '#ff7ad9', '#ffe45c'] },
    forest: { label: '森林', colors: ['#5dffa8', '#ff9f43', '#ffe45c'] },
    ocean: { label: '海底', colors: ['#3fd4ff', '#ff8fc2', '#ffd24d'] },
    volcano: { label: '火山', colors: ['#ff7a45', '#ff4d9a', '#ffd24d'] },
    ice: { label: '冰雪', colors: ['#bfefff', '#a48cff', '#ffffff'] },
    candy: { label: '糖果', colors: ['#ff7ad9', '#7fe8ff', '#fff07a'] },
    city: { label: '霓虹城市', colors: ['#4ff3ff', '#ff62d4', '#ffe45c'] },
    desert: { label: '沙漠', colors: ['#ffc65c', '#ff6b8a', '#7fe8ff'] },
    grass: { label: '草地', colors: ['#7dff9a', '#ff9ad5', '#ffe45c'] },
  };
  D.SHAPES = {
    robot: ['机器人', '🤖'], cat: ['猫', '🐱'], dog: ['狗', '🐶'], rabbit: ['兔子', '🐰'], bear: ['熊', '🐻'],
    dino: ['恐龙', '🦖'], dragon: ['龙', '🐉'], ghost: ['幽灵', '👻'], ninja: ['忍者', '🥷'], knight: ['骑士', '🛡️'],
    fairy: ['仙女', '🧚'], alien: ['外星人', '👽'], slime: ['史莱姆', '🟢'], monster: ['怪兽', '👾'], bird: ['小鸟', '🐦'],
    fish: ['鱼', '🐟'], unicorn: ['独角兽', '🦄'], zombie: ['僵尸', '🧟'],
  };
  D.PARTS = {
    tree: ['树', '🌲'], crystal: ['水晶', '💎'], cloud: ['云朵', '☁️'], flower: ['花', '🌷'], tower: ['塔', '🗼'],
    chest: ['宝箱', '🎁'], coin: ['金币', '🪙'], heart: ['爱心', '❤️'], star: ['星星', '⭐'], portal: ['传送门', '🌀'],
    rock: ['石头', '🪨'], lamp: ['灯', '💡'], house: ['小房子', '🏠'], mushroom: ['蘑菇', '🍄'], jumppad: ['弹跳板', '⏫'],
    candy: ['棒棒糖', '🍭'], rainbow: ['彩虹', '🌈'], castle: ['城堡', '🏰'], musicbox: ['音乐盒', '🎵'],
  };
  D.EFFECTS = {
    combat: ['damage', 'range', 'shield', 'speed', 'heal', 'summon', 'magnet'],
    gentle: ['speed', 'magnet', 'trail', 'jump'],
    math: ['hint', 'shield', 'auto'],
    snake: ['speed', 'magnet', 'shield', 'ghost', 'double'],
  };
  const EFFECT_FALLBACK = {
    combat: { hint: 'damage', auto: 'damage', trail: 'speed', jump: 'speed', ghost: 'shield', double: 'damage' },
    gentle: { damage: 'trail', range: 'trail', shield: 'jump', summon: 'trail', heal: 'trail', hint: 'magnet', auto: 'magnet', ghost: 'speed', double: 'magnet' },
    math: { damage: 'hint', range: 'hint', speed: 'hint', magnet: 'hint', summon: 'auto', heal: 'shield', trail: 'hint', jump: 'hint', ghost: 'shield', double: 'auto' },
    snake: { damage: 'double', range: 'magnet', heal: 'shield', summon: 'double', trail: 'speed', jump: 'speed', hint: 'magnet', auto: 'double' },
  };
  const EFFECT_ICON = { damage: '🗡️', range: '🔨', shield: '🛡️', speed: '👟', heal: '💊', summon: '🐍', magnet: '🧲', trail: '🌈', jump: '☁️', hint: '💡', auto: '🔍', ghost: '👻', double: '✖️' };
  D.WEATHER = { none: '晴朗', snow: '下雪', rain: '下雨', petals: '飘花瓣', bubbles: '冒泡泡', stars: '星光', embers: '火花' };
  D.WEATHERS = Object.keys(D.WEATHER);

  D.effectDesc = (e, p, mode) => {
    const f = (n) => (Math.round(n * 10) / 10).toString();
    switch (e) {
      case 'damage': return p > 1 ? `攻击力 ×${f(p)}` : '基础武器，打一下掉 1 格血';
      case 'range': return `攻击范围 ×${f(Math.max(1.2, p * 0.8 + 0.4))}${p >= 2 ? '，还能打远处的敌人' : ''}`;
      case 'shield': return mode === 'math' ? `每关可以答错 ${Math.round(p)} 次不用看广告` : mode === 'snake' ? `按技能键后 ${Math.round(p + 3)} 秒内撞什么都不会死` : '受到的伤害减少一大半';
      case 'speed': return mode === 'snake' ? '按住加速键，冲得更快' : `移动速度 ×${f(p)}`;
      case 'heal': return `每秒自动回 ${Math.round(p * 2)} 点血`;
      case 'summon': return `召唤 ${Math.round(p)} 条全息蛇帮你咬怪，死了会自己复活`;
      case 'magnet': return mode === 'snake' ? '把附近的豆子吸过来' : mode === 'gentle' ? '附近的星星会自己飞过来' : '自动吸走附近的金币';
      case 'trail': return '走过的地方留下彩虹光点';
      case 'jump': return '跳得又高又慢，像在飞';
      case 'hint': return `每关多 ${Math.round(p)} 次提示`;
      case 'auto': return `每关自动帮你填 ${Math.round(p)} 个格子`;
      case 'ghost': return `按技能键后 ${Math.round(p + 3)} 秒内能穿过别的蛇`;
      case 'double': return '吃一颗豆子长两节';
      default: return '';
    }
  };

  // ---------- 每种玩法的基础模板 ----------
  const TEMPLATES = {
    combat: () => ({
      mode: 'combat', scene: 'city',
      hero: { name: '全息勇士', shape: 'knight' },
      characters: [
        { name: '机甲小兵', role: 'enemy', shape: 'robot', count: 6, desc: '成群结队追着你跑' },
        { name: '暗影忍者', role: 'enemy', shape: 'ninja', count: 3, desc: '跑得特别快' },
        { name: '霸王怪兽', role: 'enemy', shape: 'monster', count: 1, desc: '最后一波出场的大 Boss' },
        { name: '喵喵助手', role: 'friend', shape: 'cat', count: 1, desc: '跟着你，会放电帮你打怪' },
      ],
      parts: [
        { name: '弹跳板', type: 'jumppad', count: 3 }, { name: '宝箱', type: 'chest', count: 2 },
        { name: '补血爱心', type: 'heart', count: 3 }, { name: '能量水晶', type: 'crystal', count: 4 }, { name: '霓虹塔', type: 'tower', count: 4 },
      ],
      equipment: [
        { name: '木头剑', icon: '🗡️', price: 'free', effect: 'damage', power: 1 },
        { name: '泡泡护盾', icon: '🫧', price: 'free', effect: 'shield', power: 1 },
        { name: '贪吃蛇召唤器', icon: '🐍', price: 'free', effect: 'summon', power: 6 },
        { name: '激光剑', icon: '⚡', price: 'vip', effect: 'damage', power: 3 },
        { name: '雷神锤', icon: '🔨', price: 'vip', effect: 'range', power: 2 },
        { name: '火焰翅膀', icon: '🔥', price: 'vip', effect: 'speed', power: 1.7 },
      ],
      rewards: ['勇者徽章', '金币', '复活石'],
      settings: { difficulty: 2, speed: 1, weather: 'none', waves: 5 },
    }),
    gentle: () => ({
      mode: 'gentle', scene: 'grass',
      hero: { name: '小可爱', shape: 'rabbit' },
      characters: [
        { name: '棉花糖兔', role: 'friend', shape: 'rabbit', count: 3, desc: '摸摸它会冒出爱心' },
        { name: '小奶猫', role: 'friend', shape: 'cat', count: 2, desc: '喜欢跟着你散步' },
        { name: '彩虹独角兽', role: 'friend', shape: 'unicorn', count: 1, desc: '最温柔的好朋友' },
        { name: '萤火小鸟', role: 'friend', shape: 'bird', count: 2, desc: '在你身边飞来飞去' },
      ],
      parts: [
        { name: '发光花', type: 'flower', count: 10 }, { name: '软软云朵', type: 'cloud', count: 5 },
        { name: '音乐盒', type: 'musicbox', count: 2 }, { name: '软软弹跳板', type: 'jumppad', count: 2 },
        { name: '彩虹桥', type: 'rainbow', count: 1 }, { name: '小星星', type: 'star', count: 12 },
      ],
      equipment: [
        { name: '云朵鞋', icon: '☁️', price: 'free', effect: 'jump', power: 1.5 },
        { name: '星星磁铁', icon: '🧲', price: 'free', effect: 'magnet', power: 1 },
        { name: '彩虹足迹', icon: '🌈', price: 'vip', effect: 'trail', power: 1 },
        { name: '蝴蝶翅膀', icon: '🦋', price: 'vip', effect: 'speed', power: 1.6 },
      ],
      rewards: ['温柔值', '金币', '新朋友'],
      settings: { difficulty: 1, speed: 1, weather: 'petals' },
    }),
    math: () => ({
      mode: 'math', scene: 'sky',
      hero: { name: '数学小侠', shape: 'robot' },
      characters: [
        { name: '猫头鹰老师', role: 'friend', shape: 'bird', count: 1, desc: '在第一座岛上等你' },
        { name: '云朵精灵', role: 'friend', shape: 'fairy', count: 2, desc: '每过一关给你撒星星' },
        { name: '守岛小飞龙', role: 'friend', shape: 'dragon', count: 1, desc: '守着最高的那座岛' },
      ],
      parts: [
        { name: '浮空岛', type: 'rock', count: 6 }, { name: '云朵', type: 'cloud', count: 8 },
        { name: '奖励宝箱', type: 'chest', count: 2 }, { name: '彩虹', type: 'rainbow', count: 1 },
      ],
      equipment: [
        { name: '提示灯泡', icon: '💡', price: 'free', effect: 'hint', power: 2 },
        { name: '错题护盾', icon: '🛡️', price: 'free', effect: 'shield', power: 1 },
        { name: '魔法放大镜', icon: '🔍', price: 'vip', effect: 'auto', power: 3 },
        { name: '超级灯泡', icon: '🌟', price: 'vip', effect: 'hint', power: 5 },
      ],
      rewards: ['金星', '金币', '复活石'],
      settings: { difficulty: 2, speed: 1, weather: 'none', levels: 6, mathType: 'sudoku', sudokuSize: 0 },
    }),
    snake: () => ({
      mode: 'snake', scene: 'space',
      hero: { name: '我的小蛇', shape: 'slime' },
      characters: [
        { name: '闪电蛇队', role: 'enemy', shape: 'slime', count: 6, desc: '跑得飞快，老是撞墙' },
        { name: '彩虹蛇队', role: 'enemy', shape: 'slime', count: 5, desc: '最爱抢星星豆' },
        { name: '泡泡蛇队', role: 'enemy', shape: 'slime', count: 5, desc: '慢吞吞，但是能长很长' },
      ],
      parts: [
        { name: '星星豆', type: 'star', count: 30 }, { name: '能量水晶', type: 'crystal', count: 6 }, { name: '信号塔', type: 'tower', count: 4 },
      ],
      equipment: [
        { name: '加速火箭', icon: '🚀', price: 'free', effect: 'speed', power: 1.6 },
        { name: '豆豆磁铁', icon: '🧲', price: 'free', effect: 'magnet', power: 1 },
        { name: '无敌护盾', icon: '🛡️', price: 'vip', effect: 'shield', power: 2 },
        { name: '幽灵皮肤', icon: '👻', price: 'vip', effect: 'ghost', power: 3 },
        { name: '双倍豆豆', icon: '✖️', price: 'vip', effect: 'double', power: 2 },
      ],
      rewards: ['金币', '最长纪录'],
      settings: { difficulty: 2, speed: 1, weather: 'stars', snakeCount: 16 },
    }),
  };

  const SCENE_PREFIX = {
    sky: ['云端', '高空', '天空'], space: ['星际', '银河', '宇宙'], forest: ['森林', '丛林', '绿野'], ocean: ['深海', '海底', '珊瑚'],
    volcano: ['火山', '熔岩', '烈焰'], ice: ['冰雪', '极光', '雪原'], candy: ['糖果', '甜甜', '彩虹糖'], city: ['霓虹', '未来', '赛博'],
    desert: ['沙漠', '金沙', '黄金'], grass: ['花园', '青草', '阳光'],
  };
  const MODE_SUFFIX = {
    combat: ['打击竞技场', '战斗基地', '大冒险'], gentle: ['温柔小窝', '治愈花园', '梦幻乐园'],
    sudoku: ['数独天空城', '数独闯关岛', '智慧之塔'], arith: ['口算闯关岛', '算术天空城', '口算大冒险'],
    snake: ['贪吃蛇乐园', '蛇蛇大作战', '贪吃蛇星球'],
  };
  function makeName(mode, scene, mathType) {
    const key = mode === 'math' ? (mathType === 'arith' ? 'arith' : 'sudoku') : mode;
    return MW.pick(SCENE_PREFIX[scene] || ['神奇']) + MW.pick(MODE_SUFFIX[key]);
  }
  const SHAPE_NAMES = {
    robot: ['机甲小兵', '铁皮机器人', '螺丝钉战士'], cat: ['喵喵', '小奶猫', '闪电猫'], dog: ['汪汪队员', '小柴犬', '旺财'],
    rabbit: ['棉花糖兔', '跳跳兔', '月亮兔'], bear: ['熊猫滚滚', '蜂蜜熊', '大熊'], dino: ['小霸王龙', '喷火恐龙', '三角龙'],
    dragon: ['小飞龙', '雷电龙', '星星龙'], ghost: ['调皮幽灵', '小白鬼', '影子怪'], ninja: ['暗影忍者', '疾风忍者', '小忍者'],
    knight: ['全息骑士', '小勇士', '光之战士'], fairy: ['星光仙女', '云朵精灵', '彩虹公主'], alien: ['绿豆外星人', '大眼外星人', '咕噜星人'],
    slime: ['果冻史莱姆', '泡泡怪', '软糖怪'], monster: ['霸王怪兽', '大魔王', '吼吼怪'], bird: ['蓝羽小鸟', '猫头鹰', '火烈鸟'],
    fish: ['泡泡鱼', '小鲨鱼', '灯笼鱼'], unicorn: ['彩虹独角兽', '星星小马', '云朵马'], zombie: ['慢吞吞僵尸', '小僵尸', '跳跳僵尸'],
  };
  const GENERIC_WORDS = /^(猫|狗|兔|兔子|熊|鸟|鱼|龙|机器人|怪兽|怪物|鬼|幽灵|小鸟|小猫|小狗|小兔|小熊|小鱼|僵尸|外星人|恐龙|史莱姆)$/;

  // ---------- 本地设计师：听关键词 ----------
  const CN = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 };
  function cnNum(s) {
    if (/^\d+$/.test(s)) return parseInt(s, 10);
    if (s === '几') return 3;
    let total = 0, cur = 0;
    for (const ch of s) {
      if (ch in CN) cur = CN[ch];
      else if (ch === '十') { total += (cur || 1) * 10; cur = 0; }
      else if (ch === '百') { total += (cur || 1) * 100; cur = 0; }
    }
    return total + cur;
  }
  const MANY = /好多好多|很多很多|超级多|超多|特别多|非常多|一大堆|一大群|无数|好多|很多|许多|成群/;
  function numBefore(text, idx) {
    const seg = text.slice(Math.max(0, idx - 8), idx);
    const m = seg.match(/(\d+|[零一二两三四五六七八九十百几]+)\s*[个只条头位名群匹种座把件]?\s*(?:的|小|大)?$/);
    if (m) { const n = cnNum(m[1]); if (n > 0) return n; }
    if (MANY.test(seg)) return 'many';
    return 0;
  }
  const MODE_KW = {
    snake: [[/贪吃蛇/, 6], [/蛇/, 3]],
    math: [[/数独/, 6], [/数学|口算|算术|算数/, 5], [/加法|减法|乘法|除法|计算|九宫格|做题|答题|题目/, 3], [/数字/, 1]],
    gentle: [[/温柔|治愈|放松|温馨/, 5], [/安静|舒服|休息|睡觉|梦幻|柔软|软软|甜蜜/, 3], [/可爱|小动物|宠物|摸摸|抱抱|花园/, 2]],
    combat: [[/打击|打怪|战斗|格斗|对战|射击|打架|消灭/, 5], [/刺激|武器|攻击|打败|冒险|勇士|战士|怪兽|敌人|魔王/, 2], [/打|剑|枪|炮|拳/, 1]],
  };
  function modeScores(t) {
    const out = {};
    for (const [mode, list] of Object.entries(MODE_KW)) {
      let s = 0;
      for (const [re, w] of list) if (re.test(t)) s += w;
      out[mode] = s;
    }
    return out;
  }
  function detectMode(t) {
    const sc = modeScores(t);
    let best = null, bestScore = 0;
    for (const [m, s] of Object.entries(sc)) if (s > bestScore) { bestScore = s; best = m; }
    return best;
  }
  const SCENE_KW = [
    ['space', /太空|宇宙|星球|外星|银河|星空|火箭|月亮|月球/], ['ocean', /海底|大海|海洋|水下|海里|珊瑚|鲨鱼/],
    ['volcano', /火山|岩浆|熔岩/], ['candy', /糖果|甜品|蛋糕|巧克力|冰淇淋|棒棒糖|零食|甜甜/],
    ['ice', /冰雪|冰天|雪地|雪山|冬天|北极|南极|企鹅|冰川/], ['forest', /森林|树林|丛林/], ['desert', /沙漠|金字塔|骆驼/],
    ['city', /城市|赛博|霓虹|未来|科技|高楼/], ['sky', /高空|天空|云上|云端|空中|天上/], ['grass', /草地|草原|花园|公园|花海|田野/],
  ];
  const SHAPE_KW = [
    ['dino', /恐龙|霸王龙|三角龙|翼龙/g], ['unicorn', /独角兽|小马|飞马/g], ['bird', /猫头鹰|企鹅/g], ['bear', /熊猫/g],
    ['dragon', /龙/g], ['robot', /机器人|机甲|铁甲/g], ['ninja', /忍者|刺客/g], ['knight', /骑士|勇士|战士|士兵|英雄|超人|奥特曼/g],
    ['fairy', /公主|仙女|精灵|天使|魔法师|女巫/g], ['alien', /外星人/g], ['zombie', /僵尸|丧尸/g], ['ghost', /幽灵|小鬼/g],
    ['monster', /怪兽|怪物|大魔王|魔王|[Bb][Oo][Ss][Ss]/g], ['slime', /史莱姆|果冻|泡泡怪/g],
    ['cat', /小猫|猫咪|猫|狐狸|老虎|狮子|豹/g], ['dog', /小狗|狗|狼/g], ['rabbit', /小兔子|兔子|小兔|兔/g], ['bear', /熊/g],
    ['bird', /小鸟|鸟|鸭子|鸭|小鸡|凤凰|鹦鹉/g], ['fish', /小鱼|鱼|鲨|海豚|鲸|章鱼/g],
  ];
  const PART_KW = [
    ['jumppad', /弹跳板|蹦床|跳板|弹簧/g], ['musicbox', /音乐盒|八音盒/g], ['rainbow', /彩虹桥|彩虹(?!色)/g], ['castle', /城堡|宫殿/g],
    ['chest', /宝箱|箱子|宝藏/g], ['portal', /传送门|任意门/g], ['crystal', /水晶|宝石|钻石|能量石/g], ['mushroom', /蘑菇/g],
    ['candy', /棒棒糖|糖果树/g], ['tower', /塔|高楼/g], ['house', /房子|小屋|房间/g], ['lamp', /路灯|灯笼|灯/g],
    ['tree', /大树|树/g], ['flower', /鲜花|花朵|花/g], ['cloud', /云朵|云/g], ['coin', /金币|硬币/g], ['heart', /爱心|心心/g],
    ['star', /星星/g], ['rock', /石头|岩石|小岛/g],
  ];
  const EQUIP_RE = /(激光|闪电|雷电|火焰|冰冻|黄金|钻石|超级|魔法|彩虹|无敌|神奇|宇宙|水|泡泡|木头|小)?(召唤器|回旋镖|放大镜|拳套|飞镖|炸弹|铠甲|盔甲|火箭|滑板|灯泡|磁铁|魔杖|翅膀|护盾|盾牌|靴子|鞋子|弓箭|锤子|斧头|剑|刀|枪|炮|锤|弓|盾|鞋|斧)/g;
  const EQ_NOUN = {
    剑: 'damage', 刀: 'damage', 斧: 'damage', 斧头: 'damage', 拳套: 'damage', 锤: 'range', 锤子: 'range', 枪: 'range', 炮: 'range',
    弓: 'range', 弓箭: 'range', 飞镖: 'range', 回旋镖: 'range', 炸弹: 'range', 盾: 'shield', 盾牌: 'shield', 护盾: 'shield',
    铠甲: 'shield', 盔甲: 'shield', 鞋: 'speed', 鞋子: 'speed', 靴子: 'speed', 翅膀: 'speed', 火箭: 'speed', 滑板: 'speed',
    磁铁: 'magnet', 魔杖: 'summon', 灯泡: 'hint', 放大镜: 'auto', 召唤器: 'summon',
  };
  const EQ_ICON = {
    剑: '🗡️', 刀: '🗡️', 斧: '🪓', 斧头: '🪓', 拳套: '🥊', 锤: '🔨', 锤子: '🔨', 枪: '🔫', 炮: '💥', 弓: '🏹', 弓箭: '🏹',
    飞镖: '🎯', 回旋镖: '🪃', 炸弹: '💣', 盾: '🛡️', 盾牌: '🛡️', 护盾: '🛡️', 铠甲: '🦺', 盔甲: '🦺', 鞋: '👟', 鞋子: '👟',
    靴子: '🥾', 翅膀: '🦋', 火箭: '🚀', 滑板: '🛹', 磁铁: '🧲', 魔杖: '🪄', 灯泡: '💡', 放大镜: '🔍', 召唤器: '✨',
  };
  const VIP_PREFIX = /激光|闪电|雷电|火焰|冰冻|黄金|钻石|超级|魔法|彩虹|无敌|神奇|宇宙/;
  const COLOR_MAP = { 红: '#ff5470', 橙: '#ff9f43', 黄: '#ffe45c', 绿: '#5dffa8', 青: '#4ff3ff', 蓝: '#5b9dff', 紫: '#b57bff', 粉: '#ff7ad9', 金: '#ffd24d', 白: '#eafaff', 银: '#cfe3f0', 黑: '#8a6bff' };
  const COLOR_NAME = { '#ff5470': '红色', '#ff9f43': '橙色', '#ffe45c': '黄色', '#5dffa8': '绿色', '#4ff3ff': '青色', '#5b9dff': '蓝色', '#b57bff': '紫色', '#ff7ad9': '粉色', '#ffd24d': '金色', '#eafaff': '白色', '#cfe3f0': '银色', '#8a6bff': '深紫色' };

  function powerFor(effect, vip) {
    const t = {
      damage: [1.5, 3], range: [1.5, 2], shield: [1, 2], speed: [1.3, 1.7], heal: [1, 2], summon: [5, 8],
      magnet: [1, 2], trail: [1, 1], jump: [1.4, 1.8], hint: [2, 4], auto: [1, 3], ghost: [2, 4], double: [2, 2],
    }[effect] || [1, 2];
    return vip ? t[1] : t[0];
  }
  function fitEffect(effect, mode) {
    if (D.EFFECTS[mode].includes(effect)) return effect;
    return (EFFECT_FALLBACK[mode] && EFFECT_FALLBACK[mode][effect]) || D.EFFECTS[mode][0];
  }
  function blank(work, m) { return work.slice(0, m.index) + '＿'.repeat(m[0].length) + work.slice(m.index + m[0].length); }

  function localDesign(text, prev) {
    let t = text.replace(/\s+/g, '');
    // 先把“改名叫 XX”拿出来，名字里的字不再当成别的要求（比如“彩虹宇宙”不会把场景换成太空）
    const nm = t.match(/(?:叫做?|名字(?:叫|是)|改名(?:叫|为|成)?|命名为|取名(?:叫|为)?)[「“"'《]?([^，。！!？?"”」'》,.]{2,12})/);
    let newName = '';
    if (nm) {
      const v = nm[1].replace(/的?(世界|空间|地方|游戏)$/, '');
      newName = v.length >= 2 ? v : nm[1];
      if (/什么|啥/.test(newName)) newName = '';
      else t = t.replace(nm[0], '，');
    }
    const notes = [];
    const scores = modeScores(t);
    const dm = detectMode(t);
    const snakeGear = /(贪吃蛇|蛇)(的)?(装备|召唤)/.test(t);
    let spec;
    let fresh = false;
    const wantsSwitch = prev && dm && dm !== prev.mode && (scores[dm] >= 5 || /换成|改成|变成|我想要|我要|来个|做一个|弄一个|换个/.test(t));
    if (!prev || (wantsSwitch && !(snakeGear && prev.mode === 'combat'))) {
      const mode = !prev && snakeGear ? 'snake' : dm || 'combat';
      spec = TEMPLATES[mode]();
      spec.characters = MW.clone(spec.characters);
      fresh = true;
      if (prev && wantsSwitch) notes.push(`玩法换成了「${D.MODES[mode].label}」`);
      if (!prev && snakeGear) spec.settings.snakeCount = 24;
      if (mode === 'combat' && !SCENE_KW.some(([, re]) => re.test(t))) spec.scene = MW.pick(['city', 'city', 'space', 'volcano', 'forest']);
      if (mode === 'gentle' && !SCENE_KW.some(([, re]) => re.test(t))) spec.scene = MW.pick(['grass', 'grass', 'candy', 'sky']);
      spec.colors = palette(spec.scene);
      if (prev) { spec.colors = MW.clone(prev.colors); spec.scene = prev.scene; }
    } else {
      spec = MW.clone(prev);
    }
    const mode = spec.mode;
    const st = spec.settings;
    let work = t;

    // 不要的东西
    const removeRe = /(?:不要|去掉|删掉|删除|拿走|别要|不想要)了?(?:那些|这些|那个|这个|所有的?)?([^，。！!？?,.、]{1,6})/g;
    let rm;
    while ((rm = removeRe.exec(t))) {
      const target = rm[1].replace(/了$/, '');
      if (/广告/.test(target)) { notes.push('广告是游戏规则的一部分哦～想跳过广告可以开通会员，一个月 1 块钱'); continue; }
      let hit = false;
      const shapeOf = (w) => { for (const [s, re] of SHAPE_KW) { re.lastIndex = 0; if (re.test(w)) return s; } return null; };
      const partOf = (w) => { for (const [p, re] of PART_KW) { re.lastIndex = 0; if (re.test(w)) return p; } return null; };
      const ts = shapeOf(target), tp = partOf(target);
      const before = spec.characters.length;
      spec.characters = spec.characters.filter((c) => !(c.name.includes(target) || target.includes(c.name) || (ts && c.shape === ts)));
      if (spec.characters.length < before) { hit = true; notes.push(`去掉了${target}`); }
      const pb = spec.parts.length;
      spec.parts = spec.parts.filter((p) => !(p.name.includes(target) || target.includes(p.name) || (tp && p.type === tp)));
      if (spec.parts.length < pb && !hit) { hit = true; notes.push(`拿走了${target}`); }
      const eb = spec.equipment.length;
      spec.equipment = spec.equipment.filter((e) => !(e.name.includes(target) || target.includes(e.name)));
      if (spec.equipment.length < eb && !hit) { hit = true; notes.push(`去掉了装备「${target}」`); }
      work = work.replace(rm[0], '＿'.repeat(rm[0].length));
    }

    // 场景
    for (const [sc, re] of SCENE_KW) {
      if (re.test(work)) {
        if (sc !== spec.scene) {
          spec.scene = sc;
          spec.colors = palette(sc);
          if (!fresh) notes.push(`场景换成了「${D.SCENES[sc].label}」`);
        }
        break;
      }
    }

    // 装备（先处理，避免“灯泡”被当成“灯”）
    let em;
    EQUIP_RE.lastIndex = 0;
    const eqAdds = [];
    while ((em = EQUIP_RE.exec(work))) {
      const noun = em[2], pre = em[1] || '';
      const name = (pre + noun).replace(/^小/, '小');
      if (spec.equipment.some((e) => e.name === name)) continue;
      const vip = /免费|不要钱|不花钱/.test(t) ? false : /会员|付费|花钱|充钱|收费|vip/i.test(t) ? true : VIP_PREFIX.test(pre);
      const effect = fitEffect(EQ_NOUN[noun] || 'damage', mode);
      const power = powerFor(effect, vip);
      eqAdds.push({ name, icon: EQ_ICON[noun] || EFFECT_ICON[effect], price: vip ? 'vip' : 'free', effect, power });
    }
    if (snakeGear && mode === 'combat' && !spec.equipment.some((e) => e.effect === 'summon')) {
      eqAdds.push({ name: '贪吃蛇召唤器', icon: '🐍', price: 'free', effect: 'summon', power: 8 });
    }
    for (const e of eqAdds.slice(0, 3)) {
      spec.equipment.push(e);
      notes.push(`加了装备「${e.name}」（${e.price === 'vip' ? '会员专属' : '免费'}）`);
    }
    work = work.replace(EQUIP_RE, (m) => '＿'.repeat(m.length));

    // 人物
    let consumedMany = false;
    const found = [];
    for (const [shape, re] of SHAPE_KW) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(work))) {
        found.push({ shape, word: m[0], idx: m.index });
        work = blank(work, m);
        re.lastIndex = m.index + m[0].length;
      }
    }
    // 主角
    const heroM = t.match(/我(?:想|要)?(?:当|是|变成|做|扮演)(?:一[个只条位头])?([一-龥]{1,5})/);
    let heroWord = null;
    if (heroM) {
      for (const f of found) {
        if (heroM[1].includes(f.word)) {
          spec.hero = { name: f.word.length >= 2 && !GENERIC_WORDS.test(f.word) ? f.word : SHAPE_NAMES[f.shape][0], shape: f.shape };
          heroWord = f.word;
          notes.push(`你现在是「${spec.hero.name}」`);
          break;
        }
      }
    }
    for (const f of found) {
      if (f.word === heroWord) continue;
      if (mode === 'snake') continue;
      const ctx = t.slice(Math.max(0, f.idx - 8), f.idx + f.word.length + 6);
      let role = mode === 'combat' ? 'enemy' : 'friend';
      if (mode === 'combat' && /朋友|伙伴|帮我|帮手|宠物|队友|保护|跟着我|陪我/.test(ctx)) role = 'friend';
      const n = numBefore(t, f.idx);
      if (n === 'many') consumedMany = true;
      const count = n === 'many' ? 8 : n || 0;
      const exist = spec.characters.find((c) => c.shape === f.shape || c.name === f.word);
      if (exist) {
        const old = exist.count;
        exist.count = MW.clamp(count || (fresh ? old : old + 2), 1, 12);
        if (role !== exist.role && mode === 'combat' && /朋友|伙伴|帮我|宠物|队友/.test(ctx)) exist.role = 'friend';
        if (exist.count !== old) notes.push(`${exist.name}变成了 ${exist.count} 个`);
      } else {
        const name = GENERIC_WORDS.test(f.word) ? MW.pick(SHAPE_NAMES[f.shape]) : f.word;
        const c = { name, role, shape: f.shape, count: MW.clamp(count || (role === 'enemy' ? 4 : 2), 1, 12), desc: role === 'enemy' ? '会追着你跑' : '你的好朋友' };
        if (fresh && spec.characters.length >= 3) spec.characters.splice(fresh ? 0 : spec.characters.length, 0, c);
        else spec.characters.push(c);
        notes.push(`加了${c.count}个「${c.name}」${role === 'enemy' ? '（敌人）' : '（朋友）'}`);
      }
    }
    if (fresh && found.length) {
      // 新世界里玩家点名要的人物优先，模板里多出来的去掉一些
      const asked = new Set(found.map((f) => f.shape));
      const keep = spec.characters.filter((c) => asked.has(c.shape));
      const rest = spec.characters.filter((c) => !asked.has(c.shape));
      spec.characters = keep.concat(rest.slice(0, Math.max(0, 4 - keep.length)));
      if (mode === 'combat' && !spec.characters.some((c) => c.role === 'enemy')) spec.characters.push(TEMPLATES.combat().characters[0]);
    }

    // 贪吃蛇数量
    if (mode === 'snake') {
      const si = t.search(/蛇/);
      if (si >= 0) {
        const n = numBefore(t, si);
        if (n === 'many') { consumedMany = true; st.snakeCount = MW.clamp(Math.max(24, Math.round(st.snakeCount * 1.6)), 4, 40); notes.push(`蛇变成了 ${st.snakeCount} 条`); }
        else if (n) { st.snakeCount = MW.clamp(n, 4, 40); notes.push(`蛇变成了 ${st.snakeCount} 条`); }
      }
    }

    // 小零件
    for (const [type, re] of PART_KW) {
      re.lastIndex = 0;
      const m = re.exec(work);
      if (!m) continue;
      work = blank(work, m);
      const n = numBefore(t, m.index);
      if (n === 'many') consumedMany = true;
      const count = n === 'many' ? 8 : n || 0;
      const exist = spec.parts.find((p) => p.type === type);
      if (exist) {
        const old = exist.count;
        exist.count = MW.clamp(count || (fresh ? old : old + 2), 1, type === 'star' ? 40 : 14);
        if (exist.count !== old && !fresh) notes.push(`${exist.name}变成了 ${exist.count} 个`);
      } else {
        const p = { name: m[0].length >= 2 ? m[0] : D.PARTS[type][0], type, count: MW.clamp(count || (type === 'star' ? 8 : type === 'flower' ? 6 : 3), 1, type === 'star' ? 40 : 14) };
        spec.parts.push(p);
        if (!fresh) notes.push(`放了 ${p.count} 个${p.name}`);
      }
    }

    // 多一点 / 少一点
    const more = !consumedMany && (MANY.test(t) || /多一点|多点|再多|更多|加倍|翻倍|多些/.test(t));
    const less = /少一点|少点|太多|少一些|减少|少些/.test(t);
    if (more || less) {
      const k = more ? 1.6 : 0.6;
      if (mode === 'snake') { st.snakeCount = MW.clamp(Math.round(st.snakeCount * k), 4, 40); notes.push(`蛇变成了 ${st.snakeCount} 条`); }
      else if (mode === 'math') { st.levels = MW.clamp(st.levels + (more ? 3 : -2), 3, 12); notes.push(`现在一共 ${st.levels} 关`); }
      else {
        const role = mode === 'combat' ? 'enemy' : 'friend';
        spec.characters.forEach((c) => { if (c.role === role) c.count = MW.clamp(Math.round(c.count * k) || 1, 1, 12); });
        notes.push(mode === 'combat' ? (more ? '敌人变多了' : '敌人变少了') : (more ? '小动物变多了' : '小动物变少了'));
      }
    }

    // 难度、速度
    let d = st.difficulty;
    if (/超难|最难|地狱|非常难|特别难/.test(t)) d = 5;
    else if (/简单一点|简单点|太难|容易点|简单些|容易一点/.test(t)) d -= 1;
    else if (/难一点|难点|更难|太简单|有挑战|再难/.test(t)) d += 1;
    else if (/很难|刺激/.test(t)) d = Math.max(d, 4);
    else if (/简单|容易|新手|入门|宝宝/.test(t)) d = 1;
    d = MW.clamp(d, 1, 5);
    if (d !== st.difficulty) { st.difficulty = d; if (!fresh) notes.push(`难度调成了 ${'★'.repeat(d)}`); }
    if (/快一点|快点|更快|加速|太慢/.test(t)) { st.speed = MW.clamp(+(st.speed * 1.3).toFixed(2), 0.6, 1.8); notes.push('速度变快了'); }
    else if (/慢一点|慢点|太快|慢慢/.test(t)) { st.speed = MW.clamp(+(st.speed * 0.75).toFixed(2), 0.6, 1.8); notes.push('速度变慢了'); }

    // 天气
    let w = null;
    if (/下(点|些)?雪|雪花|飘雪/.test(t)) w = 'snow';
    else if (/下雨/.test(t)) w = 'rain';
    else if (/花瓣|樱花|落花/.test(t)) w = 'petals';
    else if (/泡泡/.test(t) && !/泡泡怪|泡泡蛇/.test(t)) w = 'bubbles';
    else if (/满天星|星光|星空|闪闪/.test(t)) w = 'stars';
    else if (/火花|火星子|岩浆/.test(t)) w = 'embers';
    if (/不要(下雪|下雨|天气)|晴天|停雨|停雪/.test(t)) w = 'none';
    if (w && w !== st.weather) { st.weather = w; if (!fresh) notes.push(`天气变成了「${D.WEATHER[w]}」`); }

    // 数学闯关设置
    if (mode === 'math') {
      if (/口算|加法|减法|乘法|除法|算术|算数|计算题/.test(t) && st.mathType !== 'arith') { st.mathType = 'arith'; notes.push('题目换成了口算题'); }
      else if (/数独|九宫格/.test(t) && st.mathType !== 'sudoku' && !fresh) { st.mathType = 'sudoku'; notes.push('题目换成了数独'); }
      if (/四宫格|4\s*[x×乘*]\s*4|四乘四/.test(t)) st.sudokuSize = 4;
      else if (/六宫格|6\s*[x×乘*]\s*6|六乘六/.test(t)) st.sudokuSize = 6;
      else if (/九宫格|9\s*[x×乘*]\s*9|九乘九|标准数独/.test(t)) st.sudokuSize = 9;
      const addLv = t.match(/(?:再|多)?加(\d+|[一二两三四五六七八九十]+)\s*关/);
      const setLv = t.match(/(\d+|[一二两三四五六七八九十]+)\s*关/);
      if (addLv) { st.levels = MW.clamp(st.levels + cnNum(addLv[1]), 3, 12); notes.push(`现在一共 ${st.levels} 关`); }
      else if (setLv) { st.levels = MW.clamp(cnNum(setLv[1]), 3, 12); notes.push(`一共 ${st.levels} 关`); }
      else if (/多几关|多加几关|再来几关/.test(t)) { st.levels = MW.clamp(st.levels + 3, 3, 12); notes.push(`现在一共 ${st.levels} 关`); }
    }
    if (mode === 'combat') {
      const wv = t.match(/(\d+|[一二两三四五六七八九十]+)\s*波/);
      if (wv) { st.waves = MW.clamp(cnNum(wv[1]), 3, 8); notes.push(`一共 ${st.waves} 波敌人`); }
    }

    // 颜色
    const cols = [];
    const colorRe = /(粉红|粉粉|彩虹色|五颜六色|七彩)|(红|橙|黄|绿|青|蓝|紫|粉|金|白|银|黑)色/g;
    let cm;
    while ((cm = colorRe.exec(t))) cols.push(cm[1] ? (/粉/.test(cm[1]) ? 'pink' : 'rainbow') : cm[2]);
    if (cols.length) {
      if (cols[0] === 'rainbow') { spec.colors = { main: '#ff7ad9', second: '#4ff3ff', accent: '#ffe45c' }; notes.push('颜色换成了彩虹色'); }
      else {
        const c1 = COLOR_MAP[cols[0] === 'pink' ? '粉' : cols[0]];
        spec.colors.main = c1;
        if (cols[1] && cols[1] !== 'rainbow') spec.colors.second = COLOR_MAP[cols[1] === 'pink' ? '粉' : cols[1]];
        else if (spec.colors.second === c1) spec.colors.second = '#4ff3ff';
        notes.push(`主色换成了${COLOR_NAME[c1]}${cols[0] === '黑' ? '（全息投影是光，没有黑色，我用了深紫色）' : ''}`);
      }
    }

    // 名字：玩家自己起的名字一直保留
    if (newName) { spec.name = newName; spec.namedByUser = true; notes.push(`名字改成了「${spec.name}」`); }
    else if (fresh || (!spec.namedByUser && notes.some((n) => /场景|玩法|口算|数独/.test(n)))) {
      spec.name = makeName(spec.mode, spec.scene, st.mathType);
      if (fresh) spec.namedByUser = false;
    }

    // 什么都没听懂：随便变一点，让玩家看到有变化
    if (!fresh && !notes.length) {
      spec.colors = shiftPalette(spec.colors);
      notes.push('这句我没完全听懂，先帮你换了一组新颜色');
      notes.push('可以说得具体一点，比如“加 5 只恐龙”“难一点”“换成太空”');
    }

    spec.intro = `欢迎来到「${spec.name}」！` + { combat: '准备好战斗了吗？', gentle: '慢慢逛，摸摸小动物吧。', math: '一起去点亮浮空岛吧！', snake: '好多蛇已经在等你啦！' }[spec.mode];
    const out = sanitize(spec, prev, text, true);
    const reply = fresh && !prev ? summaryReply(out) : editReply(out, notes, fresh);
    return { spec: out, reply };
  }

  function palette(scene) {
    const c = (D.SCENES[scene] || D.SCENES.city).colors;
    return { main: c[0], second: c[1], accent: c[2] };
  }
  function shiftPalette(colors) {
    const out = {};
    const dh = MW.rand(0.15, 0.4);
    for (const k of ['main', 'second', 'accent']) {
      const col = new THREE.Color(colors[k]);
      const hsl = {};
      col.getHSL(hsl);
      col.setHSL((hsl.h + dh) % 1, Math.max(0.6, hsl.s), MW.clamp(hsl.l, 0.55, 0.75));
      out[k] = '#' + col.getHexString();
    }
    return out;
  }

  function listChars(spec) {
    return spec.characters.map((c) => `${c.name}×${c.count}`).join('、');
  }
  function modeLine(spec) {
    const st = spec.settings;
    switch (spec.mode) {
      case 'combat': return `一共 ${st.waves} 波敌人，打完有奖励。被打倒了：有复活石就能直接复活，没有就要看 ${MW.save.settings.adMin}~${MW.save.settings.adMax} 秒广告，会员可以跳过。`;
      case 'math': return `${st.levels} 座浮空岛，每座一道${st.mathType === 'arith' ? '口算题' : '数独'}，闯关成功送金星。答错了要看广告，会员可以跳过。`;
      case 'snake': return `${st.snakeCount} 条电脑蛇会一直玩，撞死了会自己复活，直到你说“不玩了”它们才停下来。`;
      default: return '这里没有敌人，也不会死，摸摸小动物、收集星星就好。';
    }
  }
  function summaryReply(spec) {
    const free = spec.equipment.filter((e) => e.price === 'free').map((e) => e.name);
    const vip = spec.equipment.filter((e) => e.price === 'vip').map((e) => e.name);
    const ideas = D.editIdeas(spec);
    return [
      `好嘞！「${spec.name}」已经下载好了 ✨`,
      `人物：${listChars(spec)}`,
      `小零件：${spec.parts.map((p) => `${p.name}×${p.count}`).join('、')}`,
      `装备：${free.join('、')}（免费）；${vip.join('、')}（会员专属）`,
      modeLine(spec),
      `看看投影！哪里不满意就直接告诉我，比如“${ideas[0]}”。`,
    ].join('\n');
  }
  function editReply(spec, notes, fresh) {
    if (fresh) return summaryReply(spec);
    return ['收到！改好啦：', ...notes.map((n) => '· ' + n), '还有哪里想改？'].join('\n');
  }

  // ---------- 清洗：不管 AI 回什么，都整理成游戏能用的世界 ----------
  const clampInt = (v, a, b, d) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? MW.clamp(n, a, b) : d; };
  const clampNum = (v, a, b, d) => { const n = Number(v); return Number.isFinite(n) ? MW.clamp(n, a, b) : d; };
  const str = (v, max) => (typeof v === 'string' ? v.replace(/[\u0000-\u001f<>]/g, '').trim().slice(0, max) : '');
  function hex(v) {
    if (typeof v !== 'string' || !/^#?[0-9a-fA-F]{6}$/.test(v.trim())) return null;
    const col = new THREE.Color(v.trim().startsWith('#') ? v.trim() : '#' + v.trim());
    const hsl = {};
    col.getHSL(hsl);
    if (hsl.l < 0.45) col.setHSL(hsl.h, Math.max(hsl.s, 0.5), 0.6); // 太暗的颜色在全息里看不见
    return '#' + col.getHexString();
  }
  function nearestShape(name) {
    const n = String(name || '');
    for (const [s, re] of SHAPE_KW) { re.lastIndex = 0; if (re.test(n)) return s; }
    return 'slime';
  }
  function sanitize(s, prev, text, trusted) {
    if (!s || typeof s !== 'object') return null;
    const mode = D.MODES[s.mode] ? s.mode : prev ? prev.mode : detectMode(text || '') || 'combat';
    const base = TEMPLATES[mode]();
    const out = {};
    out.id = prev && prev.mode === mode ? prev.id : MW.uid();
    out.rev = prev ? (prev.rev || 0) + 1 : 0;
    out.created = prev && prev.mode === mode ? prev.created || Date.now() : Date.now();
    out.mode = mode;
    out.scene = D.SCENES[s.scene] ? s.scene : base.scene;
    const st = s.settings && typeof s.settings === 'object' ? s.settings : {};
    const bs = base.settings;
    out.settings = {
      difficulty: clampInt(st.difficulty, 1, 5, bs.difficulty),
      speed: clampNum(st.speed, 0.6, 1.8, 1),
      weather: D.WEATHER[st.weather] ? st.weather : bs.weather,
      waves: clampInt(st.waves, 3, 8, 5),
      snakeCount: clampInt(st.snakeCount, 4, 40, 16),
      levels: clampInt(st.levels, 3, 12, 6),
      mathType: st.mathType === 'arith' ? 'arith' : 'sudoku',
      sudokuSize: [4, 6, 9].includes(Number(st.sudokuSize)) ? Number(st.sudokuSize) : 0,
    };
    out.name = str(s.name, 14) || makeName(mode, out.scene, out.settings.mathType);
    const pal = palette(out.scene);
    const cs = s.colors && typeof s.colors === 'object' ? s.colors : {};
    out.colors = { main: hex(cs.main) || pal.main, second: hex(cs.second) || pal.second, accent: hex(cs.accent) || pal.accent };
    const hero = s.hero && typeof s.hero === 'object' ? s.hero : {};
    out.hero = { name: str(hero.name, 8) || base.hero.name, shape: D.SHAPES[hero.shape] ? hero.shape : base.hero.shape };
    const chars = Array.isArray(s.characters) ? s.characters : [];
    out.characters = chars.slice(0, 6).filter((c) => c && typeof c === 'object').map((c) => ({
      name: str(c.name, 8) || '神秘角色',
      role: mode === 'gentle' || mode === 'math' ? 'friend' : mode === 'snake' ? 'enemy' : c.role === 'friend' ? 'friend' : 'enemy',
      shape: D.SHAPES[c.shape] ? c.shape : nearestShape(c.name),
      count: clampInt(c.count, 1, 12, 2),
      desc: str(c.desc, 30),
    }));
    if (!out.characters.length) out.characters = base.characters;
    if (mode === 'combat' && !out.characters.some((c) => c.role === 'enemy')) out.characters.unshift(base.characters[0]);
    const parts = Array.isArray(s.parts) ? s.parts : [];
    out.parts = parts.slice(0, 8).filter((p) => p && D.PARTS[p.type]).map((p) => ({
      name: str(p.name, 8) || D.PARTS[p.type][0],
      type: p.type,
      count: clampInt(p.count, 1, p.type === 'star' ? 40 : 14, 3),
    }));
    if (!out.parts.length) out.parts = base.parts;
    const eqs = Array.isArray(s.equipment) ? s.equipment : [];
    out.equipment = eqs.slice(0, 7).filter((e) => e && typeof e === 'object').map((e) => {
      const effect = fitEffect(String(e.effect || ''), mode);
      const price = e.price === 'vip' ? 'vip' : 'free';
      let power = clampNum(e.power, 1, effect === 'summon' ? 10 : 5, powerFor(effect, price === 'vip'));
      if (effect === 'speed') power = MW.clamp(power, 1.1, 2);
      if (effect === 'summon') power = Math.max(3, Math.round(power < 3 ? powerFor('summon', price === 'vip') : power));
      const icon = typeof e.icon === 'string' && e.icon.trim() && [...e.icon.trim()].length <= 3 ? e.icon.trim() : EFFECT_ICON[effect];
      return { name: str(e.name, 10) || '神秘装备', icon, price, effect, power, desc: str(e.desc, 36) };
    });
    if (!out.equipment.some((e) => e.price === 'free')) out.equipment.push(...base.equipment.filter((e) => e.price === 'free').slice(0, 2));
    if (!out.equipment.some((e) => e.price === 'vip')) out.equipment.push(...base.equipment.filter((e) => e.price === 'vip').slice(0, 2));
    out.equipment.forEach((e, i) => {
      e.id = 'e' + (MW.hash(e.name + e.effect) % 100000);
      e.desc = D.effectDesc(e.effect, e.power, mode); // 说明一律按真实效果写，避免和玩法对不上
      if (out.equipment.findIndex((x) => x.id === e.id) !== i) e.id += 'b' + i;
    });
    out.rewards = (Array.isArray(s.rewards) ? s.rewards : base.rewards).map((r) => str(r, 8)).filter(Boolean).slice(0, 4);
    if (!out.rewards.length) out.rewards = base.rewards;
    out.intro = str(s.intro, 60) || `欢迎来到${out.name}！`;
    out.namedByUser = !!(s.namedByUser || (prev && prev.namedByUser && out.name === prev.name));
    return out;
  }

  // ---------- AI 设计师 ----------
  D.aiState = 'off'; // off 本地 / wait 连接中 / on 在线
  let samplePromise = null;
  D.initAI = () => {
    if (!window.claude || typeof window.claude.use !== 'function') { D.aiState = 'off'; MW.emit('ai'); return; }
    D.aiState = 'wait';
    MW.emit('ai');
    samplePromise = window.claude.use('sample').then((s) => {
      D.aiState = s ? 'on' : 'off';
      MW.emit('ai');
      return s;
    }).catch(() => { D.aiState = 'off'; MW.emit('ai'); return null; });
  };
  function slim(spec) {
    const o = MW.clone(spec);
    delete o.id; delete o.rev; delete o.created;
    (o.equipment || []).forEach((e) => { delete e.id; });
    return o;
  }
  function buildPrompt(text, prev, history) {
    const L = [];
    L.push('你是儿童游戏《我的世界》里的“AI 世界设计师”。玩家（多半是小朋友）用一句话说出想要的游戏空间，你来设计一个能直接生成 3D 全息世界的方案。');
    L.push('');
    L.push('设计要求：');
    L.push('- 适合小朋友：可爱、好玩、可以刺激，但不血腥、不恐怖，不出现真实品牌。');
    L.push('- 名字、描述、回复用简体中文，要有想象力；字段值只能从下面的选项里选（英文）。');
    L.push('- mode 只能是：combat（可以打击的战斗空间，打败一波波敌人）、gentle（温柔放松的空间，没有敌人，摸小动物、收集星星）、math（高空数学闯关：一座座浮空岛，每座岛一道数独或口算题）、snake（贪吃蛇乐园：很多电脑蛇死了会自己复活，一直玩到玩家说不玩了）。');
    L.push('- 游戏规则是固定的，不要改，也不要承诺别的规则：失败时有复活石就复活，没有就看 20~30 秒广告；会员 1 元/月，跳过所有广告、可以用所有装备。');
    L.push('- equipment 里 price 为 "free" 的人人能用，"vip" 的只有会员能用；至少 2 个 free，至少 2 个 vip。');
    if (prev) L.push('- 这是一次修改：保留玩家没提到的部分（名字、人物、零件、装备等），只改他要求的地方；如果他想换一种玩法，就换 mode 并重新设计。');
    L.push('');
    L.push('可选值：');
    L.push('scene: sky 高空 | space 太空 | forest 森林 | ocean 海底 | volcano 火山 | ice 冰雪 | candy 糖果 | city 霓虹城市 | desert 沙漠 | grass 草地');
    L.push('shape（人物外形）: robot 机器人 | cat 猫 | dog 狗 | rabbit 兔子 | bear 熊 | dino 恐龙 | dragon 龙 | ghost 幽灵 | ninja 忍者 | knight 骑士 | fairy 仙女或公主 | alien 外星人 | slime 史莱姆 | monster 怪兽 | bird 鸟 | fish 鱼 | unicorn 独角兽 | zombie 僵尸');
    L.push('parts.type（小零件）: tree 树 | crystal 水晶 | cloud 云 | flower 花 | tower 塔 | chest 宝箱 | coin 金币 | heart 补血爱心 | star 星星 | portal 传送门 | rock 石头 | lamp 灯 | house 房子 | mushroom 蘑菇 | jumppad 弹跳板 | candy 棒棒糖 | rainbow 彩虹 | castle 城堡 | musicbox 音乐盒');
    L.push('equipment.effect：combat 用 damage 攻击力 | range 攻击范围和远程 | shield 护盾 | speed 速度 | heal 回血 | summon 召唤全息蛇帮忙 | magnet 吸金币；gentle 用 speed | magnet | trail 彩虹足迹 | jump 跳得高；math 用 hint 提示 | shield 答错保护 | auto 自动填数；snake 用 speed 加速 | magnet 吸豆子 | shield 无敌 | ghost 穿过别的蛇 | double 双倍成长');
    L.push('weather: none | snow | rain | petals | bubbles | stars | embers');
    L.push('');
    if (prev) { L.push('玩家现在的世界（JSON）：'); L.push(JSON.stringify(slim(prev))); L.push(''); }
    if (history && history.length) {
      L.push('最近的对话：');
      for (const h of history) L.push((h.role === 'me' ? '玩家：' : '设计师：') + String(h.text).slice(0, 120).replace(/\n/g, ' '));
      L.push('');
    }
    L.push((prev ? '玩家想这样改：' : '玩家说：') + '「' + text + '」');
    L.push('');
    L.push('只回复一个 JSON 对象，不要别的文字。格式：');
    L.push('{"reply":"对玩家说的话：2~4 句，亲切活泼，说清楚你设计了什么或改了什么，最后邀请他继续提要求","spec":{"name":"世界名字(2~10字)","mode":"…","scene":"…","colors":{"main":"#RRGGBB","second":"#RRGGBB","accent":"#RRGGBB"},"hero":{"name":"主角名","shape":"…"},"characters":[{"name":"…","role":"enemy 或 friend","shape":"…","count":1到12,"desc":"一句话"}],"parts":[{"name":"…","type":"…","count":1到12}],"equipment":[{"name":"…","icon":"一个emoji","price":"free 或 vip","effect":"…","power":1到3,"desc":"一句话说明效果"}],"rewards":["奖励名"],"settings":{"difficulty":1到5,"speed":0.6到1.8,"weather":"…","waves":3到8,"snakeCount":4到40,"levels":3到12,"mathType":"sudoku 或 arith","sudokuSize":0或4或6或9},"intro":"进入世界时语音播报的欢迎词，一句话"}}');
    L.push('说明：characters 2~5 种（combat 至少 1 种 enemy；gentle 和 math 全是 friend；snake 里 characters 表示几支电脑蛇队伍，count 是每队几条）；parts 3~6 种；equipment 4~6 个；颜色要明亮，适合会发光的全息投影。');
    return L.join('\n');
  }
  function handleAiError(e) {
    const code = e && e.code;
    if (['not_granted', 'sampling_disabled', 'not_declared', 'capability_disabled', 'capability_removed'].includes(code)) {
      D.aiState = 'off';
      MW.emit('ai');
      MW.toast('AI 设计师没有开启，先用本地设计师帮你做');
    } else if (code === 'session_expired') {
      D.aiState = 'off';
      MW.emit('ai');
      MW.toast('登录过期了，重新登录 claude.ai 后 AI 设计师才能回来');
    } else if (code === 'rate_limited') {
      MW.toast('AI 设计师有点忙，这次先用本地设计师');
    } else {
      MW.toast('AI 设计师开小差了，这次先用本地设计师');
    }
  }
  D.design = async (text, prev, opts = {}) => {
    if (D.aiState === 'on' || D.aiState === 'wait') {
      const sample = await samplePromise;
      if (sample) {
        try {
          const json = await sample.json(buildPrompt(text, prev, (opts.history || []).slice(-6)), {
            modelTier: MW.save.settings.aiTier === 'smart' ? 'default' : 'quick',
            cache: false,
            signal: opts.signal,
            onText: (u) => { if (opts.onText) opts.onText(u.text); },
          });
          const spec = sanitize(json && json.spec, prev, text, false);
          if (spec) {
            const reply = json && typeof json.reply === 'string' && json.reply.trim() ? json.reply.trim().slice(0, 500) : summaryReply(spec);
            return { spec, reply, source: 'ai' };
          }
        } catch (e) {
          if (e && e.code === 'cancelled') throw e;
          handleAiError(e);
        }
      }
    }
    const r = localDesign(text, prev);
    r.source = 'local';
    return r;
  };

  D.editIdeas = (spec) => ({
    combat: ['敌人再多一点', '加一只恐龙朋友', '换成太空', '难一点', '给我一把激光枪', '下点雪'],
    gentle: ['加好多小兔子', '换成粉色', '下点雪', '加一座城堡', '再放几个音乐盒', '我想当独角兽'],
    math: ['再加 3 关', '换成口算', '简单一点', '换成糖果世界', '数独换成九宫格', '加点彩虹'],
    snake: ['蛇再多一点', '快一点', '换成海底', '30 条蛇', '换成彩虹色', '简单一点'],
  }[spec.mode]);
  D.wishIdeas = [
    '可以打击的空间，有机器人和忍者',
    '温柔的空间，有小兔子和会开的花',
    '高空的数学游戏空间，有数独闯关',
    '好多好多贪吃蛇，死了还会复活',
    '在太空里打外星人，要刺激一点',
    '糖果世界里做口算题',
  ];
  D.wishIcons = ['⚔️', '🌸', '🔢', '🐍', '🚀', '🍭'];
  D.localDesign = localDesign; // 方便调试
})();
