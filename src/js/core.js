/* 我的世界 · core：工具函数、存档、声音、语音 */
(function () {
  'use strict';
  const MW = (window.MW = window.MW || {});

  // ---------- 小工具 ----------
  MW.$ = (s, r = document) => r.querySelector(s);
  MW.$$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  MW.clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  MW.lerp = (a, b, t) => a + (b - a) * t;
  MW.rand = (a, b) => a + Math.random() * (b - a);
  MW.randi = (a, b) => Math.floor(a + Math.random() * (b - a + 1));
  MW.pick = (arr, r = Math.random) => arr[Math.floor(r() * arr.length)];
  MW.shuffle = (arr, r = Math.random) => {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(r() * (i + 1));
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };
  MW.hash = (s) => {
    let h = 2166136261;
    s = String(s);
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  };
  // 可复现的随机数（同一个世界每次布局都一样）
  MW.rng = (seed) => {
    let a = MW.hash(seed);
    return () => {
      a = (a + 0x6d2b79f5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  MW.uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  MW.esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  MW.clone = (o) => JSON.parse(JSON.stringify(o));
  MW.sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  MW.isTouch = (window.matchMedia && matchMedia('(pointer: coarse)').matches) || 'ontouchstart' in window;
  MW.inFrame = (() => { try { return window.self !== window.top; } catch (e) { return true; } })();

  const bus = {};
  MW.on = (ev, fn) => (bus[ev] = bus[ev] || []).push(fn);
  MW.emit = (ev, ...args) => (bus[ev] || []).forEach((fn) => { try { fn(...args); } catch (e) { console.error(e); } });

  MW.toast = (msg, kind) => {
    const box = MW.$('#toasts');
    if (!box) return;
    const el = document.createElement('div');
    el.className = 'toast' + (kind ? ' toast-' + kind : '');
    el.textContent = msg;
    box.appendChild(el);
    while (box.children.length > 3) box.firstChild.remove();
    setTimeout(() => el.classList.add('out'), 2600);
    setTimeout(() => el.remove(), 3100);
  };

  // ---------- 存档：本机先存，claude.ai 里再同步到云端 ----------
  const KEY = 'mw_save_v1';
  const defaults = () => ({
    coins: 60,
    revives: 1,
    hints: 3,
    stars: 0,
    vipUntil: 0,
    equipped: {},
    progress: {},
    worlds: [],
    best: {},
    settings: { adMin: 20, adMax: 30, music: true, voice: true, fx: 'high', aiTier: 'quick' },
    updatedAt: 0,
  });
  MW.save = defaults();
  function normalize() {
    const d = defaults();
    for (const k of Object.keys(d)) if (MW.save[k] === undefined || MW.save[k] === null) MW.save[k] = d[k];
    MW.save.settings = Object.assign(d.settings, MW.save.settings || {});
    if (!Array.isArray(MW.save.worlds)) MW.save.worlds = [];
  }
  MW.loadSave = () => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) Object.assign(MW.save, JSON.parse(raw));
    } catch (e) { /* 无痕模式等情况读不到，就用默认存档 */ }
    normalize();
  };
  let cloud = null, cloudBusy = false, cloudDirty = false, cloudTimer = 0;
  MW.persist = () => {
    MW.save.updatedAt = Date.now();
    try { localStorage.setItem(KEY, JSON.stringify(MW.save)); } catch (e) { /* 存不进去也继续玩 */ }
    clearTimeout(cloudTimer);
    cloudTimer = setTimeout(cloudSave, 1500);
    MW.emit('save');
  };
  async function cloudSave() {
    if (!cloud) return;
    if (cloudBusy) { cloudDirty = true; return; }
    cloudBusy = true;
    try {
      await cloud.set(MW.clone(MW.save));
    } catch (e) {
      // 只读的观看者写不进去：以后只用本机存档
      if (e && ['invalid_argument', 'revoked', 'not_granted', 'capability_disabled', 'capability_removed', 'quota_exceeded'].includes(e.code)) cloud = null;
    }
    cloudBusy = false;
    if (cloudDirty) { cloudDirty = false; cloudSave(); }
  }
  MW.cloudInit = async () => {
    if (!window.claude || typeof window.claude.use !== 'function') return;
    try {
      const [db, user] = await Promise.all([window.claude.use('db'), window.claude.use('user')]);
      if (!db || !user) return;
      const uid = await user.id();
      if (!uid) return;
      const ref = db.doc('data/users/' + uid + '/save');
      const snap = await ref.get();
      if (snap.exists) {
        const remote = snap.data();
        if (remote && (remote.updatedAt || 0) > (MW.save.updatedAt || 0)) {
          Object.assign(MW.save, MW.clone(remote));
          normalize();
          try { localStorage.setItem(KEY, JSON.stringify(MW.save)); } catch (e) { /* ignore */ }
          MW.emit('save');
        }
      }
      cloud = ref;
    } catch (e) {
      cloud = null;
    }
  };

  // ---------- 声音：全部用 WebAudio 现场合成 ----------
  let ac = null, master, sfxBus, musicBus;
  MW.audioReady = false;
  function audio() {
    if (ac) {
      if (ac.state === 'suspended') ac.resume().catch(() => {});
      return ac;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    try { ac = new AC(); } catch (e) { return null; }
    master = ac.createGain(); master.gain.value = 0.9; master.connect(ac.destination);
    sfxBus = ac.createGain(); sfxBus.gain.value = 0.55; sfxBus.connect(master);
    musicBus = ac.createGain(); musicBus.gain.value = 0; musicBus.connect(master);
    const d = ac.createDelay(1); d.delayTime.value = 0.33;
    const fb = ac.createGain(); fb.gain.value = 0.3;
    const wet = ac.createGain(); wet.gain.value = 0.28;
    musicBus.connect(d); d.connect(fb); fb.connect(d); d.connect(wet); wet.connect(master);
    return ac;
  }
  MW.audioUnlock = () => {
    const c = audio();
    if (!c) return;
    if (!MW.audioReady) {
      MW.audioReady = true;
      if (MW.music.want) MW.music.play(MW.music.want, true);
    }
  };
  function tone(f, dur, type, vol, when, bus, slide) {
    const c = audio();
    if (!c || !MW.audioReady) return;
    const t = Math.max(c.currentTime, when || 0);
    const o = c.createOscillator(), g = c.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(slide, t + dur);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol || 0.2, t + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus || sfxBus);
    o.start(t); o.stop(t + dur + 0.05);
  }
  let noiseBuf = null;
  function noise(dur, vol, when, freq, bus) {
    const c = audio();
    if (!c || !MW.audioReady) return;
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, Math.floor(c.sampleRate * 0.5), c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const t = Math.max(c.currentTime, when || 0);
    const s = c.createBufferSource(); s.buffer = noiseBuf;
    const f = c.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = freq || 1000; f.Q.value = 0.8;
    const g = c.createGain();
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus || sfxBus);
    s.start(t); s.stop(t + dur + 0.02);
  }
  const now = () => (ac ? ac.currentTime : 0);
  const SFX = {
    click: () => tone(880, 0.05, 'square', 0.05),
    swing: () => noise(0.12, 0.2, 0, 2600),
    hit: () => { noise(0.1, 0.25, 0, 900); tone(170, 0.14, 'triangle', 0.28, 0, null, 60); },
    hurt: () => { tone(260, 0.2, 'sawtooth', 0.14, 0, null, 120); noise(0.15, 0.15, 0, 600); },
    coin: () => { const t = now(); tone(988, 0.08, 'square', 0.08, t); tone(1319, 0.16, 'square', 0.08, t + 0.07); },
    chime: () => { const t = now(); tone(1047, 0.25, 'sine', 0.14, t); tone(1568, 0.35, 'sine', 0.1, t + 0.08); },
    right: () => { const t = now(); tone(660, 0.08, 'triangle', 0.18, t); tone(990, 0.14, 'triangle', 0.18, t + 0.06); },
    wrong: () => { const t = now(); tone(330, 0.18, 'sawtooth', 0.13, t, null, 160); tone(220, 0.26, 'sawtooth', 0.13, t + 0.15, null, 110); },
    win: () => { const t = now(); [523, 659, 784, 1047, 1319].forEach((f, i) => tone(f, 0.3, 'triangle', 0.2, t + i * 0.1)); },
    die: () => { tone(440, 0.6, 'sawtooth', 0.16, 0, null, 70); noise(0.4, 0.2, now() + 0.05, 500); },
    revive: () => { const t = now(); [392, 523, 659, 784, 1047].forEach((f, i) => tone(f, 0.2, 'sine', 0.18, t + i * 0.06)); },
    jump: () => tone(300, 0.15, 'sine', 0.14, 0, null, 700),
    bounce: () => tone(220, 0.3, 'sine', 0.2, 0, null, 900),
    zap: () => tone(1500, 0.1, 'square', 0.05, 0, null, 300),
    heart: () => { const t = now(); tone(784, 0.14, 'sine', 0.18, t); tone(1175, 0.22, 'sine', 0.16, t + 0.1); },
    build: () => { tone(160, 1.2, 'sine', 0.12, 0, null, 900); noise(1.0, 0.04, 0, 3000); },
    spawn: () => tone(500, 0.3, 'triangle', 0.1, 0, null, 120),
    eat: () => tone(520 + Math.random() * 260, 0.06, 'square', 0.05),
    open: () => { const t = now(); tone(392, 0.1, 'triangle', 0.16, t); tone(784, 0.2, 'triangle', 0.16, t + 0.08); tone(1175, 0.3, 'sine', 0.12, t + 0.16); },
    pop: () => tone(620, 0.08, 'sine', 0.16, 0, null, 1200),
    note: (f) => tone(f, 0.5, 'sine', 0.12),
  };
  MW.sfx = (name, arg) => { try { if (SFX[name]) SFX[name](arg); } catch (e) { /* 声音出错不影响游戏 */ } };

  // 每个世界一首会自己变化的背景音乐
  const SONGS = {
    home: { bpm: 84, root: 220, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: 'sine', fast: false, bass: 'triangle', lead: 0.06, bell: true },
    gentle: { bpm: 66, root: 174.6, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]], arp: 'sine', fast: false, bass: 'sine', lead: 0.06, bell: true },
    math: { bpm: 100, root: 261.6, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]], arp: 'triangle', fast: false, bass: 'triangle', lead: 0.05, hats: true },
    combat: { bpm: 128, root: 110, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: 'sawtooth', fast: true, bass: 'square', lead: 0.03, hats: true, kick: true },
    snake: { bpm: 140, root: 164.8, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]], arp: 'square', fast: true, bass: 'square', lead: 0.028, hats: true },
  };
  let song = null, songName = '', step = 0, nextT = 0, timer = null;
  const semi = (root, s) => root * Math.pow(2, s / 12);
  function schedule() {
    if (!ac || !song) return;
    const s16 = 60 / song.bpm / 4;
    while (nextT < ac.currentTime + 0.15) {
      const bar = Math.floor(step / 16) % song.chords.length;
      const pos = step % 16;
      const ch = song.chords[bar];
      if (pos % 8 === 0) tone(semi(song.root / 2, ch[0]), s16 * 7, song.bass, 0.14, nextT, musicBus);
      const every = song.fast ? 1 : 2;
      if (pos % every === 0) {
        const notes = [ch[0], ch[1], ch[2], ch[0] + 12, ch[2], ch[1]];
        const n = notes[(pos / every + bar) % notes.length];
        tone(semi(song.root, n + 12), s16 * every * 1.6, song.arp, song.lead, nextT, musicBus);
      }
      if (song.bell && pos === 0 && Math.random() < 0.7) tone(semi(song.root, ch[2] + 24), 1.4, 'sine', 0.045, nextT + s16 * 2, musicBus);
      if (song.hats && pos % 4 === 2) noise(0.04, 0.045, nextT, 7000, musicBus);
      if (song.kick && pos % 4 === 0) tone(120, 0.18, 'sine', 0.26, nextT, musicBus, 45);
      nextT += s16;
      step++;
    }
  }
  MW.music = {
    want: '',
    play(name, force) {
      this.want = name;
      if (!MW.save.settings.music || !MW.audioReady) return;
      const c = audio();
      if (!c) return;
      if (songName === name && song && !force) return;
      song = SONGS[name] || null;
      songName = name;
      step = 0;
      nextT = c.currentTime + 0.12;
      musicBus.gain.cancelScheduledValues(c.currentTime);
      musicBus.gain.setTargetAtTime(0.5, c.currentTime, 0.4);
      if (!timer) timer = setInterval(schedule, 40);
    },
    stop() {
      song = null; songName = '';
      if (timer) { clearInterval(timer); timer = null; }
      if (ac && musicBus) musicBus.gain.setTargetAtTime(0, ac.currentTime, 0.2);
    },
    duck(on) {
      if (ac && musicBus && song) musicBus.gain.setTargetAtTime(on ? 0.1 : 0.5, ac.currentTime, 0.25);
    },
  };

  // ---------- 语音：进入世界时播报欢迎词 ----------
  MW.say = (text) => {
    if (!MW.save.settings.voice || !text) return;
    try {
      const sy = window.speechSynthesis;
      if (!sy) return;
      sy.cancel();
      const u = new SpeechSynthesisUtterance(String(text).slice(0, 120));
      u.lang = 'zh-CN';
      u.rate = 1.05;
      u.pitch = 1.2;
      const vs = sy.getVoices();
      const v = vs.find((x) => /zh[-_]CN/i.test(x.lang)) || vs.find((x) => /^zh/i.test(x.lang));
      if (v) u.voice = v;
      sy.speak(u);
    } catch (e) { /* 没有语音也没关系 */ }
  };
  // 语音输入只在直接打开网页时可用（嵌在 claude.ai 里时浏览器不给麦克风）
  MW.canListen = !MW.inFrame && !!(window.SpeechRecognition || window.webkitSpeechRecognition);
  MW.listen = (onText, onEnd) => {
    const R = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!R) { onEnd && onEnd(); return null; }
    const r = new R();
    r.lang = 'zh-CN';
    r.interimResults = true;
    r.onresult = (e) => {
      let t = '';
      for (const res of e.results) t += res[0].transcript;
      onText(t);
    };
    r.onend = () => onEnd && onEnd();
    r.onerror = () => onEnd && onEnd();
    try { r.start(); } catch (e) { onEnd && onEnd(); return null; }
    return r;
  };
})();
