/* 我的世界 · 贪吃蛇乐园：好多电脑蛇死了会自己复活，一直玩到你说“不玩了”才停 */
(function () {
  'use strict';
  const MW = window.MW;
  const H = MW.holo, M = MW.models;
  let S = null;
  const DIRS = [[1, 0], [0, 1], [-1, 0], [0, -1]];
  const NAMES = ['闪电', '泡泡', '彩虹', '火箭', '布丁', '糖豆', '旋风', '雪球', '跳跳', '咕噜', '豆豆', '星星', '团子', '奶糖', '果冻', '萌萌', '叮当', '丸子', '波波', '橙子', '可乐', '米粒', '飞飞', '嘟嘟', '饺子', '汤圆', '花卷', '芝麻', '麻薯', '阿呆', '酷酷', '贝贝', '乐乐', '多多', '咚咚', '哈哈', '拉面', '包子', '蘑菇', '甜甜'];
  const FOOD_COLOR = { star: '#ffe45c', coin: '#ffd24d', heart: '#ff7a9f', candy: '#ff7ad9', crystal: '#7fe8ff', flower: '#ffb0e0', mushroom: '#ff8f6b' };
  const WHITE = new THREE.Color('#ffffff');
  const tmpC = new THREE.Color();

  const gridSize = (spec) => MW.clamp(Math.round(24 + spec.settings.snakeCount * 0.45), 24, 42);
  function resolveEquip(list) {
    const eq = { speed: 1, magnet: 0, shield: 0, ghost: 0, double: false };
    for (const it of list) {
      if (it.effect === 'speed') eq.speed = Math.max(eq.speed, it.power);
      else if (it.effect === 'magnet') eq.magnet += it.power;
      else if (it.effect === 'shield') eq.shield = Math.max(eq.shield, it.power);
      else if (it.effect === 'ghost') eq.ghost = Math.max(eq.ghost, it.power);
      else if (it.effect === 'double') eq.double = true;
    }
    return eq;
  }
  const key = (x, y) => y * S.G + x;
  const toWorld = (gx, gy) => ({ x: (gx - S.G / 2 + 0.5) * S.cs, z: (gy - S.G / 2 + 0.5) * S.cs });

  function newSnake(id, isPlayer, color, name) {
    const c = new THREE.Color(color);
    if (!isPlayer) c.offsetHSL(MW.rand(-0.03, 0.03), 0, MW.rand(-0.06, 0.06));
    const c2 = c.clone().lerp(WHITE, 0.25);
    const head = c.clone().lerp(WHITE, 0.45);
    return {
      id, isPlayer, name, color: c, color2: c2, headColor: head,
      body: [], prev: [], dir: [1, 0], alive: false, respawnT: MW.rand(0, 1.2), acc: Math.random(),
      mul: isPlayer ? 1 : MW.rand(0.82, 1.08), chaos: MW.rand(0.3, 3.4), grow: 0, target: null, best: 0, shield: 0, ghost: 0, wrapped: false,
    };
  }
  function freeCell(x, y) { return x >= 0 && y >= 0 && x < S.G && y < S.G && !S.occ[key(x, y)]; }
  function spawnSnake(s, len, center) {
    for (let tries = 0; tries < 80; tries++) {
      let x, y, dir;
      if (center && tries < 40) {
        const r = Math.floor(tries / 4);
        x = Math.floor(S.G / 2) + MW.randi(-r, r);
        y = Math.floor(S.G / 2) + MW.randi(-r, r);
        dir = [0, -1];
      } else {
        x = MW.randi(3, S.G - 4); y = MW.randi(3, S.G - 4);
        dir = MW.pick(DIRS);
      }
      const cells = [];
      for (let k = 0; k < len; k++) cells.push({ x: x - dir[0] * k, y: y - dir[1] * k });
      if (cells.every((c) => freeCell(c.x, c.y)) && freeCell(x + dir[0], y + dir[1]) && freeCell(x + dir[0] * 2, y + dir[1] * 2)) {
        s.body = cells;
        s.prev = cells.map((c) => ({ x: c.x, y: c.y }));
        s.dir = dir;
        s.alive = true;
        s.grow = 0;
        s.acc = 0;
        s.target = null;
        s.wrapped = false;
        for (const c of cells) { S.occ[key(c.x, c.y)] = s.id + 1; const f = S.food.get(key(c.x, c.y)); if (f) S.food.delete(key(c.x, c.y)); }
        return true;
      }
    }
    return false;
  }
  function addFood(x, y) {
    if (S.food.size >= 260) return;
    const k = key(x, y);
    if (!S.food.has(k)) S.food.set(k, { x, y });
  }
  function topUpFood() {
    let guard = 0;
    while (S.food.size < S.foodTarget && guard++ < 200) {
      const x = MW.randi(0, S.G - 1), y = MW.randi(0, S.G - 1);
      if (!S.occ[key(x, y)]) addFood(x, y);
    }
  }
  function killSnake(s) {
    s.alive = false;
    for (const c of s.body) {
      if (S.occ[key(c.x, c.y)] === s.id + 1) S.occ[key(c.x, c.y)] = 0;
      if (Math.random() < 0.6) addFood(c.x, c.y);
    }
    if (s.body.length) {
      const w = toWorld(s.body[0].x, s.body[0].y);
      H.burst({ x: w.x, y: 0, z: w.z }, '#' + s.color.getHexString(), s.isPlayer ? 26 : 8, s.isPlayer ? 6 : 3);
    }
    s.best = Math.max(s.best, s.body.length);
    s.body = [];
    s.prev = [];
    if (s.isPlayer) playerDied(s);
    else { s.respawnT = MW.rand(1.2, 2.8); S.deaths++; }
  }

  // 电脑蛇怎么转弯：找最近的豆子，避开墙和别的蛇，偶尔犯迷糊
  function aiDir(s) {
    const h = s.body[0];
    if (!s.target || !S.food.has(key(s.target.x, s.target.y)) || Math.random() < 0.08) {
      let best = null, bd = 1e9;
      for (const f of S.food.values()) {
        const d = Math.abs(f.x - h.x) + Math.abs(f.y - h.y) + Math.random() * 3;
        if (d < bd) { bd = d; best = f; }
      }
      s.target = best;
    }
    let best = null, bestScore = -1e9;
    for (const d of DIRS) {
      if (d[0] === -s.dir[0] && d[1] === -s.dir[1]) continue;
      const nx = h.x + d[0], ny = h.y + d[1];
      if (!freeCell(nx, ny)) continue;
      let score = 0;
      if (s.target) score -= Math.abs(nx - s.target.x) + Math.abs(ny - s.target.y);
      let free = 0;
      for (const e of DIRS) if (freeCell(nx + e[0], ny + e[1])) free++;
      score += free * 1.2;
      if (d[0] === s.dir[0] && d[1] === s.dir[1]) score += 0.3;
      score += Math.random() * s.chaos;
      if (score > bestScore) { bestScore = score; best = d; }
    }
    return best || s.dir;
  }
  function moveSnake(s) {
    if (s.isPlayer) {
      const q = MW.input.dirQ;
      while (q.length) {
        const d = q.shift();
        if (d[0] === -s.dir[0] && d[1] === -s.dir[1]) continue;
        if (d[0] === s.dir[0] && d[1] === s.dir[1]) continue;
        s.dir = d;
        break;
      }
    } else s.dir = aiDir(s);
    const h = s.body[0];
    let nx = h.x + s.dir[0], ny = h.y + s.dir[1];
    s.wrapped = false;
    const out = nx < 0 || ny < 0 || nx >= S.G || ny >= S.G;
    if (out) {
      if (s.shield > 0) { nx = (nx + S.G) % S.G; ny = (ny + S.G) % S.G; s.wrapped = true; }
      else { killSnake(s); return; }
    }
    const owner = S.occ[key(nx, ny)];
    if (owner) {
      const tail = s.body[s.body.length - 1];
      const ownTail = owner === s.id + 1 && s.grow === 0 && tail.x === nx && tail.y === ny;
      const pass = s.shield > 0 || (s.ghost > 0 && owner !== s.id + 1);
      if (!ownTail && !pass) { killSnake(s); return; }
    }
    s.prev = s.body.map((c) => ({ x: c.x, y: c.y }));
    s.body.unshift({ x: nx, y: ny });
    const fk = key(nx, ny);
    if (S.food.has(fk)) {
      S.food.delete(fk);
      s.grow += s.isPlayer && S.eq && S.eq.double ? 2 : 1;
      if (s.isPlayer) MW.sfx('eat');
    }
    if (s.grow > 0) s.grow--;
    else {
      const t = s.body.pop();
      if (S.occ[key(t.x, t.y)] === s.id + 1) S.occ[key(t.x, t.y)] = 0;
    }
    S.occ[fk] = s.id + 1;
    s.best = Math.max(s.best, s.body.length);
    if (s.isPlayer && S.eq && S.eq.magnet) pullFood(s);
  }
  function pullFood(s) {
    const h = s.body[0], r = 2 + Math.round(S.eq.magnet * 2);
    const moves = [];
    for (const f of S.food.values()) {
      const dx = h.x - f.x, dy = h.y - f.y;
      if (Math.abs(dx) + Math.abs(dy) <= r && (dx || dy)) moves.push(f);
    }
    for (const f of moves) {
      const dx = h.x - f.x, dy = h.y - f.y;
      const nx = f.x + (Math.abs(dx) >= Math.abs(dy) ? Math.sign(dx) : 0), ny = f.y + (Math.abs(dx) < Math.abs(dy) ? Math.sign(dy) : 0);
      const nk = key(nx, ny);
      if (S.occ[nk] || S.food.has(nk)) continue;
      S.food.delete(key(f.x, f.y));
      f.x = nx; f.y = ny;
      S.food.set(nk, f);
    }
  }

  function simulate(dt) {
    for (const s of S.snakes) {
      if (!s.alive) {
        if (!s.isPlayer) {
          s.respawnT -= dt;
          if (s.respawnT <= 0) {
            if (spawnSnake(s, MW.randi(3, 5))) {
              S.revives++;
              if (S.revives % 3 === 0) { const w = toWorld(s.body[0].x, s.body[0].y); H.beam({ x: w.x, z: w.z }, '#' + s.color.getHexString(), 0.5); }
            } else s.respawnT = 0.5;
          }
        }
        continue;
      }
      if (s.isPlayer && (S.playerHold || S.waiting)) continue; // 你的蛇等你按方向键才出发
      s.shield = Math.max(0, s.shield - dt);
      s.ghost = Math.max(0, s.ghost - dt);
      let mul = s.mul;
      if (s.isPlayer && MW.input.boost()) mul *= S.eq ? Math.max(1.4, S.eq.speed) : 1.4;
      s.acc += (dt * mul) / S.step;
      let guard = 0;
      while (s.acc >= 1 && s.alive && guard++ < 3) { s.acc -= 1; moveSnake(s); }
    }
    topUpFood();
  }

  function render() {
    const d = S.dummy;
    let si = 0, hi = 0, ei = 0;
    const cs = S.cs;
    for (const s of S.snakes) {
      if (!s.alive) continue;
      const a = MW.clamp(s.acc, 0, 1);
      const n = s.body.length;
      for (let k = 0; k < n; k++) {
        const cur = s.body[k];
        const pr = s.prev[k] || s.prev[s.prev.length - 1] || cur;
        const jump = Math.abs(cur.x - pr.x) + Math.abs(cur.y - pr.y) > 1;
        const gx = jump ? cur.x : pr.x + (cur.x - pr.x) * a, gy = jump ? cur.y : pr.y + (cur.y - pr.y) * a;
        const wx = (gx - S.G / 2 + 0.5) * cs, wz = (gy - S.G / 2 + 0.5) * cs;
        if (k === 0) {
          d.position.set(wx, cs * 0.6, wz);
          d.scale.setScalar(1);
          d.rotation.set(0, 0, 0);
          d.updateMatrix();
          S.headMesh.setMatrixAt(hi, d.matrix);
          const flashing = (s.shield > 0 || s.ghost > 0) && Math.floor(S.t * 10) % 2 === 0;
          S.headMesh.setColorAt(hi, flashing ? WHITE : s.headColor);
          hi++;
          const fx = s.dir[0], fz = s.dir[1], sx = -fz, sz = fx;
          for (const side of [-1, 1]) {
            d.position.set(wx + fx * cs * 0.32 + sx * side * cs * 0.24, cs * 0.92, wz + fz * cs * 0.32 + sz * side * cs * 0.24);
            d.updateMatrix();
            S.eyeMesh.setMatrixAt(ei, d.matrix);
            S.eyeMesh.setColorAt(ei, WHITE);
            ei++;
          }
          if (s.isPlayer) S.youTag.position.set(wx, cs + 1.1, wz);
        } else if (si < S.maxSeg) {
          d.position.set(wx, cs * 0.5, wz);
          d.scale.setScalar(MW.lerp(1, 0.6, k / Math.max(1, n - 1)));
          d.updateMatrix();
          S.segMesh.setMatrixAt(si, d.matrix);
          S.segMesh.setColorAt(si, k % 2 ? s.color : s.color2);
          si++;
        }
      }
    }
    let fi = 0;
    for (const f of S.food.values()) {
      if (fi >= S.maxFood) break;
      const wx = (f.x - S.G / 2 + 0.5) * cs, wz = (f.y - S.G / 2 + 0.5) * cs;
      d.position.set(wx, cs * 0.45 + Math.sin(S.t * 3 + f.x + f.y) * cs * 0.12, wz);
      d.rotation.set(0, S.t * 2 + f.x, 0);
      d.scale.setScalar(1);
      d.updateMatrix();
      S.foodMesh.setMatrixAt(fi, d.matrix);
      fi++;
    }
    for (const [m, c] of [[S.segMesh, si], [S.headMesh, hi], [S.eyeMesh, ei], [S.foodMesh, fi]]) {
      m.count = c;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
  }

  const mode = (MW.modes = MW.modes || {}).snake = {
    gridSize,
    build(ctx) {
      const { spec, colors, group } = ctx;
      const G = gridSize(spec);
      const cs = (ctx.R * 2 * 0.68) / G;
      S = {
        ctx, spec, colors, group, G, cs, snakes: [], food: new Map(), occ: new Int16Array(G * G),
        step: 0.14 / spec.settings.speed / (0.85 + spec.settings.difficulty * 0.08), t: 0, hudT: 0,
        frozen: false, running: false, revives: 0, deaths: 0, player: null, playerHold: false, skillCd: 0,
        maxSeg: 2600, maxFood: 280, dummy: new THREE.Object3D(),
      };
      S.foodTarget = Math.min(220, Math.round(spec.settings.snakeCount * 1.6 + 16));
      const half = (G * cs) / 2;
      const pts = [[-half, -half], [half, -half], [half, half], [-half, half], [-half, -half]].map(([x, z]) => new THREE.Vector3(x, 0.06, z));
      const border = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), H.lineMat(colors.main, 1));
      border.userData.dispose = () => border.geometry.dispose();
      group.add(border);
      const inner = new THREE.Mesh(new THREE.PlaneGeometry(G * cs, G * cs), new THREE.MeshBasicMaterial({ color: new THREE.Color(colors.main), transparent: true, opacity: 0.05, blending: THREE.AdditiveBlending, depthWrite: false }));
      inner.rotation.x = -Math.PI / 2;
      inner.position.y = 0.03;
      inner.userData.dispose = () => { inner.geometry.dispose(); inner.material.dispose(); };
      group.add(inner);
      for (const [x, z] of [[-half, -half], [half, -half], [half, half], [-half, half]]) M.P(group, H.geo('cyl', 0.12, 0.12, 1.2, 6), colors.accent, x, 0.6, z, { env: true });
      // 场地外面的小零件
      const deco = spec.parts.filter((p) => !FOOD_COLOR[p.type] || p.type === 'crystal' || p.type === 'mushroom' || p.type === 'flower');
      let di = 0;
      for (const p of deco) {
        for (let k = 0; k < Math.min(p.count, 4); k++) {
          const ang = [0, Math.PI / 2, Math.PI, Math.PI * 1.5][di % 4] + (Math.floor(di / 4) % 2 ? 0.28 : -0.28) * (1 + Math.floor(di / 8) * 0.6);
          const r = (half + ctx.R) / 2 + 0.3;
          const g = M.part(p.type, colors.main, colors.accent);
          g.scale.setScalar(p.type === 'tower' || p.type === 'castle' || p.type === 'house' ? 0.55 : 0.8);
          g.position.set(Math.cos(ang) * r, 0, Math.sin(ang) * r);
          group.add(g);
          di++;
        }
      }
      const foodPart = spec.parts.find((p) => FOOD_COLOR[p.type] && p.type !== 'crystal' && p.type !== 'mushroom' && p.type !== 'flower');
      S.foodName = foodPart ? foodPart.name : '星星豆';
      const foodColor = foodPart ? FOOD_COLOR[foodPart.type] : '#ffe45c';
      const mk = (geo, mat, n) => {
        const m = new THREE.InstancedMesh(geo, mat, n);
        m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
        m.frustumCulled = false;
        m.setColorAt(0, WHITE);
        m.count = 0;
        group.add(m);
        return m;
      };
      S.segMesh = mk(H.geo('ico', cs * 0.5, 1), H.body('#ffffff'), S.maxSeg);
      S.headMesh = mk(H.geo('ico', cs * 0.64, 1), H.body('#ffffff'), 64);
      S.eyeMesh = mk(H.geo('sphere', cs * 0.15, 8, 6), H.body('#ffffff'), 128);
      S.foodMesh = mk(H.geo('oct', cs * 0.34), H.body(foodColor), S.maxFood);
      S.foodMesh.instanceColor = null; // 豆子统一颜色
      S.youTag = H.label('你', colors.accent, { px: 34, size: 0.7, bg: true, depthTest: false });
      S.youTag.visible = false;
      group.add(S.youTag);
      const teams = spec.characters.length ? spec.characters : [{ name: '电脑蛇队', count: spec.settings.snakeCount }];
      const totalW = teams.reduce((s, c) => s + c.count, 0) || 1;
      const teamColors = [colors.second, colors.main, '#5dffa8', '#ff9f43', '#b57bff', '#ff5470'];
      let id = 0;
      teams.forEach((tm, ti) => {
        const n = Math.max(1, Math.round((spec.settings.snakeCount * tm.count) / totalW));
        for (let k = 0; k < n && id < spec.settings.snakeCount; k++) {
          S.snakes.push(newSnake(id, false, teamColors[ti % teamColors.length], NAMES[id % NAMES.length] + '·' + String(tm.name).replace(/队$/, '').slice(0, 4)));
          id++;
        }
      });
      while (id < spec.settings.snakeCount) { S.snakes.push(newSnake(id, false, teamColors[id % teamColors.length], NAMES[id % NAMES.length])); id++; }
      for (const s of S.snakes) if (Math.random() < 0.8) spawnSnake(s, MW.randi(3, 6));
      topUpFood();
      render();
    },

    preview(dt, t) {
      if (!S) return;
      S.t += dt;
      if (!S.frozen) simulate(dt);
      render();
    },
    updatePaused(dt, t) {
      // 你在看广告或者选复活的时候，电脑蛇还在继续玩
      if (!S) return;
      S.t += dt;
      S.playerHold = true;
      simulate(dt);
      render();
      hud(false, dt);
    },
    start() {
      S.frozen = false;
      S.running = true;
      S.playerHold = false;
      S.eq = resolveEquip(MW.eco.activeEquip(S.spec));
      S.skillCd = 0;
      if (!S.player) {
        S.player = newSnake(S.snakes.length, true, S.colors.accent, '你');
        S.snakes.push(S.player);
      }
      const p = S.player;
      p.best = 0;
      if (p.alive) killQuiet(p);
      spawnSnake(p, 4, true);
      p.shield = 2;
      S.waiting = true;
      MW.input.dirQ.length = 0;
      S.youTag.visible = true;
      const c = H.cam;
      c.mode = 'fixed';
      c.fixedPos.set(0, 25, 16.5);
      c.lookAt.set(0, 0, 1.2);
      c.lerp = 3;
      hud(true);
      setTimeout(() => { if (S && S.running) MW.toast(`你是头上写着“你”的那条蛇，去吃${S.foodName}吧！`); }, 900);
    },
    update(dt, t) {
      if (!S || !S.running) return;
      S.t += dt;
      S.playerHold = false;
      if (S.waiting && MW.input.dirQ.length) S.waiting = false;
      S.skillCd = Math.max(0, S.skillCd - dt);
      if (MW.input.take('skill')) useSkill();
      MW.input.take('attack');
      MW.input.take('jump');
      simulate(dt);
      render();
      hud(false, dt);
    },
    stop() {
      if (!S) return null;
      S.running = false;
      S.frozen = true;
      const p = S.player;
      let best = 0, coins = 0;
      if (p) {
        best = Math.max(p.best, p.body.length);
        if (p.alive) killQuiet(p);
        coins = Math.floor(best / 3);
        if (coins > 0) MW.eco.addCoins(coins);
        const rec = MW.save.best[S.spec.id] || {};
        if (best > (rec.snake || 0)) { rec.snake = best; MW.save.best[S.spec.id] = rec; MW.persist(); }
      }
      S.youTag.visible = false;
      render();
      MW.toast(`所有蛇都停下来休息啦 😴${coins ? `　奖励 🪙 +${coins}` : ''}`);
      return `你按了「不玩了」，${S.snakes.length - 1} 条电脑蛇都停下来休息了 😴 这次你的蛇最长 ${best} 节${S.revives ? `，电脑蛇一共复活了 ${S.revives} 次` : ''}。想让它们再动起来，就点「进入世界」。`;
    },
    onEquip() { if (S && S.running) S.eq = resolveEquip(MW.eco.activeEquip(S.spec)); },
    dispose() { S = null; },
    _debug: () => S,
  };

  function killQuiet(s) {
    for (const c of s.body) if (S.occ[key(c.x, c.y)] === s.id + 1) S.occ[key(c.x, c.y)] = 0;
    s.body = []; s.prev = []; s.alive = false;
  }
  function useSkill() {
    const p = S.player;
    if (!p || !p.alive) return;
    if (!S.eq.shield && !S.eq.ghost) { MW.toast('装上「无敌护盾」或「幽灵皮肤」才能放技能（会员装备）'); return; }
    if (S.skillCd > 0) { MW.toast(`技能还要等 ${Math.ceil(S.skillCd)} 秒`); return; }
    if (S.eq.shield) { p.shield = S.eq.shield + 3; S.skillCd = 18; MW.toast(`🛡️ 无敌 ${Math.round(p.shield)} 秒！撞墙会从另一边钻出来`, 'gold'); }
    else { p.ghost = S.eq.ghost + 3; S.skillCd = 15; MW.toast(`👻 ${Math.round(p.ghost)} 秒内可以穿过别的蛇`, 'gold'); }
    MW.sfx('revive');
  }
  function playerDied(p) {
    MW.sfx('die');
    const len = p.best;
    S.playerHold = true;
    setTimeout(() => {
      if (!S || !S.running) return;
      MW.eco.fail({
        title: '💥 你的蛇撞到了！',
        msg: `这次最长 <b>${len}</b> 节。电脑蛇们还在继续玩，复活了马上回来！`,
        verb: '复活',
        onContinue: () => {
          if (!S || !S.running) return;
          MW.input.dirQ.length = 0;
          spawnSnake(p, 4, true);
          p.shield = 2.5;
          S.waiting = true;
          S.playerHold = false;
          const w = toWorld(p.body[0].x, p.body[0].y);
          H.beam({ x: w.x, z: w.z }, S.colors.accent, 0.8);
          MW.toast('复活成功！');
        },
        onQuit: () => MW.app.quitPlay(),
      });
    }, 650);
  }
  function hud(force, dt = 0) {
    S.hudT -= dt;
    if (!force && S.hudT > 0) return;
    S.hudT = 0.2;
    const alive = S.snakes.filter((s) => s.alive);
    const p = S.player;
    const len = p && p.alive ? p.body.length : 0;
    const rank = p && p.alive ? alive.filter((s) => s.body.length > len).length + 1 : '-';
    const skill = S.eq && (S.eq.shield || S.eq.ghost) ? `<span>技能 <b>${S.skillCd > 0 ? Math.ceil(S.skillCd) + 's' : '✓'}</b></span>` : '';
    const info = `<div class="hud-title">🐍 ${MW.esc(S.spec.name)}</div>` +
      `<div class="hud-row"><span>长度 <b>${len}</b></span><span>第 <b>${rank}</b> 名 / ${alive.length}</span><span>复活了 <b>${S.revives}</b> 次</span>${skill}</div>`;
    const top = alive.slice().sort((a, b) => b.body.length - a.body.length).slice(0, 5);
    if (p && p.alive && !top.includes(p)) top.push(p);
    const side = `<div class="board"><h4>最长的蛇</h4>${top.map((s, i) => `<div class="${s.isPlayer ? 'me' : ''}"><span>${i + 1}. ${MW.esc(s.isPlayer ? '你' : s.name)}</span><span>${s.body.length}</span></div>`).join('')}</div>`;
    const center = S.waiting && p && p.alive ? `<p class="go-hint">${MW.isTouch ? '点方向键或者滑动屏幕' : '按方向键'}，你的蛇就出发！</p>` : '';
    MW.ui.hud(info, side, center);
  }
})();
