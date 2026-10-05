/* 我的世界 · 高空数学闯关：一座座浮空岛，每座一道数独或口算；答错看广告（会员跳过） */
(function () {
  'use strict';
  const MW = window.MW;
  const H = MW.holo, M = MW.models, K = MW.models.kit;
  const $ = MW.$, $$ = MW.$$;
  let S = null;
  let installed = false;

  const islandPos = (i) => {
    const a = i * 1.2 + 0.5, r = 7.4 + (i % 2) * 1.8;
    return { x: Math.cos(a) * r, y: 1.8 + i * 1.65, z: Math.sin(a) * r };
  };

  // ---------- 数独：随机生成，并保证只有一个答案 ----------
  const boxDims = (n) => (n === 4 ? [2, 2] : n === 6 ? [2, 3] : [3, 3]);
  function canPlace(g, n, br, bc, idx, v) {
    const r = (idx / n) | 0, c = idx % n;
    for (let i = 0; i < n; i++) if (g[r * n + i] === v || g[i * n + c] === v) return false;
    const r0 = r - (r % br), c0 = c - (c % bc);
    for (let i = 0; i < br; i++) for (let j = 0; j < bc; j++) if (g[(r0 + i) * n + c0 + j] === v) return false;
    return true;
  }
  function fillGrid(n, br, bc) {
    const g = new Array(n * n).fill(0);
    const nums = Array.from({ length: n }, (_, i) => i + 1);
    const rec = (idx) => {
      if (idx === n * n) return true;
      for (const v of MW.shuffle(nums.slice())) {
        if (canPlace(g, n, br, bc, idx, v)) {
          g[idx] = v;
          if (rec(idx + 1)) return true;
          g[idx] = 0;
        }
      }
      return false;
    };
    rec(0);
    return g;
  }
  function countSolutions(p, n, br, bc, limit) {
    const g = p.slice();
    let count = 0;
    const solve = () => {
      let best = -1, bestC = null;
      for (let i = 0; i < g.length; i++) {
        if (g[i]) continue;
        const c = [];
        for (let v = 1; v <= n; v++) if (canPlace(g, n, br, bc, i, v)) c.push(v);
        if (!c.length) return;
        if (!bestC || c.length < bestC.length) { best = i; bestC = c; if (c.length === 1) break; }
      }
      if (best < 0) { count++; return; }
      for (const v of bestC) {
        g[best] = v;
        solve();
        if (count >= limit) break;
      }
      g[best] = 0;
    };
    solve();
    return count;
  }
  function makeSudoku(n, givens) {
    const [br, bc] = boxDims(n);
    const solution = fillGrid(n, br, bc);
    const puzzle = solution.slice();
    let left = n * n;
    for (const idx of MW.shuffle(Array.from({ length: n * n }, (_, i) => i))) {
      if (left <= givens) break;
      const keep = puzzle[idx];
      puzzle[idx] = 0;
      if (countSolutions(puzzle, n, br, bc, 2) !== 1) puzzle[idx] = keep;
      else left--;
    }
    return { n, br, bc, puzzle, solution };
  }
  function sizeFor(idx) {
    const st = S.spec.settings;
    if (st.sudokuSize) return st.sudokuSize;
    const seq = [4, 4, 6, 6, 6, 9, 9, 9, 9, 9, 9, 9];
    const shift = st.difficulty <= 1 ? -2 : st.difficulty === 2 ? 0 : st.difficulty === 3 ? 1 : 3;
    return seq[MW.clamp(idx + shift, 0, seq.length - 1)];
  }
  function givensFor(n, idx) {
    const d = S.spec.settings.difficulty;
    if (n === 4) return MW.clamp(9 - d - (idx % 2), 5, 10);
    if (n === 6) return MW.clamp(22 - d * 2 - (idx % 3), 13, 24);
    return MW.clamp(42 - d * 3 - Math.min(idx, 6), 26, 44);
  }

  // ---------- 口算题 ----------
  function makeQuestion(d, idx) {
    const lv = MW.clamp(d + Math.floor(idx / 3), 1, 5);
    const R = MW.randi;
    let left, op, right, ans;
    const r = Math.random();
    if (lv === 1) {
      if (r < 0.6) { left = R(1, 9); right = R(1, 10 - left); op = '+'; ans = left + right; }
      else { left = R(2, 10); right = R(1, left); op = '−'; ans = left - right; }
    } else if (lv === 2) {
      if (r < 0.5) { left = R(3, 15); right = R(2, 20 - left); op = '+'; ans = left + right; }
      else { left = R(5, 20); right = R(1, left); op = '−'; ans = left - right; }
    } else if (lv === 3) {
      if (r < 0.35) { left = R(10, 60); right = R(5, 99 - left); op = '+'; ans = left + right; }
      else if (r < 0.7) { left = R(20, 99); right = R(5, left); op = '−'; ans = left - right; }
      else { left = R(2, 5); right = R(2, 9); op = '×'; ans = left * right; }
    } else if (lv === 4) {
      if (r < 0.55) { left = R(2, 9); right = R(2, 9); op = '×'; ans = left * right; }
      else { right = R(2, 9); ans = R(2, 9); left = right * ans; op = '÷'; }
    } else {
      const x = R(2, 9), y = R(2, 9);
      if (r < 0.5) { left = `${x} × ${y}`; right = R(1, 20); op = '+'; ans = x * y + right; }
      else { right = R(2, 9); ans = R(2, 12); left = right * ans; op = '÷'; }
    }
    const opts = new Set([ans]);
    while (opts.size < 4) {
      const delta = R(1, Math.max(3, Math.round(ans * 0.2))) * (Math.random() < 0.5 ? -1 : 1);
      if (ans + delta >= 0) opts.add(ans + delta);
    }
    return { text: `${left} ${op} ${right} = ?`, ans, opts: MW.shuffle([...opts]) };
  }

  function resolveEquip(list) {
    const eq = { hint: 0, shield: 0, auto: 0 };
    for (const it of list) {
      if (it.effect === 'hint') eq.hint += Math.round(it.power);
      else if (it.effect === 'shield') eq.shield += Math.round(it.power);
      else if (it.effect === 'auto') eq.auto = Math.max(eq.auto, Math.round(it.power));
    }
    return eq;
  }
  function loadProg() {
    const pr = MW.save.progress[S.spec.id];
    return pr && Array.isArray(pr.done) ? pr : { done: [] };
  }
  function curLevel() {
    for (let i = 0; i < S.L; i++) if (!S.prog.done[i]) return i;
    return S.L;
  }
  function heroSpot(idx) {
    if (idx < 0) return { x: 0, y: 0, z: 0 };
    const p = islandPos(idx);
    return { x: p.x - 0.6, y: p.y + 0.06, z: p.z + 0.25 };
  }

  const mode = (MW.modes = MW.modes || {}).math = {
    islandPos,
    build(ctx) {
      install();
      const { spec, colors, group, layout } = ctx;
      const L = spec.settings.levels;
      S = { ctx, spec, colors, group, L, islands: [], npcs: [], clouds: [], parts: [], running: false, hop: null, t: 0, cur: 0, heroIdx: -1, hudKey: '', pz: null, pzLock: false };
      S.prog = loadProg();
      const decos = spec.parts.map((p) => p.type).filter((t) => !['rock', 'cloud', 'star', 'coin', 'heart', 'jumppad', 'portal', 'rainbow', 'chest'].includes(t));
      const pool = decos.length ? decos : ['tree', 'crystal', 'flower', 'mushroom', 'house', 'castle'];
      for (let i = 0; i < L; i++) {
        const p = islandPos(i);
        const isl = M.island(colors.main, colors.accent, pool[i % pool.length]);
        isl.position.set(p.x, p.y, p.z);
        isl.rotation.y = -i * 1.2;
        group.add(isl);
        S.islands.push({ obj: isl, idx: i, p, label: null, labelText: '', star: null, ph: Math.random() * 6 });
      }
      const pts = [new THREE.Vector3(0, 0.1, 0)].concat(S.islands.map((s) => new THREE.Vector3(s.p.x, s.p.y + 0.1, s.p.z)));
      const curve = new THREE.CatmullRomCurve3(pts);
      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(curve.getPoints(L * 14)), H.lineMat(colors.accent, 0.45));
      line.userData.dispose = () => line.geometry.dispose();
      group.add(line);
      S.ring = new THREE.Mesh(H.geo('torus', 2.2, 0.06, 6, 48), H.mat(colors.accent));
      S.ring.rotation.x = Math.PI / 2;
      group.add(S.ring);
      spec.characters.forEach((c, j) => {
        for (let k = 0; k < Math.min(c.count, 2); k++) {
          const ii = Math.min(L - 1, (j * 2 + k * 3) % L);
          const a = K.actor(c, colors.second, colors.accent, 0.75);
          a.obj.position.set(0.75, 0.06, 0.65);
          a.obj.rotation.y = 0.7;
          S.islands[ii].obj.add(a.obj);
          S.npcs.push(a);
        }
      });
      const cloudN = Math.min(12, (spec.parts.find((p) => p.type === 'cloud') || { count: 6 }).count);
      for (let i = 0; i < cloudN; i++) {
        const g = M.part('cloud');
        const k = 0.6 + ctx.rng() * 0.7;
        const a = ctx.rng() * Math.PI * 2, r = 4 + ctx.rng() * 8;
        g.scale.setScalar(k);
        g.position.set(Math.cos(a) * r, -1.5 + ctx.rng() * (L * 1.65) - 3.4 * k, Math.sin(a) * r);
        g.userData.floatY = 0;
        g.userData.a = a; g.userData.r = r;
        group.add(g);
        S.clouds.push(g);
      }
      for (const p of layout.parts) {
        const g = M.part(p.type, colors.main, colors.accent);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = ctx.rng() * 6.28;
        group.add(g);
        S.parts.push(g);
      }
      S.hero = K.actor(spec.hero, colors.accent, colors.main, 1);
      S.hero.obj.add(K.heroRing(colors.accent));
      const tag = H.label(spec.hero.name || '你', colors.accent, { px: 34, size: 0.72, bg: true });
      tag.position.y = 2.6;
      S.hero.obj.add(tag);
      group.add(S.hero.obj);
      refreshIslands();
      placeHero();
    },
    preview(dt, t) { if (S) animateWorld(dt, t); },
    updatePaused(dt, t) { if (S) animateWorld(dt, t); },
    start() {
      S.running = true;
      S.prog = loadProg();
      refreshIslands();
      placeHero();
      const c = H.cam;
      c.mode = 'orbit'; c.auto = true; c.dist = 26; c.height = 7; c.lerp = 2.5;
      c.target.set(0, S.hero.obj.position.y + 1.5, 0);
      $('#hudCenter').onclick = (e) => {
        const b = e.target.closest('button[data-lv]');
        if (b && S && S.running) tryOpen(+b.dataset.lv);
      };
      hud(true);
      setTimeout(() => { if (S && S.running && S.cur < S.L) MW.toast(`点发光的「第 ${S.cur + 1} 关」浮空岛开始答题`); }, 1200);
    },
    update(dt, t) {
      if (!S || !S.running) return;
      S.t += dt;
      animateWorld(dt, t);
      H.cam.target.y += (S.hero.obj.position.y + 1.5 - H.cam.target.y) * Math.min(1, dt * 2);
      hud(false);
    },
    stop() {
      if (!S) return;
      closePuzzle();
      S.running = false;
      S.hop = null;
      $('#hudCenter').onclick = null;
      placeHero();
      const done = S.prog.done.filter(Boolean).length;
      return done ? `已经点亮了 ${done} / ${S.L} 座浮空岛 ⭐ 想改关卡、难度就告诉我` : null;
    },
    dispose() { S = null; },
    _debug: () => S,
  };

  function animateWorld(dt, t) {
    for (const isl of S.islands) isl.obj.position.y = isl.p.y + Math.sin(t * 0.8 + isl.ph) * 0.15;
    for (const g of S.clouds) {
      g.userData.a += dt * 0.03;
      g.position.x = Math.cos(g.userData.a) * g.userData.r;
      g.position.z = Math.sin(g.userData.a) * g.userData.r;
    }
    for (const a of S.npcs) M.animate(a.model, t + a.phase, 0);
    for (const g of S.parts) M.animatePart(g, t, dt);
    for (const isl of S.islands) if (isl.star) isl.star.rotation.y += dt * 1.5;
    S.ring.scale.setScalar(1 + Math.sin(t * 3) * 0.06);
    if (S.ring.visible) {
      const target = S.islands[Math.min(S.cur, S.L - 1)];
      S.ring.position.y = target.obj.position.y + 0.1;
    }
    const hero = S.hero;
    if (S.hop) {
      const h = S.hop;
      h.t += dt;
      const k = Math.min(1, h.t / h.dur);
      const to = heroSpot(S.heroIdx);
      if (S.heroIdx >= 0) to.y += S.islands[S.heroIdx].obj.position.y - S.islands[S.heroIdx].p.y;
      hero.obj.position.set(MW.lerp(h.from.x, to.x, k), MW.lerp(h.from.y, to.y, k) + Math.sin(k * Math.PI) * 3, MW.lerp(h.from.z, to.z, k));
      hero.obj.rotation.y = Math.atan2(to.x - h.from.x, to.z - h.from.z);
      M.animate(hero.model, t, 1);
      if (k >= 1) { S.hop = null; MW.sfx('pop'); }
    } else {
      const sp = heroSpot(S.heroIdx);
      if (S.heroIdx >= 0) sp.y += S.islands[S.heroIdx].obj.position.y - S.islands[S.heroIdx].p.y;
      hero.obj.position.set(sp.x, sp.y, sp.z);
      M.animate(hero.model, t, 0);
    }
  }
  function placeHero() {
    S.cur = curLevel();
    S.heroIdx = Math.min(S.cur, S.L) - 1;
    S.hop = null;
    const sp = heroSpot(S.heroIdx);
    S.hero.obj.position.set(sp.x, sp.y, sp.z);
    S.hero.obj.rotation.y = S.heroIdx >= 0 ? -S.heroIdx * 1.2 : 0;
  }
  function hopTo(idx) {
    if (idx === S.heroIdx && !S.hop) return;
    const p = S.hero.obj.position;
    S.hop = { from: { x: p.x, y: p.y, z: p.z }, t: 0, dur: 0.9 };
    S.heroIdx = idx;
    MW.sfx('jump');
  }
  function refreshIslands() {
    S.cur = curLevel();
    for (const isl of S.islands) {
      const done = !!S.prog.done[isl.idx];
      const locked = isl.idx > S.cur;
      const text = done ? `⭐ 第${isl.idx + 1}关` : locked ? `🔒 第${isl.idx + 1}关` : `▶ 第${isl.idx + 1}关`;
      if (isl.labelText !== text) {
        if (isl.label) { isl.obj.remove(isl.label); isl.label.userData.dispose(); }
        isl.label = H.label(text, done ? '#ffe45c' : locked ? '#7f9fb0' : S.colors.accent, { px: 36, size: 1.15, bg: true });
        isl.label.position.set(0, 2.6, 0);
        isl.obj.add(isl.label);
        isl.labelText = text;
      }
      if (done && !isl.star) {
        isl.star = M.part('star');
        isl.star.userData.floatY = 0;
        isl.star.position.set(0.7, 0.1, -0.5);
        isl.star.scale.setScalar(0.7);
        isl.obj.add(isl.star);
      }
    }
    S.ring.visible = S.cur < S.L;
    const target = S.islands[Math.min(S.cur, S.L - 1)];
    if (target) S.ring.position.set(target.p.x, target.p.y + 0.1, target.p.z);
    S.hudKey = '';
  }

  // ---------- 点岛、开题 ----------
  function install() {
    if (installed) return;
    installed = true;
    MW.on('stageClick', (e) => {
      if (!S || !S.running || !$('#puzzle').hidden || MW.ui.dialogOpen()) return;
      const hit = H.pick(e.clientX, e.clientY, S.islands.map((i) => i.obj));
      if (!hit) return;
      let o = hit.object;
      while (o && !S.islands.some((i) => i.obj === o)) o = o.parent;
      const isl = S.islands.find((i) => i.obj === o);
      if (isl) tryOpen(isl.idx);
    });
    $('#puzzleCard').addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !S || !S.pz) return;
      if (b.dataset.i !== undefined) selectCell(+b.dataset.i);
      else if (b.dataset.num !== undefined) place(+b.dataset.num);
      else if (b.dataset.ans !== undefined) answer(+b.dataset.ans, b);
      else if (b.dataset.pz === 'close') closePuzzle();
      else if (b.dataset.pz === 'hint') useHint();
      else if (b.dataset.pz === 'auto') useAuto();
    });
    window.addEventListener('keydown', (e) => {
      if (!S || !S.pz || $('#puzzle').hidden || MW.ui.dialogOpen() || !$('#ad').hidden) return;
      const p = S.pz;
      if (e.key === 'Escape') { closePuzzle(); return; }
      if (p.type === 'sudoku') {
        if (/^[1-9]$/.test(e.key) && +e.key <= p.n) { place(+e.key); e.preventDefault(); }
        else if (e.key === 'Backspace' || e.key === 'Delete' || e.key === '0') { place(0); e.preventDefault(); }
        else if (e.key.startsWith('Arrow')) {
          const d = { ArrowUp: -p.n, ArrowDown: p.n, ArrowLeft: -1, ArrowRight: 1 }[e.key];
          const N = p.n * p.n;
          selectCell(((p.sel < 0 ? 0 : p.sel + d) + N) % N);
          e.preventDefault();
        }
      } else if (/^[1-4]$/.test(e.key)) {
        const b = $$('#puzzleCard .quiz-opts button')[+e.key - 1];
        if (b && !b.disabled) b.click();
      }
    });
  }
  function tryOpen(idx) {
    if (idx > S.cur) { MW.toast('先完成前面的关卡，才能去这座岛哦'); MW.sfx('wrong'); return; }
    openLevel(idx);
  }
  function openLevel(idx) {
    if (!S || idx >= S.L) return;
    S.eq = resolveEquip(MW.eco.activeEquip(S.spec));
    S.shieldLeft = S.eq.shield;
    S.hintsLeft = S.eq.hint;
    S.autoLeft = S.eq.auto;
    S.pzLock = false;
    hopTo(idx);
    MW.sfx('pop');
    if (S.spec.settings.mathType === 'arith') openQuiz(idx);
    else openSudoku(idx);
    $('#puzzle').hidden = false;
  }
  function closePuzzle() {
    $('#puzzle').hidden = true;
    if (S) { S.pz = null; S.pzLock = false; S.hudKey = ''; }
  }
  function toolsHtml() {
    const hints = MW.save.hints + (S.hintsLeft || 0);
    return `<button class="btn" type="button" data-pz="hint">💡 提示（${hints}）</button>` +
      (S.autoLeft && S.pz && S.pz.type === 'sudoku' ? `<button class="btn btn-vip" type="button" data-pz="auto">🔍 自动填 ${S.autoLeft} 格</button>` : '') +
      (S.shieldLeft ? `<span class="tag">🛡️ 还能错 ${S.shieldLeft} 次不看广告</span>` : '');
  }
  function refreshTools() { const el = $('#puzzleCard .pz-tools'); if (el) el.innerHTML = toolsHtml(); }

  // 数独
  function openSudoku(idx) {
    const n = sizeFor(idx);
    const pz = makeSudoku(n, givensFor(n, idx));
    S.pz = Object.assign(pz, { type: 'sudoku', grid: pz.puzzle.slice(), sel: -1, idx });
    const cells = [];
    for (let i = 0; i < n * n; i++) {
      const r = (i / n) | 0, c = i % n;
      const cls = ['cell'];
      if (pz.puzzle[i]) cls.push('given');
      if ((c + 1) % pz.bc === 0 && c < n - 1) cls.push('bR');
      if ((r + 1) % pz.br === 0 && r < n - 1) cls.push('bB');
      cells.push(`<button type="button" class="${cls.join(' ')}" data-i="${i}" aria-label="第${r + 1}行第${c + 1}列">${pz.puzzle[i] || ''}</button>`);
    }
    const nums = Array.from({ length: n }, (_, i) => `<button type="button" data-num="${i + 1}">${i + 1}</button>`).join('');
    $('#puzzleCard').innerHTML = `
      <div class="pz-head"><div><h2>第 ${idx + 1} 关 · ${n}×${n} 数独</h2><p>每一行、每一列、每个粗线框里，1~${n} 都只能出现一次</p></div><button class="btn btn-sm btn-quiet" type="button" data-pz="close">先不做</button></div>
      <div class="sgrid n${n}" style="--n:${n}">${cells.join('')}</div>
      <div class="numpad">${nums}<button type="button" class="erase" data-num="0">擦掉</button></div>
      <div class="pz-tools">${toolsHtml()}</div>`;
    selectCell(S.pz.grid.findIndex((v) => !v));
  }
  function selectCell(i) {
    const p = S.pz;
    if (!p || p.type !== 'sudoku' || i < 0) return;
    p.sel = i;
    const n = p.n, r = (i / n) | 0, c = i % n, r0 = r - (r % p.br), c0 = c - (c % p.bc);
    $$('#puzzleCard .cell').forEach((el, k) => {
      const rr = (k / n) | 0, cc = k % n;
      const same = rr === r || cc === c || (rr >= r0 && rr < r0 + p.br && cc >= c0 && cc < c0 + p.bc);
      el.classList.toggle('same', same && k !== i);
      el.classList.toggle('sel', k === i);
    });
  }
  const solved = (p) => p.grid.every((x, k) => x === p.solution[k]);
  function nextEmpty(from) {
    const p = S.pz, N = p.n * p.n;
    for (let k = 1; k <= N; k++) { const j = (from + k) % N; if (p.grid[j] !== p.solution[j]) return j; }
    return -1;
  }
  function place(v) {
    const p = S.pz;
    if (!p || p.type !== 'sudoku' || S.pzLock) return;
    const i = p.sel;
    if (i < 0 || p.puzzle[i]) return;
    const el = $$('#puzzleCard .cell')[i];
    if (v === 0) {
      if (p.grid[i] !== p.solution[i]) { p.grid[i] = 0; el.textContent = ''; el.classList.remove('wrong'); }
      return;
    }
    if (p.grid[i] === p.solution[i]) return;
    if (v === p.solution[i]) {
      p.grid[i] = v;
      el.textContent = v;
      el.classList.remove('wrong');
      el.classList.add('ok');
      MW.sfx('right');
      if (solved(p)) { S.pzLock = true; setTimeout(() => levelDone(p.idx), 450); return; }
      const nx = nextEmpty(i);
      if (nx >= 0) selectCell(nx);
    } else {
      el.textContent = v;
      el.classList.remove('ok', 'wrong');
      void el.offsetWidth;
      el.classList.add('wrong');
      wrongAnswer(() => { if (S && S.pz === p && p.grid[i] !== p.solution[i]) { el.textContent = ''; el.classList.remove('wrong'); } }, `这个格子不是 ${v} 哦，再想想～`);
    }
  }
  function useAuto() {
    const p = S.pz;
    if (!S.autoLeft || !p || p.type !== 'sudoku') return;
    const empties = MW.shuffle(Array.from({ length: p.n * p.n }, (_, i) => i).filter((i) => p.grid[i] !== p.solution[i])).slice(0, S.autoLeft);
    S.autoLeft = 0;
    refreshTools();
    empties.forEach((i, k) => setTimeout(() => {
      if (!S || S.pz !== p) return;
      p.grid[i] = p.solution[i];
      const el = $$('#puzzleCard .cell')[i];
      el.textContent = p.solution[i];
      el.classList.remove('wrong');
      el.classList.add('ok');
      MW.sfx('right');
      if (solved(p) && !S.pzLock) { S.pzLock = true; setTimeout(() => levelDone(p.idx), 450); }
    }, k * 220));
  }
  function useHint() {
    const p = S.pz;
    if (!p || S.pzLock) return;
    if ((S.hintsLeft || 0) <= 0 && MW.save.hints <= 0) { MW.toast('灯泡用完啦，可以在「装备」里用金币买', 'bad'); MW.sfx('wrong'); return; }
    if (S.hintsLeft > 0) S.hintsLeft--;
    else { MW.save.hints--; MW.persist(); }
    MW.sfx('chime');
    if (p.type === 'sudoku') {
      const i = p.sel >= 0 && p.grid[p.sel] !== p.solution[p.sel] ? p.sel : nextEmpty(p.sel >= 0 ? p.sel : 0);
      if (i < 0) return;
      p.grid[i] = p.solution[i];
      const el = $$('#puzzleCard .cell')[i];
      el.textContent = p.solution[i];
      el.classList.remove('wrong');
      el.classList.add('ok');
      refreshTools();
      if (solved(p)) { S.pzLock = true; setTimeout(() => levelDone(p.idx), 450); }
      else { const nx = nextEmpty(i); if (nx >= 0) selectCell(nx); }
    } else {
      const wrong = $$('#puzzleCard .quiz-opts button').filter((b) => !b.disabled && +b.dataset.ans !== p.q.ans);
      MW.shuffle(wrong).slice(0, 2).forEach((b) => { b.disabled = true; });
      refreshTools();
    }
  }

  // 口算
  function openQuiz(idx) {
    S.pz = { type: 'quiz', idx, n: 8, k: 0, q: makeQuestion(S.spec.settings.difficulty, idx) };
    renderQuiz();
  }
  function renderQuiz() {
    const p = S.pz;
    const dots = Array.from({ length: p.n }, (_, i) => `<i class="${i < p.k ? 'done' : i === p.k ? 'cur' : ''}"></i>`).join('');
    $('#puzzleCard').innerHTML = `
      <div class="pz-head"><div><h2>第 ${p.idx + 1} 关 · 口算</h2><p>一共 ${p.n} 题，全部答对就过关（第 ${p.k + 1} 题）</p></div><button class="btn btn-sm btn-quiet" type="button" data-pz="close">先不做</button></div>
      <div class="quiz-dots">${dots}</div>
      <div class="quiz-q">${p.q.text}</div>
      <div class="quiz-opts">${p.q.opts.map((v) => `<button type="button" data-ans="${v}">${v}</button>`).join('')}</div>
      <div class="pz-tools">${toolsHtml()}</div>`;
  }
  function answer(v, btn) {
    const p = S.pz;
    if (!p || p.type !== 'quiz' || S.pzLock) return;
    if (v === p.q.ans) {
      MW.sfx('right');
      btn.classList.add('ok');
      p.k++;
      S.pzLock = true;
      if (p.k >= p.n) { setTimeout(() => levelDone(p.idx), 380); return; }
      setTimeout(() => {
        if (!S || S.pz !== p) return;
        S.pzLock = false;
        p.q = makeQuestion(S.spec.settings.difficulty, p.idx);
        renderQuiz();
      }, 380);
    } else {
      btn.disabled = true;
      wrongAnswer(() => {}, `${p.q.text.replace(' = ?', '')} 不等于 ${v} 哦，再算算～`);
    }
  }

  // 答错：护盾 → 复活石 → 广告（会员跳过）
  function wrongAnswer(clear, msg) {
    MW.sfx('wrong');
    if (S.shieldLeft > 0) {
      S.shieldLeft--;
      MW.toast(`🛡️ 错题护盾挡住了这一次，还能挡 ${S.shieldLeft} 次`);
      setTimeout(() => { clear(); refreshTools(); }, 650);
      return;
    }
    S.pzLock = true;
    setTimeout(() => {
      if (!S || !S.pz) return;
      MW.eco.fail({
        title: '❌ 答错啦！',
        msg,
        verb: '继续答题',
        quitLabel: '🏝️ 先不做这一关',
        onContinue: () => { if (!S) return; S.pzLock = false; clear(); refreshTools(); },
        onQuit: () => closePuzzle(),
      });
    }, 450);
  }

  function levelDone(idx) {
    if (!S) return;
    const p = S.pz;
    const first = !S.prog.done[idx];
    S.prog.done[idx] = true;
    MW.save.progress[S.spec.id] = S.prog;
    let coins = 5, gotRevive = false;
    if (first) {
      coins = 20 + (p && p.type === 'sudoku' ? (p.n === 9 ? 20 : p.n === 6 ? 10 : 0) : 5);
      MW.save.stars = (MW.save.stars || 0) + 1;
      if ((idx + 1) % 3 === 0) { gotRevive = true; MW.save.revives++; }
    }
    const all = S.prog.done.filter(Boolean).length >= S.L;
    const bonus = all && first ? 100 : 0;
    MW.save.coins += coins + bonus;
    MW.persist();
    MW.eco.refreshWallet();
    closePuzzle();
    MW.sfx('win');
    const isl = S.islands[idx];
    for (let k = 0; k < 4; k++) setTimeout(() => { if (S) H.burst({ x: isl.p.x + MW.rand(-1, 1), y: isl.p.y + 0.5, z: isl.p.z + MW.rand(-1, 1) }, MW.pick([S.colors.main, S.colors.accent, '#ffe45c']), 16, 5); }, k * 150);
    refreshIslands();
    hopTo(idx);
    MW.say(all ? '恭喜你，全部通关！' : '答对啦，真棒！');
    const rewards = [first ? '⭐ 金星 +1' : '', `🪙 +${coins}`, gotRevive ? '💎 复活石 +1' : '', bonus ? `🏆 通关大奖 🪙 +${bonus}` : ''].filter(Boolean);
    MW.ui.dialog({
      title: all ? '🏆 全部通关！' : `🎉 第 ${idx + 1} 关完成！`,
      cls: 'gold',
      html: `<p>${all ? '所有浮空岛都被你点亮了！可以让设计师再加几关，或者换个更难的。' : '下一座浮空岛已经亮起来了。'}</p><div class="rewards">${rewards.map((r) => `<span>${r}</span>`).join('')}</div>`,
      buttons: all
        ? [{ label: '回到浮空岛', kind: 'primary' }, { label: '让设计师再加几关', onClick: () => MW.app.editFromPlay('再加 3 关') }]
        : [{ label: `去第 ${idx + 2} 关 ▶`, kind: 'primary', onClick: () => openLevel(idx + 1) }, { label: '先看看风景' }],
    });
  }

  function hud(force) {
    const done = S.prog.done.filter(Boolean).length;
    const key = `${S.cur}|${done}|${MW.save.hints}`;
    if (!force && key === S.hudKey) return;
    S.hudKey = key;
    const info = `<div class="hud-title">🔢 ${MW.esc(S.spec.name)}</div>` +
      `<div class="hud-row"><span>⭐ <b>${done}</b> / ${S.L} 关</span><span>💡 <b>${MW.save.hints}</b></span><span>${S.spec.settings.mathType === 'arith' ? '口算题' : '数独'}</span></div>`;
    const chips = S.islands.map((isl) => {
      const d = S.prog.done[isl.idx];
      const locked = isl.idx > S.cur;
      return `<button type="button" data-lv="${isl.idx}" class="${d ? 'done' : isl.idx === S.cur ? 'cur' : ''}"${locked ? ' disabled' : ''} aria-label="第${isl.idx + 1}关">${d ? '★' : isl.idx + 1}</button>`;
    }).join('');
    const center = (done >= S.L ? '<p class="keys">全部通关啦！点任意一关可以再玩一次</p>' : `<button type="button" class="btn btn-primary level-btn" data-lv="${S.cur}">▶ 开始第 ${S.cur + 1} 关</button>`) +
      `<div class="island-chips">${chips}</div>`;
    MW.ui.hud(info, '', center);
  }
})();
