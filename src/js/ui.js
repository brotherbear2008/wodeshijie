/* 我的世界 · ui：页面切换、对话框、图稿、和设计师聊天、游戏按钮、键盘和触屏 */
(function () {
  'use strict';
  const MW = window.MW;
  const $ = MW.$, $$ = MW.$$;
  const UI = (MW.ui = {});
  const D = () => MW.designer;

  UI.show = (name) => {
    ['home', 'gen', 'design', 'hud'].forEach((id) => { $('#' + id).hidden = id !== name; });
    document.body.dataset.screen = name;
  };

  // ---------- 对话框（游戏内自己画，不用浏览器弹窗） ----------
  let dlgTimer = 0;
  UI.dialog = ({ title, html, buttons = [], cls = '' }) => {
    clearInterval(dlgTimer);
    const ov = $('#dialog');
    ov.querySelector('.dialog').className = 'dialog ' + cls;
    $('#dlgTitle').innerHTML = title;
    $('#dlgBody').innerHTML = html || '';
    const box = $('#dlgBtns');
    box.innerHTML = '';
    buttons.forEach((b) => {
      const el = document.createElement('button');
      el.type = 'button';
      el.className = 'btn ' + ({ primary: 'btn-primary', vip: 'btn-vip', quiet: 'btn-quiet', danger: 'btn-danger' }[b.kind] || '');
      el.innerHTML = b.label;
      el.addEventListener('click', () => {
        clearInterval(dlgTimer);
        MW.sfx('click');
        UI.closeDialog();
        if (b.onClick) b.onClick();
      });
      box.appendChild(el);
      if (b.countdown) {
        let n = b.countdown;
        const base = b.label;
        el.innerHTML = `${base} <span class="cd">${n}</span>`;
        dlgTimer = setInterval(() => {
          n--;
          if (n <= 0) { clearInterval(dlgTimer); el.click(); }
          else el.innerHTML = `${base} <span class="cd">${n}</span>`;
        }, 1000);
      }
    });
    ov.hidden = false;
    requestAnimationFrame(() => { const f = box.querySelector('button'); if (f) f.focus({ preventScroll: true }); });
  };
  UI.closeDialog = () => { clearInterval(dlgTimer); $('#dialog').hidden = true; };
  UI.dialogOpen = () => !$('#dialog').hidden;

  // ---------- 下载中 ----------
  let genTimer = 0, genT0 = 0;
  const GEN_TITLES = ['正在听懂你的愿望…', '正在设计人物…', '正在打造小零件…', '正在画图稿…', '正在投影 3D 世界…'];
  UI.genStart = () => {
    genT0 = performance.now();
    $('#genAi').textContent = MW.designer.aiState === 'off' ? '本地设计师工作中' : 'AI 设计师思考中…';
    clearInterval(genTimer);
    const tick = () => {
      const el = (performance.now() - genT0) / 1000;
      const pct = Math.min(92, 100 * (1 - Math.exp(-el / 3.2)));
      const step = Math.min(4, Math.floor(pct / 20));
      $('#genFill').style.width = pct + '%';
      $('#genTitle').textContent = GEN_TITLES[step];
      $$('#genSteps li').forEach((li, i) => li.classList.toggle('on', i <= step));
    };
    tick();
    genTimer = setInterval(tick, 160);
  };
  UI.genText = (text) => { $('#genAi').textContent = `AI 设计师正在画图稿… 已经写了 ${text.length} 个字`; };
  UI.genDone = () => {
    clearInterval(genTimer);
    $('#genFill').style.width = '100%';
    $$('#genSteps li').forEach((li) => li.classList.add('on'));
  };

  // ---------- 和设计师聊天 ----------
  UI.chatClear = () => { $('#chatLog').innerHTML = ''; };
  UI.chatAdd = (role, text, opts = {}) => {
    const log = $('#chatLog');
    const el = document.createElement('div');
    el.className = 'msg msg-' + role;
    el.innerHTML = (role === 'ai' ? '<span class="orb" aria-hidden="true"></span>' : '') + '<div class="bubble"></div>';
    const b = el.querySelector('.bubble');
    log.appendChild(el);
    const set = (t) => { b.innerHTML = MW.esc(t).replace(/\n/g, '<br>'); };
    if (opts.typing) b.innerHTML = '<span class="typing"><i></i><i></i><i></i></span>';
    else if (opts.stream) {
      // 一个字一个字冒出来
      let i = 0;
      const chars = [...text];
      const step = Math.max(1, Math.round(chars.length / 60));
      const iv = setInterval(() => {
        i = Math.min(chars.length, i + step);
        set(chars.slice(0, i).join(''));
        if (opts.scroll !== false) scrollChat();
        if (i >= chars.length) clearInterval(iv);
      }, 16);
    } else set(text);
    if (opts.scroll !== false) scrollChat();
    return { el, set, remove: () => el.remove() };
  };
  function scrollChat() {
    const sc = $('#sheetScroll');
    sc.scrollTop = sc.scrollHeight;
  }
  UI.renderChat = (chat) => {
    UI.chatClear();
    chat.forEach((m) => UI.chatAdd(m.role, m.text));
  };
  UI.setBusy = (on) => { document.body.classList.toggle('busy', on); };
  UI.setEditChips = (ideas) => {
    $('#chatInput').placeholder = `哪里不满意？比如：${ideas[0]}、${ideas[2]}`;
    const box = $('#editChips');
    box.innerHTML = '';
    ideas.forEach((t) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip'; b.textContent = t;
      b.addEventListener('click', () => MW.emit('editIdea', t));
      box.appendChild(b);
    });
  };
  UI.aiState = () => {
    const el = $('#aiState');
    const s = MW.designer.aiState;
    el.textContent = s === 'on' ? '● AI 设计师在线' : s === 'wait' ? '连接中…' : '本地设计师';
    el.classList.toggle('on', s === 'on');
  };

  // ---------- 图稿 ----------
  UI.renderBlueprint = (spec, layout) => {
    const d = D();
    $('#bpCode').textContent = 'MW-' + MW.hash(spec.id).toString(16).slice(-4).toUpperCase() + (spec.rev ? ' · 第 ' + (spec.rev + 1) + ' 稿' : '');
    $('#bpName').textContent = spec.name;
    const st = spec.settings;
    const tags = [
      `<span class="tag tag-mode">${d.MODES[spec.mode].icon} ${d.modeLabel(spec)}</span>`,
      `<span class="tag">场景 · ${d.SCENES[spec.scene].label}</span>`,
      `<span class="tag tag-diff">难度 ${'★'.repeat(st.difficulty)}${'☆'.repeat(5 - st.difficulty)}</span>`,
    ];
    if (st.weather !== 'none') tags.push(`<span class="tag">${d.WEATHER[st.weather]}</span>`);
    $('#bpTags').innerHTML = tags.join('');
    $('#bpMap').innerHTML = mapSvg(spec, layout);
    $('#bpCaption').textContent = caption(spec, layout);
    $('#bpCharsTitle').textContent = spec.mode === 'snake' ? '电脑蛇队伍' : '人物';
    const hero = `<div class="card"><div class="ico">${d.SHAPES[spec.hero.shape][1]}</div><b>${MW.esc(spec.hero.name)}</b><small><span class="role role-friend">主角</span>就是你</small></div>`;
    $('#bpChars').innerHTML = (spec.mode === 'snake' ? `<div class="card"><div class="ico">🐍</div><b>${MW.esc(spec.hero.name)}</b><small><span class="role role-friend">你</span>用方向键控制</small></div>` : hero) +
      spec.characters.map((c) => {
        const icon = spec.mode === 'snake' ? '🐍' : d.SHAPES[c.shape][1];
        const role = spec.mode === 'snake' ? '电脑蛇' : c.role === 'enemy' ? '敌人' : '朋友';
        return `<div class="card ${c.role}"><div class="ico">${icon}</div><b>${MW.esc(c.name)}<span class="cnt">×${c.count}</span></b><small><span class="role role-${c.role}">${role}</span>${MW.esc(c.desc || '')}</small></div>`;
      }).join('');
    $('#bpParts').innerHTML = spec.parts.map((p) => `<span class="chip">${d.PARTS[p.type][1]} ${MW.esc(p.name)}<b>×${p.count}</b></span>`).join('');
    UI.renderEquip(spec);
    $('#bpRules').innerHTML = rules(spec).map((r) => `<li>${r}</li>`).join('');
  };
  UI.renderEquip = (spec) => {
    const ids = MW.eco.equippedIds(spec);
    $('#bpEquip').innerHTML = spec.equipment.map((e) => MW.eco.equipRowHtml(spec, e, ids)).join('');
    $$('#bpEquip [data-eq]').forEach((b) => b.addEventListener('click', () => MW.eco.toggleEquip(spec, b.dataset.eq, () => UI.renderEquip(spec))));
  };
  function rules(spec) {
    const st = spec.settings, s = MW.save.settings;
    const ad = `${s.adMin}~${s.adMax} 秒`;
    const fail = `有 <b>💎复活石</b> 就直接复活；没有就要看 <b>${ad}广告</b>；<b>👑会员 ¥1/月</b> 跳过所有广告`;
    const keys = MW.isTouch ? '' : spec.mode === 'snake' ? '方向键 / WASD 转弯，Shift 加速，Q 放技能' : spec.mode === 'math' ? '点浮空岛开始答题，数字键直接填数' : `WASD / 方向键走路，${spec.mode === 'combat' ? '空格攻击' : '空格摸摸小动物'}，Shift 跳`;
    switch (spec.mode) {
      case 'combat': return [
        `打败 <b>${st.waves} 波</b>敌人就赢，最后一波有大 Boss`,
        `被打倒了：${fail}`,
        '赢了奖励 🪙金币 + 💎复活石；打怪、开宝箱也能捡金币',
        '会员还能用所有会员装备',
        keys,
      ].filter(Boolean);
      case 'gentle': return [
        '这里<b>没有敌人，不会死，也没有广告</b>',
        '走到小动物旁边摸摸它，它就会跟着你',
        '收集所有星星有奖励；走过的花会开',
        keys,
      ].filter(Boolean);
      case 'math': return [
        `一共 <b>${st.levels} 座浮空岛</b>，每座一道${st.mathType === 'arith' ? '口算题（8 题）' : '数独'}，越往上越难`,
        '闯关成功：⭐金星 + 🪙金币，每 3 关再送 💎复活石',
        `答错一次：${fail}`,
        keys,
      ].filter(Boolean);
      default: return [
        `<b>${st.snakeCount} 条电脑蛇</b>一直在玩：撞死了会自己复活，直到你按「不玩了」才停下来`,
        `你的蛇撞到墙或别的蛇：${fail}`,
        '吃豆子变长，越长奖励越多；死掉的蛇会变成豆子',
        keys,
      ].filter(Boolean);
    }
  }
  function caption(spec, layout) {
    if (spec.mode === 'math') return `侧视图 · ${spec.settings.levels} 座浮空岛，一层比一层高`;
    if (spec.mode === 'snake') return `俯视图 · 方格场地 ${MW.modes.snake.gridSize(spec)}×${MW.modes.snake.gridSize(spec)} 格 · ${spec.settings.snakeCount} 条电脑蛇`;
    const n = layout ? layout.parts.length : 0;
    return `俯视图 · 直径 ${MW.holo.R * 2} 格 · ${spec.parts.length} 种小零件共 ${n} 个`;
  }
  function mapSvg(spec, layout) {
    const d = D();
    const c = spec.colors;
    const R = MW.holo.R;
    const out = [];
    out.push('<defs><pattern id="bpg" width="2" height="2" patternUnits="userSpaceOnUse"><path d="M2 0H0V2" fill="none" stroke="rgba(79,243,255,0.12)" stroke-width="0.05"/></pattern></defs>');
    out.push('<rect x="-17" y="-17" width="34" height="34" fill="url(#bpg)"/>');
    const t = (x, y, s, size = 1.5, extra = '') => `<text x="${x.toFixed(2)}" y="${y.toFixed(2)}" font-size="${size}" text-anchor="middle" dominant-baseline="central" ${extra}>${s}</text>`;
    if (spec.mode === 'math') {
      const L = spec.settings.levels;
      const pts = [];
      for (let i = 0; i < L; i++) {
        const x = -13 + (26 * i) / Math.max(1, L - 1);
        const y = 12 - (24 * i) / Math.max(1, L - 1) + (i % 2 ? -1.2 : 1.2);
        pts.push([x, y]);
      }
      out.push(`<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${c.accent}" stroke-width="0.12" stroke-dasharray="0.6 0.5"/>`);
      const prog = (MW.save.progress[spec.id] && MW.save.progress[spec.id].done) || [];
      pts.forEach(([x, y], i) => {
        out.push(`<ellipse cx="${x}" cy="${y + 0.4}" rx="1.9" ry="0.7" fill="rgba(79,243,255,0.12)" stroke="${c.main}" stroke-width="0.1"/>`);
        out.push(`<path d="M${x - 1.6} ${y + 0.6} L${x} ${y + 3} L${x + 1.6} ${y + 0.6}" fill="none" stroke="${c.main}" stroke-width="0.08" opacity="0.6"/>`);
        out.push(t(x, y - 0.9, prog[i] ? '⭐' : String(i + 1), prog[i] ? 1.4 : 1.2, `fill="${c.accent}" font-family="Chakra Petch, monospace" font-weight="700"`));
      });
      out.push(t(-13, 15.2, '起点', 1, 'fill="rgba(226,251,255,0.6)"'));
      out.push(t(13, -14.6, '最高处', 1, 'fill="rgba(226,251,255,0.6)"'));
      return out.join('');
    }
    if (spec.mode === 'snake') {
      const S = 12;
      out.push(`<rect x="${-S}" y="${-S}" width="${S * 2}" height="${S * 2}" fill="rgba(79,243,255,0.05)" stroke="${c.main}" stroke-width="0.15"/>`);
      const rng = MW.rng(spec.id + 'bp');
      const cols = [c.second, c.accent, c.main, '#ff9f43', '#5dffa8'];
      const n = Math.min(10, Math.ceil(spec.settings.snakeCount / 3));
      for (let i = 0; i < n; i++) {
        let x = Math.round(rng() * 18 - 9), y = Math.round(rng() * 18 - 9);
        const pts = [[x, y]];
        let dx = 1, dy = 0;
        for (let k = 0; k < 5 + Math.floor(rng() * 6); k++) {
          if (rng() < 0.35) { const tmp = dx; dx = dy; dy = tmp * (rng() < 0.5 ? 1 : -1); if (!dx && !dy) dx = 1; }
          x = MW.clamp(x + dx, -11, 11); y = MW.clamp(y + dy, -11, 11);
          pts.push([x, y]);
        }
        out.push(`<polyline points="${pts.map((p) => p.join(',')).join(' ')}" fill="none" stroke="${cols[i % cols.length]}" stroke-width="0.7" stroke-linecap="round" stroke-linejoin="round" opacity="0.85"/>`);
        out.push(`<circle cx="${pts[0][0]}" cy="${pts[0][1]}" r="0.55" fill="${cols[i % cols.length]}"/>`);
      }
      for (let i = 0; i < 26; i++) out.push(`<circle cx="${(rng() * 22 - 11).toFixed(1)}" cy="${(rng() * 22 - 11).toFixed(1)}" r="0.22" fill="${c.accent}"/>`);
      out.push(t(0, 14.2, '你的蛇从中间出发', 1, 'fill="rgba(226,251,255,0.6)"'));
      return out.join('');
    }
    // 打击 / 温柔：圆形投影台俯视图
    out.push(`<circle cx="0" cy="0" r="${R}" fill="rgba(79,243,255,0.05)" stroke="${c.main}" stroke-width="0.16"/>`);
    out.push(`<circle cx="0" cy="0" r="${R * 0.5}" fill="none" stroke="rgba(79,243,255,0.25)" stroke-width="0.06" stroke-dasharray="0.5 0.5"/>`);
    out.push(`<line x1="${-R}" y1="0" x2="${R}" y2="0" stroke="rgba(79,243,255,0.15)" stroke-width="0.05"/><line x1="0" y1="${-R}" x2="0" y2="${R}" stroke="rgba(79,243,255,0.15)" stroke-width="0.05"/>`);
    out.push(t(0, -R - 1.4, '北', 1, 'fill="rgba(226,251,255,0.55)"'));
    out.push(`<line x1="${R - 6}" y1="${R + 1.6}" x2="${R - 2}" y2="${R + 1.6}" stroke="rgba(226,251,255,0.55)" stroke-width="0.1"/>`);
    out.push(t(R - 4, R + 2.6, '4 格', 0.9, 'fill="rgba(226,251,255,0.55)" font-family="Chakra Petch, monospace"'));
    if (layout) {
      for (const p of layout.parts) {
        out.push(`<circle cx="${p.x.toFixed(2)}" cy="${p.z.toFixed(2)}" r="0.85" fill="rgba(255,228,92,0.1)" stroke="rgba(255,228,92,0.45)" stroke-width="0.06"/>`);
        out.push(t(p.x, p.z, d.PARTS[p.type][1], 1.05));
      }
      for (const ch of layout.chars) {
        const enemy = ch.role === 'enemy';
        out.push(`<circle cx="${ch.x.toFixed(2)}" cy="${ch.z.toFixed(2)}" r="1.05" fill="${enemy ? 'rgba(255,98,212,0.18)' : 'rgba(79,243,255,0.18)'}" stroke="${enemy ? c.second : c.main}" stroke-width="0.1"/>`);
        out.push(t(ch.x, ch.z, d.SHAPES[ch.shape][1], 1.2));
      }
    }
    out.push(`<circle cx="0" cy="0" r="1.4" fill="rgba(255,228,92,0.2)" stroke="${c.accent}" stroke-width="0.14"/>`);
    out.push(t(0, 0, '你', 1.1, `fill="${c.accent}" font-weight="900"`));
    return out.join('');
  }

  // ---------- 首页 ----------
  UI.renderHomeChips = () => {
    const box = $('#homeChips');
    box.innerHTML = '';
    D().wishIdeas.forEach((text, i) => {
      const b = document.createElement('button');
      b.type = 'button'; b.className = 'chip';
      b.textContent = D().wishIcons[i] + ' ' + text;
      b.addEventListener('click', () => MW.emit('wishIdea', text));
      box.appendChild(b);
    });
  };
  UI.renderSaved = () => {
    const worlds = MW.save.worlds || [];
    $('#savedBox').hidden = !worlds.length;
    $('#savedList').innerHTML = worlds.map((w) => {
      const date = new Date(w.created || Date.now());
      return `<div class="saved-item" role="button" tabindex="0" data-open="${w.id}"><span class="si-ico">${D().MODES[w.mode].icon}</span><span class="si-txt"><b>${MW.esc(w.name)}</b><small>${D().modeLabel(w)} · ${date.getMonth() + 1}月${date.getDate()}日</small></span><button class="saved-del" type="button" data-del="${w.id}" aria-label="删掉这个世界">✕</button></div>`;
    }).join('');
    $$('#savedList [data-open]').forEach((el) => {
      const open = (e) => { if (e.target.closest('[data-del]')) return; MW.emit('openSaved', el.dataset.open); };
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter') open(e); });
    });
    $$('#savedList [data-del]').forEach((b) => b.addEventListener('click', (e) => {
      e.stopPropagation();
      const w = worlds.find((x) => x.id === b.dataset.del);
      UI.dialog({
        title: '删掉这个世界？',
        html: `<p>「${MW.esc(w ? w.name : '')}」删掉以后就找不回来了。</p>`,
        buttons: [
          { label: '删掉', kind: 'danger', onClick: () => { MW.save.worlds = MW.save.worlds.filter((x) => x.id !== b.dataset.del); MW.persist(); UI.renderSaved(); } },
          { label: '留着', kind: 'quiet' },
        ],
      });
    }));
  };

  // ---------- 游戏中 ----------
  let lastInfo = '', lastSide = '', lastCenter = '';
  UI.hud = (info, side, center) => {
    if (info !== undefined && info !== lastInfo) { $('#hudInfo').innerHTML = info; lastInfo = info; }
    if (side !== undefined && side !== lastSide) { $('#hudSide').innerHTML = side; lastSide = side; }
    if (center !== undefined && center !== lastCenter) { $('#hudCenter').innerHTML = center; lastCenter = center; MW.emit('hudCenter'); }
  };
  UI.resetHud = () => { lastInfo = lastSide = lastCenter = null; $('#hudInfo').innerHTML = ''; $('#hudSide').innerHTML = ''; $('#hudCenter').innerHTML = ''; };
  UI.hurt = () => {
    const h = $('#hud');
    h.classList.remove('hurt');
    void h.offsetWidth;
    h.classList.add('hurt');
  };
  UI.renderSlots = (spec) => {
    const eq = MW.eco.activeEquip(spec);
    const box = $('#slots');
    const cells = [];
    for (let i = 0; i < 3; i++) {
      const e = eq[i];
      cells.push(e ? `<button class="slot" type="button" title="${MW.esc(e.name)}：${MW.esc(e.desc)}" data-slot="${i}">${MW.esc(e.icon)}</button>` : '<button class="slot empty" type="button" title="空的装备格" data-slot="x">＋</button>');
    }
    box.innerHTML = cells.join('');
    $$('#slots .slot').forEach((b) => b.addEventListener('click', () => MW.emit('openBag')));
  };
  UI.setupPlay = (spec) => {
    const mode = spec.mode;
    const hints = {
      combat: 'WASD / 方向键 走路 · 空格 攻击 · Shift 跳',
      gentle: 'WASD / 方向键 走路 · 空格 摸摸 · Shift 跳',
      math: '点发光的浮空岛开始答题 · 拖动可以转着看',
      snake: '方向键 / WASD 转弯 · 按住 Shift 加速 · Q 放技能',
    };
    $('#keyHint').textContent = hints[mode];
    UI.renderSlots(spec);
    const touch = MW.isTouch && mode !== 'math';
    $('#touch').hidden = !touch;
    document.body.classList.toggle('touch-on', touch);
    $('#joy').hidden = mode === 'snake';
    $('#dpad').hidden = mode !== 'snake';
    const acts = $('#acts');
    const list = {
      combat: [{ id: 'jump', label: '⤒' }, { id: 'attack', label: '⚔️', big: true }],
      gentle: [{ id: 'jump', label: '⤒' }, { id: 'attack', label: '💗', big: true }],
      snake: [{ id: 'skill', label: '✨' }, { id: 'boost', label: '🚀', big: true, hold: true }],
      math: [],
    }[mode];
    acts.innerHTML = list.map((a) => `<button type="button" class="act${a.big ? ' big' : ''}" data-act="${a.id}"${a.hold ? ' data-hold="1"' : ''} aria-label="${a.id}">${a.label}</button>`).join('');
    $$('#acts .act').forEach((b) => {
      const id = b.dataset.act;
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (b.dataset.hold) { MW.input.hold.add(id); b.classList.add('held'); }
        else MW.input.act.add(id);
      });
      const up = () => { MW.input.hold.delete(id); b.classList.remove('held'); };
      b.addEventListener('pointerup', up);
      b.addEventListener('pointerleave', up);
      b.addEventListener('pointercancel', up);
    });
  };

  // ---------- 设置 ----------
  UI.openSettings = () => {
    const s = MW.save.settings;
    const seg = (key, opts) => `<div class="seg" data-key="${key}">${opts.map(([v, l]) => `<button type="button" data-v="${v}" class="${String(s[key]) === String(v) ? 'on' : ''}">${l}</button>`).join('')}</div>`;
    const adNow = `${s.adMin}-${s.adMax}`;
    const html = `
      <div class="set-row"><span>背景音乐</span>${seg('music', [['true', '开'], ['false', '关']])}</div>
      <div class="set-row"><span>语音播报<small>进入世界时念欢迎词</small></span>${seg('voice', [['true', '开'], ['false', '关']])}</div>
      <div class="set-row"><span>画面特效<small>卡的话选流畅</small></span>${seg('fx', [['high', '炫酷'], ['low', '流畅']])}</div>
      <div class="set-row"><span>AI 设计师<small>精细会想得更久</small></span>${seg('aiTier', [['quick', '快速'], ['smart', '精细']])}</div>
      <div class="set-row"><span>广告时长<small>家长可以调</small></span><div class="seg" data-key="ad">${[['5-10', '5~10秒'], ['10-20', '10~20秒'], ['20-30', '20~30秒']].map(([v, l]) => `<button type="button" data-v="${v}" class="${adNow === v ? 'on' : ''}">${l}</button>`).join('')}</div></div>
      <div class="set-row"><span>会员状态</span><span>${MW.eco.isVip() ? `会员中，剩 ${MW.eco.vipDaysLeft()} 天` : '还不是会员'}</span></div>
      <p class="rule-note">存档保存在这台设备上；在 claude.ai 里打开时，还会同步到你的账号。</p>`;
    const buttons = [{ label: '好了', kind: 'primary' }];
    if (MW.eco.isVip()) buttons.push({ label: '取消会员（测试用）', kind: 'quiet', onClick: () => { MW.save.vipUntil = 0; MW.persist(); MW.eco.refreshWallet(); MW.toast('已取消会员'); } });
    UI.dialog({ title: '⚙ 设置', html, buttons });
    $$('#dlgBody .seg').forEach((g) => g.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const key = g.dataset.key, v = b.dataset.v;
      $$('button', g).forEach((x) => x.classList.toggle('on', x === b));
      if (key === 'ad') { const [a, c] = v.split('-').map(Number); s.adMin = a; s.adMax = c; }
      else if (key === 'music' || key === 'voice') s[key] = v === 'true';
      else s[key] = v;
      MW.persist();
      if (key === 'music') { if (s.music) { MW.audioUnlock(); MW.music.play(MW.music.want || 'home', true); } else MW.music.stop(); }
      if (key === 'fx') MW.holo.setQuality(v);
      MW.emit('settings');
    }));
  };

  // ---------- 键盘、摇杆、方向键 ----------
  const input = (MW.input = { keys: new Set(), joy: { x: 0, y: 0 }, act: new Set(), hold: new Set(), dirQ: [] });
  const isTyping = (e) => { const t = e.target; return t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable); };
  const DIRS = { ArrowUp: [0, -1], KeyW: [0, -1], ArrowDown: [0, 1], KeyS: [0, 1], ArrowLeft: [-1, 0], KeyA: [-1, 0], ArrowRight: [1, 0], KeyD: [1, 0] };
  window.addEventListener('keydown', (e) => {
    if (isTyping(e)) return;
    const playing = document.body.dataset.screen === 'hud' && !UI.dialogOpen() && $('#puzzle').hidden && $('#ad').hidden;
    if (!playing) return;
    if (!e.repeat) {
      if (e.code === 'Space' || e.code === 'KeyJ') input.act.add('attack');
      if (e.code === 'KeyE' || e.code === 'KeyK') input.act.add('interact');
      if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyL') input.act.add('jump');
      if (e.code === 'KeyQ') input.act.add('skill');
      if (DIRS[e.code]) input.dirQ.push(DIRS[e.code]);
    }
    input.keys.add(e.code);
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
  });
  window.addEventListener('keyup', (e) => input.keys.delete(e.code));
  window.addEventListener('blur', () => { input.keys.clear(); input.hold.clear(); });
  input.move = () => {
    const k = input.keys;
    let x = 0, y = 0;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y -= 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y += 1;
    x += input.joy.x; y += input.joy.y;
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    return { x, y };
  };
  input.take = (a) => { if (input.act.has(a)) { input.act.delete(a); return true; } return false; };
  input.boost = () => input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') || input.hold.has('boost');
  input.clear = () => { input.keys.clear(); input.act.clear(); input.hold.clear(); input.dirQ.length = 0; input.joy.x = input.joy.y = 0; };

  UI.initTouch = () => {
    const joy = $('#joy'), knob = $('#joyKnob');
    let id = null, cx = 0, cy = 0;
    const R = 50;
    joy.addEventListener('pointerdown', (e) => {
      id = e.pointerId;
      const r = joy.getBoundingClientRect();
      cx = r.left + r.width / 2; cy = r.top + r.height / 2;
      try { joy.setPointerCapture(id); } catch (err) { /* ignore */ }
      move(e);
    });
    const move = (e) => {
      if (e.pointerId !== id) return;
      let dx = e.clientX - cx, dy = e.clientY - cy;
      const l = Math.hypot(dx, dy);
      if (l > R) { dx *= R / l; dy *= R / l; }
      knob.style.transform = `translate(${dx}px, ${dy}px)`;
      input.joy.x = dx / R; input.joy.y = dy / R;
    };
    joy.addEventListener('pointermove', move);
    const end = (e) => {
      if (e.pointerId !== id) return;
      id = null;
      knob.style.transform = '';
      input.joy.x = input.joy.y = 0;
    };
    joy.addEventListener('pointerup', end);
    joy.addEventListener('pointercancel', end);
    $$('#dpad button').forEach((b) => b.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      input.dirQ.push(b.dataset.dir.split(',').map(Number));
    }));
    MW.on('stageSwipe', (dir) => { if (document.body.dataset.screen === 'hud') input.dirQ.push(dir); });
  };
})();
