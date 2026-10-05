/* 我的世界 · main：把所有东西串起来（首页 → 世界下载中 → 图稿 → 进入世界） */
(function () {
  'use strict';
  const MW = window.MW;
  const $ = MW.$;
  const state = (MW.state = { screen: 'boot', spec: null, layout: null, chat: [], lastWish: '', busy: false, ctl: null });
  MW.game = { mode: null, ctx: null, paused: false };
  const app = (MW.app = {});
  let homeGlobe = null;

  // 同一个世界每次摆放的位置都一样（图稿和 3D 对得上）
  MW.layoutFor = (spec) => {
    const rng = MW.rng(spec.id + ':' + (spec.rev || 0));
    const R = MW.holo.R;
    const placed = [{ x: 0, z: 0, r: 2.2 }];
    const spot = (minR, maxR, clear) => {
      for (let i = 0; i < 50; i++) {
        const a = rng() * Math.PI * 2, d = minR + Math.sqrt(rng()) * (maxR - minR);
        const x = Math.cos(a) * d, z = Math.sin(a) * d;
        if (placed.every((p) => (p.x - x) ** 2 + (p.z - z) ** 2 > (p.r + clear) ** 2)) { placed.push({ x, z, r: clear }); return { x, z }; }
      }
      const a = rng() * Math.PI * 2, d = minR + rng() * (maxR - minR);
      return { x: Math.cos(a) * d, z: Math.sin(a) * d };
    };
    const BIG = ['tower', 'house', 'castle', 'tree', 'rainbow'];
    const parts = [];
    if (spec.mode !== 'snake') {
      for (const p of spec.parts) {
        if (spec.mode === 'math' && (p.type === 'rock' || p.type === 'cloud')) continue;
        const cap = p.type === 'star' ? 20 : p.type === 'flower' ? 14 : spec.mode === 'math' ? 3 : 8;
        const big = BIG.includes(p.type);
        for (let i = 0; i < Math.min(p.count, cap); i++) parts.push({ type: p.type, name: p.name, ...spot(big ? 5 : 2.6, R - (big ? 2.2 : 1.2), big ? 1.7 : 0.9) });
      }
    }
    const chars = [];
    if (spec.mode === 'combat' || spec.mode === 'gentle') {
      for (const c of spec.characters) {
        const enemy = c.role === 'enemy';
        for (let i = 0; i < Math.min(c.count, enemy ? 4 : 3); i++) chars.push({ ...c, ...spot(enemy ? R * 0.55 : 2.4, enemy ? R - 1.4 : R * 0.62, 0.9) });
      }
    }
    return { parts, chars };
  };

  function buildWorld(spec) {
    const H = MW.holo;
    const old = MW.game.mode;
    if (old && old.dispose) old.dispose();
    homeGlobe = null;
    H.clearWorld();
    H.setScene(spec.scene, spec.colors);
    H.setWeather(spec.settings.weather, spec.colors);
    const top = spec.mode === 'math' ? Math.max(12, spec.settings.levels * 1.65 + 6) : 9;
    H.setWallHeight(top);
    H.world.add(MW.models.decorate(spec.scene, spec.colors, MW.rng(spec.id + 'deco')));
    const layout = MW.layoutFor(spec);
    const mode = MW.modes[spec.mode];
    const ctx = { spec, layout, group: H.world, colors: spec.colors, R: H.R, rng: MW.rng(spec.id + ':' + (spec.rev || 0) + 'b') };
    mode.build(ctx);
    MW.game.mode = mode;
    MW.game.ctx = ctx;
    MW.game.paused = false;
    H.materialize(2.2, top + 2);
    return layout;
  }

  function designShift() {
    const H = MW.holo;
    const mobile = window.innerWidth <= 760;
    H.cam.zoom = mobile && state.screen === 'design' ? 1.2 : 1;
    if (state.screen === 'gen') return H.setViewShift(0, window.innerHeight * 0.1);
    if (state.screen !== 'design') return H.setViewShift(0, 0);
    if (mobile) {
      const h = $('#sheet').getBoundingClientRect().height || window.innerHeight * 0.56;
      H.setViewShift(0, h * 0.5);
    } else {
      const w = $('#sheet').getBoundingClientRect().width || 440;
      H.setViewShift((w + 16) * 0.5, 0);
    }
  }
  function designCamera(spec) {
    const c = MW.holo.cam;
    c.mode = 'orbit'; c.auto = true; c.lerp = 2.5;
    if (spec.mode === 'math') { c.target.set(0, spec.settings.levels * 0.85, 0); c.dist = 34; c.height = 6; }
    else if (spec.mode === 'snake') { c.target.set(0, 0, 0); c.dist = 26; c.height = 21; }
    else { c.target.set(0, 1.2, 0); c.dist = 30; c.height = 15; }
    designShift();
  }
  function showDesign() {
    state.screen = 'design';
    MW.ui.show('design');
    designCamera(state.spec);
  }

  app.goHome = () => {
    if (state.ctl) state.ctl.abort();
    const m = MW.game.mode;
    if (state.screen === 'play' && m && m.stop) m.stop();
    MW.ui.closeDialog();
    $('#puzzle').hidden = true;
    if (m && m.dispose) m.dispose();
    MW.game.mode = null;
    MW.game.paused = false;
    MW.ui.resetHud();
    document.body.classList.remove('touch-on');
    state.screen = 'home';
    MW.ui.show('home');
    const H = MW.holo;
    H.clearWorld();
    const colors = { main: '#4ff3ff', second: '#ff62d4', accent: '#ffe45c' };
    H.setScene('home', colors);
    H.setWeather('none');
    H.setWallHeight(10);
    homeGlobe = MW.models.globe(colors);
    H.world.add(homeGlobe);
    const c = H.cam;
    c.mode = 'orbit'; c.auto = true; c.target.set(0, 4.5, 0); c.dist = 30; c.height = 9; c.lerp = 2;
    H.setViewShift(0, 0);
    MW.ui.renderSaved();
    MW.music.play('home');
  };

  app.makeWorld = async (text, prev) => {
    text = String(text || '').trim();
    if (!text) { MW.toast('先说说你想要什么样的世界吧～'); return; }
    if (state.busy) return;
    state.busy = true;
    MW.audioUnlock();
    const isEdit = !!prev;
    let typing = null;
    if (isEdit) {
      MW.ui.chatAdd('me', text);
      typing = MW.ui.chatAdd('ai', '', { typing: true });
      MW.ui.setBusy(true);
    } else {
      state.screen = 'gen';
      MW.ui.show('gen');
      MW.ui.genStart();
      designShift();
    }
    const ctl = (state.ctl = new AbortController());
    const t0 = performance.now();
    try {
      const res = await MW.designer.design(text, prev, {
        signal: ctl.signal,
        history: isEdit ? state.chat.slice(-6) : [],
        onText: (t) => { if (!isEdit) MW.ui.genText(t); },
      });
      const minT = isEdit ? 450 : 2000;
      const el = performance.now() - t0;
      if (el < minT) await MW.sleep(minT - el);
      if (ctl.signal.aborted) throw { code: 'cancelled' };
      if (typing) typing.remove();
      if (!isEdit) { MW.ui.genDone(); state.lastWish = text; }
      applySpec(res.spec, res.reply, isEdit, text);
    } catch (e) {
      if (typing) typing.remove();
      const cancelled = e && e.code === 'cancelled';
      if (!cancelled) { console.error(e); MW.toast('生成的时候出了点问题，再试一次吧', 'bad'); }
      if (isEdit) { if (!cancelled) MW.ui.chatAdd('ai', '这次没改成功，再说一遍试试？'); }
      else if (state.spec && MW.game.mode) showDesign();
      else app.goHome();
    } finally {
      state.busy = false;
      state.ctl = null;
      MW.ui.setBusy(false);
    }
  };

  function applySpec(spec, reply, isEdit, text) {
    state.spec = spec;
    saveWorld(spec);
    state.layout = buildWorld(spec);
    if (isEdit) state.chat.push({ role: 'me', text }, { role: 'ai', text: reply });
    else {
      state.chat = [{ role: 'me', text }, { role: 'ai', text: reply }];
      MW.ui.chatClear();
      MW.ui.chatAdd('me', text, { scroll: false });
    }
    if (state.chat.length > 40) state.chat = state.chat.slice(-40);
    showDesign();
    MW.ui.renderBlueprint(spec, state.layout);
    MW.ui.setEditChips(MW.designer.editIdeas(spec));
    MW.ui.chatAdd('ai', reply, { stream: true, scroll: isEdit });
    if (!isEdit) $('#sheetScroll').scrollTop = 0;
    MW.music.play(spec.mode);
  }
  function saveWorld(spec) {
    MW.save.worlds = [MW.clone(spec)].concat((MW.save.worlds || []).filter((w) => w.id !== spec.id)).slice(0, 10);
    MW.persist();
  }

  app.openSaved = (id) => {
    const spec = (MW.save.worlds || []).find((w) => w.id === id);
    if (!spec || !MW.modes[spec.mode]) return;
    MW.audioUnlock();
    state.spec = MW.clone(spec);
    state.lastWish = '';
    state.chat = [{ role: 'ai', text: `欢迎回来！这是你之前造的「${spec.name}」。想改哪里就告诉我，满意了就点「进入世界」。` }];
    state.layout = buildWorld(state.spec);
    showDesign();
    MW.ui.renderChat(state.chat);
    MW.ui.renderBlueprint(state.spec, state.layout);
    MW.ui.setEditChips(MW.designer.editIdeas(state.spec));
    $('#sheetScroll').scrollTop = 0;
    MW.music.play(state.spec.mode);
  };

  app.enterWorld = () => {
    if (!state.spec || state.busy || state.screen !== 'design' || !MW.game.mode) return;
    MW.audioUnlock();
    state.screen = 'play';
    MW.ui.show('hud');
    MW.ui.resetHud();
    MW.holo.setViewShift(0, 0);
    MW.holo.cam.zoom = 1;
    MW.game.paused = false;
    MW.input.clear();
    MW.ui.setupPlay(state.spec);
    MW.game.mode.start();
    MW.music.play(state.spec.mode);
    setTimeout(() => MW.say(state.spec.intro), 300);
  };
  app.quitPlay = (msg) => {
    if (state.screen !== 'play') return;
    MW.ui.closeDialog();
    $('#puzzle').hidden = true;
    $('#ad').hidden = true;
    const m = MW.game.mode;
    const modeMsg = m && m.stop ? m.stop() : null;
    MW.game.paused = false;
    MW.music.duck(false);
    MW.input.clear();
    MW.ui.resetHud();
    document.body.classList.remove('touch-on');
    showDesign();
    MW.ui.renderBlueprint(state.spec, state.layout);
    const text = msg || modeMsg;
    if (text) { MW.ui.chatAdd('ai', text); state.chat.push({ role: 'ai', text }); }
  };
  app.restartPlay = () => {
    const m = MW.game.mode;
    if (!m) return;
    if (m.stop) m.stop();
    MW.game.paused = false;
    MW.input.clear();
    MW.ui.resetHud();
    m.start();
    MW.ui.renderSlots(state.spec);
  };
  app.editFromPlay = (prefill) => {
    const ideas = MW.designer.editIdeas(state.spec);
    app.quitPlay(`想改哪里？直接告诉我，比如“${ideas[0]}”“${ideas[1]}”。`);
    const input = $('#chatInput');
    if (typeof prefill === 'string') input.value = prefill;
    setTimeout(() => input.focus({ preventScroll: true }), 300);
  };

  function restore(data) {
    state.spec = data.spec;
    state.chat = Array.isArray(data.chat) ? data.chat : [];
    state.lastWish = data.wish || '';
    state.layout = buildWorld(state.spec);
    showDesign();
    MW.ui.renderChat(state.chat);
    MW.ui.renderBlueprint(state.spec, state.layout);
    MW.ui.setEditChips(MW.designer.editIdeas(state.spec));
  }

  function tick(dt, t) {
    if (state.screen === 'home') { if (homeGlobe) homeGlobe.userData.update(t); return; }
    const m = MW.game.mode;
    if (!m) return;
    if (state.screen === 'play') {
      if (!MW.game.paused) m.update(dt, t);
      else if (m.updatePaused) m.updatePaused(dt, t);
    } else if (m.preview) m.preview(dt, t);
  }

  function setupMic(btn, input, submit) {
    btn.hidden = false;
    let rec = null;
    btn.addEventListener('click', () => {
      if (rec) { rec.stop(); return; }
      MW.audioUnlock();
      btn.classList.add('btn-primary');
      rec = MW.listen((t) => { input.value = t; }, () => {
        btn.classList.remove('btn-primary');
        rec = null;
        if (input.value.trim()) submit();
      });
      if (!rec) { btn.classList.remove('btn-primary'); MW.toast('这个浏览器用不了语音输入，可以打字哦'); }
    });
  }

  function wire() {
    const wish = $('#wishInput');
    $('#wishForm').addEventListener('submit', (e) => { e.preventDefault(); app.makeWorld(wish.value); });
    wish.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey && !e.isComposing && e.keyCode !== 229) { e.preventDefault(); app.makeWorld(wish.value); }
    });
    MW.on('wishIdea', (t) => { wish.value = t; app.makeWorld(t); });
    $('#chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const v = $('#chatInput').value;
      if (!v.trim() || state.busy || !state.spec) return;
      $('#chatInput').value = '';
      app.makeWorld(v, state.spec);
    });
    MW.on('editIdea', (t) => { if (state.spec && !state.busy) app.makeWorld(t, state.spec); });
    $('#btnEnter').addEventListener('click', app.enterWorld);
    $('#btnRegen').addEventListener('click', () => {
      if (!state.spec) return;
      app.makeWorld(state.lastWish || `我想要一个${MW.designer.modeLabel(state.spec)}，换个新样子`);
    });
    $('#btnHome').addEventListener('click', app.goHome);
    $('#brandBtn').addEventListener('click', app.goHome);
    $('#genStop').addEventListener('click', () => { if (state.ctl) state.ctl.abort(); });
    $('#vipBtn').addEventListener('click', () => {
      MW.audioUnlock();
      const wasPaused = MW.game.paused;
      if (state.screen === 'play') MW.game.paused = true;
      MW.eco.openVip(() => { if (state.screen === 'play') MW.game.paused = wasPaused; });
    });
    $('#settingsBtn').addEventListener('click', () => { MW.audioUnlock(); MW.ui.openSettings(); });
    const openBag = () => {
      if (!state.spec) return;
      const wasPaused = MW.game.paused;
      if (state.screen === 'play') MW.game.paused = true;
      MW.eco.openBag(state.spec, () => {
        if (state.screen === 'play') { MW.game.paused = wasPaused; MW.ui.renderSlots(state.spec); }
        else if (state.screen === 'design') MW.ui.renderEquip(state.spec);
      });
    };
    $('#hudBag').addEventListener('click', openBag);
    MW.on('openBag', openBag);
    $('#hudEdit').addEventListener('click', () => app.editFromPlay());
    $('#hudQuit').addEventListener('click', () => app.quitPlay());
    MW.on('openSaved', app.openSaved);
    MW.on('equip', () => {
      if (!state.spec) return;
      if (state.screen === 'design') MW.ui.renderEquip(state.spec);
      if (state.screen === 'play') {
        MW.ui.renderSlots(state.spec);
        const m = MW.game.mode;
        if (m && m.onEquip) m.onEquip();
      }
    });
    MW.on('ai', MW.ui.aiState);
    MW.on('resize', designShift);
    MW.on('settings', () => { if (state.spec && state.screen === 'design') MW.ui.renderBlueprint(state.spec, state.layout); });
    $('#sheetGrip').addEventListener('click', () => {
      $('#sheet').classList.toggle('tall');
      setTimeout(designShift, 320);
    });
    if (MW.canListen) {
      setupMic($('#micBtn'), wish, () => app.makeWorld(wish.value));
      setupMic($('#micBtn2'), $('#chatInput'), () => {
        const v = $('#chatInput').value;
        $('#chatInput').value = '';
        if (state.spec) app.makeWorld(v, state.spec);
      });
      $('#wishHint').textContent = '点 🎤 直接说话，或者打字';
    }
    window.addEventListener('pointerdown', () => MW.audioUnlock(), { passive: true });
    window.addEventListener('keydown', () => MW.audioUnlock(), { passive: true });
  }

  function boot(data) {
    MW.loadSave();
    try {
      if (!window.THREE) throw new Error('3D 引擎没有加载');
      MW.holo.init($('#stage'));
    } catch (e) {
      console.error(e);
      $('#bootErr').hidden = false;
      return;
    }
    MW.eco.refreshWallet();
    MW.ui.renderHomeChips();
    MW.ui.initTouch();
    MW.designer.initAI();
    MW.ui.aiState();
    MW.holo.onUpdate(tick);
    wire();
    if (data && data.spec && MW.modes[data.spec.mode]) restore(data);
    else app.goHome();
    MW.cloudInit().then(() => {
      MW.eco.refreshWallet();
      if (state.screen === 'home') MW.ui.renderSaved();
    });
    const hot = window.claude && window.claude.hot;
    if (hot && typeof hot.snapshot === 'function') {
      try { hot.snapshot(() => ({ spec: state.spec, chat: state.chat.slice(-12), wish: state.lastWish })); } catch (e) { /* 旧版查看器没有这个功能 */ }
    }
  }

  const hot = window.claude && window.claude.hot;
  if (hot && typeof hot.ready === 'function') hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
