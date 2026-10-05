/* 我的世界 · 打击空间：一波波敌人、装备、贪吃蛇召唤器、复活规则 */
(function () {
  'use strict';
  const MW = window.MW;
  const H = MW.holo, M = MW.models, K = MW.models.kit;
  let S = null;

  function resolveEquip(list) {
    const eq = { damage: 1, range: 1, shield: 0, speed: 1, heal: 0, summon: 0, magnet: 0, ranged: false };
    for (const it of list) {
      const p = it.power || 1;
      if (it.effect === 'damage') eq.damage *= Math.max(1, p);
      else if (it.effect === 'range') { eq.range *= Math.max(1.2, p * 0.8 + 0.4); eq.ranged = eq.ranged || p >= 2 || /枪|弓|炮|激光|镖|雷|闪电/.test(it.name); }
      else if (it.effect === 'shield') eq.shield += p;
      else if (it.effect === 'speed') eq.speed *= Math.max(1.1, p);
      else if (it.effect === 'heal') eq.heal += p * 2;
      else if (it.effect === 'summon') eq.summon += Math.round(p);
      else if (it.effect === 'magnet') eq.magnet += p;
    }
    eq.summon = Math.min(eq.summon, 10);
    return eq;
  }
  const isBossDef = (c) => ['monster', 'dragon', 'dino'].includes(c.shape) || /boss|王|大块头|巨/i.test(c.name);
  function pickBoss(defs) {
    if (!defs.length) return null;
    return defs.find(isBossDef) || defs.slice().sort((a, b) => a.count - b.count)[0];
  }
  const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);

  function spawnPreview() {
    const { layout, colors, group } = S.ctx;
    S.preview = [];
    for (const c of layout.chars) {
      const friend = c.role === 'friend';
      const boss = !friend && S.bossDef && c.name === S.bossDef.name && S.enemyDefs.length > 1;
      const a = K.actor(c, friend ? colors.main : S.colors.second, colors.accent, boss ? 1.5 : 1);
      K.place(a, c.x, c.z);
      a.face = Math.atan2(-c.x, -c.z);
      a.obj.rotation.y = a.face;
      group.add(a.obj);
      S.preview.push(a);
    }
  }
  function clearRun() {
    for (const list of [S.enemies, S.friends, S.drops, S.shots]) { for (const a of list) S.group.remove(a.obj); list.length = 0; }
    for (const s of S.snakes) s.segs.forEach((m) => S.group.remove(m));
    S.snakes.length = 0;
    for (const a of S.preview || []) S.group.remove(a.obj);
    S.preview = [];
  }

  const mode = (MW.modes = MW.modes || {}).combat = {
    build(ctx) {
      const { spec, colors, group } = ctx;
      S = { ctx, spec, colors: Object.assign({}, colors), group, R: ctx.R, enemies: [], friends: [], parts: [], drops: [], shots: [], snakes: [], preview: [], running: false, t: 0, hudT: 0 };
      const hueOf = (c) => { const o = {}; new THREE.Color(c).getHSL(o); return o.h; };
      const hueGap = (a, b) => { const d = Math.abs(hueOf(a) - hueOf(b)); return Math.min(d, 1 - d); };
      if (hueGap(colors.main, colors.second) < 0.15) S.colors.second = ['#ff5fa2', '#ff6a3d', '#4ff3ff'].find((c) => hueGap(colors.main, c) >= 0.15);
      S.enemyDefs = spec.characters.filter((c) => c.role === 'enemy');
      S.friendDefs = spec.characters.filter((c) => c.role === 'friend');
      S.bossDef = pickBoss(S.enemyDefs);
      S.hero = K.actor(spec.hero, colors.accent, colors.main, 1);
      S.hero.obj.add(K.heroRing(colors.accent));
      const tag = H.label(spec.hero.name || '你', colors.accent, { px: 34, size: 0.72, bg: true });
      tag.position.y = 2.8;
      S.hero.obj.add(tag);
      K.place(S.hero, 0, 0);
      group.add(S.hero.obj);
      for (const p of ctx.layout.parts) {
        const g = M.part(p.type, colors.main, colors.accent);
        g.position.set(p.x, 0, p.z);
        if (p.type !== 'portal') g.rotation.y = ctx.rng() * Math.PI * 2;
        else g.rotation.y = Math.atan2(-p.x, -p.z);
        group.add(g);
        S.parts.push({ type: p.type, name: p.name, x: p.x, z: p.z, obj: g, cd: 0, used: false, hidden: 0 });
      }
      spawnPreview();
    },

    preview(dt, t) {
      if (!S) return;
      M.animate(S.hero.model, t, 0);
      for (const a of S.preview) M.animate(a.model, t + a.phase, 0);
      for (const p of S.parts) M.animatePart(p.obj, t, dt);
    },

    start() {
      clearRun();
      const spec = S.spec;
      S.hp = S.maxHp = 100;
      S.wave = 0; S.kills = 0; S.atkCd = 0; S.invuln = 1.2; S.waveDelay = 1.4;
      S.downed = false; S.won = false; S.totalWaves = spec.settings.waves; S.t = 0;
      Object.assign(S.hero, { y: 0, vx: 0, vz: 0, vy: 0, face: 0 });
      K.place(S.hero, 0, 0);
      S.hero.obj.visible = true;
      for (const p of S.parts) {
        p.used = false; p.hidden = 0; p.cd = 0; p.obj.visible = true;
        if (p.obj.userData.lid) p.obj.userData.lid.rotation.x = 0;
      }
      S.eq = resolveEquip(MW.eco.activeEquip(spec));
      let slot = 0;
      for (const def of S.friendDefs) {
        for (let i = 0; i < Math.min(def.count, 3); i++) {
          const f = K.actor(def, S.colors.main, S.colors.accent, 0.85);
          f.slot = slot++ * 1.3 + 2.4;
          f.zapCd = 1 + Math.random();
          K.place(f, Math.sin(f.slot) * 2.4, Math.cos(f.slot) * 2.4 + 1);
          S.group.add(f.obj);
          S.friends.push(f);
        }
      }
      syncSnakes();
      H.cam.mode = 'follow';
      H.cam.offset.set(0, 11, 12.5);
      H.cam.lerp = 4;
      H.cam.follow.set(0, 0, 0);
      S.running = true;
      hud(true);
    },

    update(dt, t) {
      if (!S || !S.running) return;
      S.t += dt;
      const hero = S.hero, eq = S.eq;
      if (!S.downed) K.moveHero(hero, dt, t, { speed: eq.speed, R: S.R });
      H.cam.follow.set(hero.x, 0, hero.z);
      S.invuln -= dt;
      hero.obj.visible = S.downed ? false : S.invuln > 0 ? Math.floor(S.t * 12) % 2 === 0 : true;
      if (eq.heal && !S.downed && S.hp < S.maxHp) S.hp = Math.min(S.maxHp, S.hp + eq.heal * dt);

      // 小零件
      for (const p of S.parts) {
        M.animatePart(p.obj, t, dt);
        if (p.hidden > 0) { p.hidden -= dt; if (p.hidden <= 0) { p.obj.visible = true; H.spark({ x: p.x, y: 0.5, z: p.z }, S.colors.accent); } continue; }
        p.cd -= dt;
        if (S.downed) continue;
        const d = Math.hypot(hero.x - p.x, hero.z - p.z);
        if (p.type === 'jumppad' && d < 0.95 && hero.y < 0.15) { hero.vy = 13.5; MW.sfx('bounce'); H.ring({ x: p.x, y: 0, z: p.z }, S.colors.accent, 2.5); }
        else if (p.type === 'mushroom' && d < 0.8 && hero.y < 0.15) { hero.vy = 9.5; MW.sfx('bounce'); }
        else if (p.type === 'chest' && d < 1.3 && !p.used) openChest(p);
        else if (p.type === 'heart' && d < 1.0 && S.hp < S.maxHp) { S.hp = Math.min(S.maxHp, S.hp + 30); hide(p, 20); MW.sfx('heart'); H.floatText(hero.obj.position, '+30 ❤', '#ff7a9f', 0.7); }
        else if ((p.type === 'crystal' || p.type === 'star' || p.type === 'coin') && d < 1.0) {
          const v = p.type === 'star' ? 5 : p.type === 'crystal' ? 3 : 2;
          MW.eco.addCoins(v); hide(p, 18); MW.sfx('coin'); H.floatText(hero.obj.position, '+' + v + ' 🪙', '#ffe45c', 0.6);
        } else if (p.type === 'portal' && d < 0.9 && p.cd <= 0) {
          const portals = S.parts.filter((q) => q.type === 'portal');
          if (portals.length > 1) {
            const next = portals[(portals.indexOf(p) + 1) % portals.length];
            H.beam({ x: hero.x, z: hero.z }, S.colors.main, 0.5);
            const back = Math.hypot(next.x, next.z) || 1;
            K.place(hero, next.x - (next.x / back) * 1.4, next.z - (next.z / back) * 1.4);
            portals.forEach((q) => { q.cd = 1.5; });
            H.beam({ x: hero.x, z: hero.z }, S.colors.main, 0.5);
            MW.sfx('zap');
          }
        }
      }

      // 攻击
      S.atkCd -= dt;
      if (!S.downed && MW.input.take('attack') && S.atkCd <= 0) attack();
      MW.input.take('interact');

      // 敌人
      for (let i = S.enemies.length - 1; i >= 0; i--) {
        const e = S.enemies[i];
        e.spawnT -= dt; e.hitCd -= dt; e.flash = Math.max(0, (e.flash || 0) - dt);
        const dx = hero.x - e.x, dz = hero.z - e.z, d = Math.hypot(dx, dz) || 1;
        let sx = dx / d, sz = dz / d;
        if (S.downed) { sx = -sx * 0.2; sz = -sz * 0.2; }
        for (const o of S.enemies) {
          if (o === e) continue;
          const ox = e.x - o.x, oz = e.z - o.z, od = ox * ox + oz * oz;
          if (od < 2.2 && od > 0.0001) { sx += (ox / od) * 0.5; sz += (oz / od) * 0.5; }
        }
        const sl = Math.hypot(sx, sz) || 1;
        let vx = (sx / sl) * e.speed, vz = (sz / sl) * e.speed;
        if (e.spawnT > 0) { vx = 0; vz = 0; }
        if (e.knock > 0) { e.knock -= dt; vx = e.kx; vz = e.kz; }
        e.x += vx * dt; e.z += vz * dt;
        const ed = Math.hypot(e.x, e.z), lim = S.R - 0.6;
        if (ed > lim) { e.x *= lim / ed; e.z *= lim / ed; }
        e.face = Math.atan2(dx, dz);
        e.obj.rotation.y = K.lerpAngle(e.obj.rotation.y, e.face, Math.min(1, dt * 8));
        e.obj.position.set(e.x, 0, e.z);
        M.animate(e.model, t + e.phase, e.spawnT > 0 ? 0 : 1);
        if (e.flash > 0) e.model.scale.setScalar(e.scale * (1 + e.flash * 1.5));
        else if (!e.model.userData.anim.squash) e.model.scale.setScalar(e.scale);
        if (!S.downed && d < e.r + 0.7 && e.hitCd <= 0 && hero.y < 1.1 && S.invuln <= 0 && e.spawnT <= 0) {
          e.hitCd = 0.9;
          hurtHero(e.dmg);
        }
      }

      updateFriends(dt, t);
      updateSnakes(dt, t);
      updateShots(dt);
      updateDrops(dt, t);

      // 下一波
      if (!S.won && !S.downed && S.enemies.length === 0) {
        if (S.wave >= S.totalWaves && S.wave > 0) victory();
        else {
          S.waveDelay -= dt;
          if (S.waveDelay <= 0) { S.waveDelay = 2.2; spawnWave(++S.wave); }
        }
      }
      hud(false, dt);
    },

    stop() {
      if (!S) return;
      S.running = false;
      clearRun();
      Object.assign(S.hero, { y: 0, vx: 0, vz: 0, vy: 0 });
      K.place(S.hero, 0, 0);
      S.hero.obj.visible = true;
      for (const p of S.parts) { p.obj.visible = true; p.hidden = 0; if (p.obj.userData.lid) p.obj.userData.lid.rotation.x = 0; }
      spawnPreview();
    },
    onEquip() {
      if (!S || !S.running) return;
      S.eq = resolveEquip(MW.eco.activeEquip(S.spec));
      syncSnakes();
    },
    dispose() { S = null; },
    _debug: () => S,
  };

  function hide(p, secs) { p.hidden = secs; p.obj.visible = false; H.burst({ x: p.x, y: 0.3, z: p.z }, S.colors.accent, 8, 3); }
  function openChest(p) {
    p.used = true;
    const lid = p.obj.userData.lid;
    if (lid) lid.rotation.x = -1.2;
    MW.sfx('open');
    H.burst({ x: p.x, y: 0.4, z: p.z }, '#ffe45c', 18, 4);
    MW.eco.addCoins(15);
    H.floatText({ x: p.x, y: 0, z: p.z }, '+15 🪙', '#ffe45c', 0.7);
    if (Math.random() < 0.35) { MW.eco.addRevive(1); MW.toast('宝箱里有一个复活石 💎', 'gold'); }
  }

  function spawnWave(n) {
    const d = S.spec.settings.difficulty;
    const size = Math.min(16, Math.round(2 + n * (1.1 + d * 0.45)));
    const defs = S.enemyDefs.length > 1 ? S.enemyDefs.filter((e) => e !== S.bossDef) : S.enemyDefs;
    const total = defs.reduce((s, e) => s + e.count, 0) || 1;
    for (let i = 0; i < size; i++) {
      let r = Math.random() * total, def = defs[0];
      for (const e of defs) { r -= e.count; if (r <= 0) { def = e; break; } }
      spawnEnemy(def, false);
    }
    const last = n === S.totalWaves;
    if (last && S.bossDef) spawnEnemy(S.bossDef, true);
    MW.toast(last ? `最后一波！${S.bossDef ? S.bossDef.name + '来了！' : ''}` : `第 ${n} 波敌人来了！`);
    MW.sfx('spawn');
  }
  function spawnEnemy(def, boss) {
    if (!def) return;
    const e = K.actor(def, S.colors.second, S.colors.accent, boss ? 2 : 1);
    let ang = Math.random() * Math.PI * 2;
    for (let k = 0; k < 8; k++) {
      const x = Math.cos(ang) * (S.R - 1), z = Math.sin(ang) * (S.R - 1);
      if (Math.hypot(x - S.hero.x, z - S.hero.z) > 7) break;
      ang += 0.8;
    }
    K.place(e, Math.cos(ang) * (S.R - 1), Math.sin(ang) * (S.R - 1));
    const d = S.spec.settings.difficulty, sp = S.spec.settings.speed;
    e.maxHp = e.hp = (boss ? 20 : 3) * (1 + (d - 1) * 0.3);
    const shapeSpeed = def.shape === 'ninja' ? 1.35 : def.shape === 'zombie' ? 0.65 : def.shape === 'slime' ? 0.85 : 1;
    e.speed = (boss ? 1.7 : 2.0 + Math.random() * 0.7) * (0.8 + d * 0.12) * sp * shapeSpeed;
    e.dmg = (boss ? 16 : 6) + d * 2;
    e.boss = boss; e.spawnT = 0.7; e.hitCd = 0; e.knock = 0;
    if (boss) {
      const tag = H.label(def.name, S.colors.second, { px: 34, size: 0.6, bg: true });
      tag.position.y = 4.6;
      e.obj.add(tag);
    }
    H.beam({ x: e.x, z: e.z }, S.colors.second, 0.6);
    S.group.add(e.obj);
    S.enemies.push(e);
  }

  function attack() {
    S.atkCd = 0.36;
    const reach = 2.0 * S.eq.range;
    MW.sfx('swing');
    H.ring({ x: S.hero.x, y: S.hero.y, z: S.hero.z }, S.colors.accent, reach, 0.28);
    const arm = S.hero.model.userData.anim && S.hero.model.userData.anim.arms && S.hero.model.userData.anim.arms[1];
    if (arm) arm.rotation.x = -2.2;
    let hit = 0;
    for (const e of S.enemies.slice()) {
      const dx = e.x - S.hero.x, dz = e.z - S.hero.z, d = Math.hypot(dx, dz) || 1;
      if (d < reach + e.r) { hitEnemy(e, S.eq.damage, dx / d, dz / d, true); hit++; }
    }
    if (S.eq.ranged) {
      const target = nearestEnemy(S.hero.x, S.hero.z, 14, reach);
      if (target) shoot(target);
    }
    if (hit) MW.sfx('hit');
  }
  function nearestEnemy(x, z, max, minD = 0) {
    let best = null, bd = max;
    for (const e of S.enemies) {
      const d = Math.hypot(e.x - x, e.z - z);
      if (d < bd && d >= minD) { bd = d; best = e; }
    }
    return best;
  }
  function hitEnemy(e, dmg, nx, nz, show) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    e.flash = 0.12;
    if (!e.boss) { e.knock = 0.14; e.kx = nx * 9; e.kz = nz * 9; }
    if (show) H.floatText(e.obj.position, '-' + (Math.round(dmg * 10) / 10), '#ffe45c', e.boss ? 0.9 : 0.6);
    if (e.hp <= 0) killEnemy(e);
  }
  function killEnemy(e) {
    const i = S.enemies.indexOf(e);
    if (i < 0) return;
    S.enemies.splice(i, 1);
    S.group.remove(e.obj);
    H.burst({ x: e.x, y: 0.4, z: e.z }, S.colors.second, e.boss ? 40 : 14, e.boss ? 8 : 5);
    if (e.boss) { H.ring({ x: e.x, y: 0, z: e.z }, S.colors.accent, 8, 0.8); MW.sfx('win'); }
    S.kills++;
    const n = e.boss ? 10 : Math.random() < 0.5 ? 2 : 1;
    for (let k = 0; k < n; k++) spawnDrop(e.x + MW.rand(-0.8, 0.8), e.z + MW.rand(-0.8, 0.8));
  }
  function spawnDrop(x, z) {
    const g = M.part('coin', S.colors.accent, S.colors.main);
    g.scale.setScalar(0.65);
    g.position.set(x, 0, z);
    g.userData.floatY = 0;
    S.group.add(g);
    S.drops.push({ obj: g, x, z, life: 14 });
  }
  function updateDrops(dt, t) {
    const hero = S.hero;
    const mag = 1.1 + S.eq.magnet * 3;
    for (let i = S.drops.length - 1; i >= 0; i--) {
      const c = S.drops[i];
      c.life -= dt;
      c.obj.rotation.y += dt * 4;
      c.obj.position.y = Math.sin(t * 4 + i) * 0.1;
      const d = Math.hypot(hero.x - c.x, hero.z - c.z);
      if (!S.downed && d < mag) {
        const k = Math.min(1, dt * 10);
        c.x += (hero.x - c.x) * k; c.z += (hero.z - c.z) * k;
        c.obj.position.x = c.x; c.obj.position.z = c.z;
      }
      if (!S.downed && d < 0.7) {
        MW.eco.addCoins(1);
        MW.sfx('coin');
        S.group.remove(c.obj);
        S.drops.splice(i, 1);
      } else if (c.life <= 0) {
        S.group.remove(c.obj);
        S.drops.splice(i, 1);
      }
    }
  }
  function shoot(target) {
    const m = new THREE.Mesh(H.geo('sphere', 0.22, 10, 8), H.body(S.colors.accent));
    m.position.set(S.hero.x, 1.2, S.hero.z);
    S.group.add(m);
    S.shots.push({ obj: m, x: S.hero.x, z: S.hero.z, target, life: 1.2 });
    MW.sfx('zap');
  }
  function updateShots(dt) {
    for (let i = S.shots.length - 1; i >= 0; i--) {
      const s = S.shots[i];
      s.life -= dt;
      const tg = s.target;
      if (!tg || tg.hp <= 0 || s.life <= 0) { S.group.remove(s.obj); S.shots.splice(i, 1); continue; }
      const dx = tg.x - s.x, dz = tg.z - s.z, d = Math.hypot(dx, dz) || 1;
      s.x += (dx / d) * 18 * dt; s.z += (dz / d) * 18 * dt;
      s.obj.position.set(s.x, 1.2, s.z);
      if (d < tg.r + 0.3) {
        hitEnemy(tg, S.eq.damage * 0.8, dx / d, dz / d, true);
        H.burst({ x: s.x, y: 0.6, z: s.z }, S.colors.accent, 6, 3);
        S.group.remove(s.obj);
        S.shots.splice(i, 1);
      }
    }
  }
  function updateFriends(dt, t) {
    const hero = S.hero;
    for (const f of S.friends) {
      f.zapCd -= dt;
      const target = nearestEnemy(f.x, f.z, 6.5);
      let tx = hero.x + Math.sin(f.slot) * 2.4, tz = hero.z + Math.cos(f.slot) * 2.4 + 0.8;
      if (target) { tx = MW.lerp(f.x, target.x, 0.5); tz = MW.lerp(f.z, target.z, 0.5); }
      const dx = tx - f.x, dz = tz - f.z, d = Math.hypot(dx, dz);
      const sp = Math.min(6, d * 3);
      if (d > 0.05) { f.x += (dx / d) * sp * dt; f.z += (dz / d) * sp * dt; f.face = Math.atan2(dx, dz); }
      f.obj.rotation.y = K.lerpAngle(f.obj.rotation.y, target ? Math.atan2(target.x - f.x, target.z - f.z) : f.face, Math.min(1, dt * 8));
      f.obj.position.set(f.x, 0, f.z);
      M.animate(f.model, t + f.phase, Math.min(1, sp / 4));
      if (target && f.zapCd <= 0 && !S.downed) {
        f.zapCd = 1.6;
        H.zap({ x: f.x, y: 0, z: f.z }, { x: target.x, y: 0, z: target.z }, S.colors.main);
        MW.sfx('zap');
        hitEnemy(target, 0.4, 0, 0, false);
      }
    }
  }

  // 贪吃蛇召唤器：一群全息蛇帮你咬怪，死了会自己复活
  function syncSnakes() {
    const want = S.eq ? S.eq.summon : 0;
    while (S.snakes.length > want) { const s = S.snakes.pop(); s.segs.forEach((m) => S.group.remove(m)); }
    while (S.snakes.length < want) S.snakes.push(makeSnake(S.snakes.length));
  }
  function makeSnake(i) {
    const segs = [];
    const cols = [S.colors.accent, S.colors.main, '#5dffa8'];
    for (let k = 0; k < 8; k++) {
      const m = new THREE.Mesh(H.geo('sphere', k === 0 ? 0.3 : 0.25 - k * 0.012, 10, 8), H.body(k === 0 ? cols[0] : cols[1 + (k % 2)]));
      m.position.set(S.hero.x, 0.3, S.hero.z);
      S.group.add(m);
      segs.push(m);
    }
    const a = (i / 6) * Math.PI * 2;
    return { segs, trail: [], x: S.hero.x + Math.cos(a) * 1.5, z: S.hero.z + Math.sin(a) * 1.5, ang: a, off: a, life: MW.rand(10, 18), dead: 0, bite: 0, wander: Math.random() * 6 };
  }
  function updateSnakes(dt, t) {
    const hero = S.hero;
    for (const s of S.snakes) {
      if (s.dead > 0) {
        s.dead -= dt;
        if (s.dead <= 0) {
          s.x = hero.x + MW.rand(-1.5, 1.5); s.z = hero.z + MW.rand(-1.5, 1.5);
          s.trail = []; s.life = MW.rand(10, 18);
          s.segs.forEach((m) => { m.visible = true; m.position.set(s.x, 0.3, s.z); });
          H.beam({ x: s.x, z: s.z }, S.colors.main, 0.5);
        }
        continue;
      }
      let e = nearestEnemy(s.x, s.z, 6);
      if (e && Math.hypot(e.x - hero.x, e.z - hero.z) > 7) e = null; // 不离主角太远
      let tx, tz;
      if (e) { tx = e.x; tz = e.z; }
      else { s.wander += dt * 0.8; tx = hero.x + Math.cos(s.wander + s.off) * 3.2; tz = hero.z + Math.sin(s.wander + s.off) * 3.2; }
      const want = Math.atan2(tz - s.z, tx - s.x);
      s.ang = K.lerpAngle(s.ang, want, Math.min(1, dt * 5));
      const sp = e ? 7.5 : 5.5;
      s.x += Math.cos(s.ang) * sp * dt;
      s.z += Math.sin(s.ang) * sp * dt;
      const d = Math.hypot(s.x, s.z), lim = S.R - 0.5;
      if (d > lim) { s.x *= lim / d; s.z *= lim / d; }
      s.trail.unshift({ x: s.x, z: s.z });
      if (s.trail.length > 30) s.trail.pop();
      for (let k = 0; k < s.segs.length; k++) {
        const p = s.trail[Math.min(s.trail.length - 1, k * 3)];
        s.segs[k].position.set(p.x, 0.3 + Math.sin(t * 10 + k * 0.7) * 0.06, p.z);
      }
      s.bite -= dt;
      if (e && s.bite <= 0 && Math.hypot(e.x - s.x, e.z - s.z) < e.r + 0.5) {
        s.bite = 0.7;
        hitEnemy(e, 0.35 * Math.sqrt(S.eq.damage), Math.cos(s.ang) * 0.5, Math.sin(s.ang) * 0.5, false);
        MW.sfx('eat');
      }
      s.life -= dt;
      if (s.life <= 0) {
        s.dead = 1.6;
        H.burst({ x: s.x, y: 0.2, z: s.z }, S.colors.main, 8, 3);
        s.segs.forEach((m) => { m.visible = false; });
      }
    }
  }

  function hurtHero(dmg) {
    const real = dmg / (1 + S.eq.shield);
    S.hp -= real;
    S.invuln = 0.6;
    MW.sfx('hurt');
    MW.ui.hurt();
    H.floatText(S.hero.obj.position, '-' + Math.round(real), '#ff5470', 0.7);
    if (S.hp <= 0) heroDown();
  }
  function heroDown() {
    S.hp = 0;
    S.downed = true;
    H.burst({ x: S.hero.x, y: 0.5, z: S.hero.z }, S.colors.accent, 30, 6);
    MW.sfx('die');
    setTimeout(() => {
      if (!S || !S.running) return;
      MW.eco.fail({
        title: '💥 你被打倒了！',
        msg: `打到了第 <b>${S.wave}</b> 波，消灭了 <b>${S.kills}</b> 个敌人。`,
        verb: '复活',
        onContinue: revive,
        onQuit: () => MW.app.quitPlay(),
      });
    }, 800);
  }
  function revive() {
    if (!S) return;
    S.downed = false;
    S.hp = S.maxHp;
    S.invuln = 2.5;
    S.hero.obj.visible = true;
    H.beam({ x: S.hero.x, z: S.hero.z }, S.colors.accent, 0.9);
    H.ring({ x: S.hero.x, y: 0, z: S.hero.z }, S.colors.accent, 7, 0.6);
    for (const e of S.enemies) {
      const dx = e.x - S.hero.x, dz = e.z - S.hero.z, d = Math.hypot(dx, dz) || 1;
      if (d < 6) { e.knock = 0.35; e.kx = (dx / d) * 14; e.kz = (dz / d) * 14; }
    }
    MW.toast('复活成功！继续冲！');
  }
  function victory() {
    S.won = true;
    const coins = 40 + S.kills * 2;
    MW.eco.addCoins(coins);
    MW.eco.addRevive(1);
    const best = MW.save.best[S.spec.id] || {};
    best.wins = (best.wins || 0) + 1;
    MW.save.best[S.spec.id] = best;
    MW.persist();
    MW.sfx('win');
    for (let i = 0; i < 5; i++) setTimeout(() => S && H.burst({ x: S.hero.x + MW.rand(-3, 3), y: 2, z: S.hero.z + MW.rand(-3, 3) }, MW.pick([S.colors.main, S.colors.second, S.colors.accent]), 20, 6), i * 180);
    MW.say('太厉害了，你赢了！');
    MW.game.paused = true;
    const reward = (S.spec.rewards && S.spec.rewards[0]) || '勇者徽章';
    MW.ui.dialog({
      title: '🏆 你赢啦！',
      html: `<p>打败了全部 <b>${S.totalWaves}</b> 波敌人，一共消灭 <b>${S.kills}</b> 个！</p><div class="rewards"><span>🪙 +${coins}</span><span>💎 复活石 +1</span><span>🏅 ${MW.esc(reward)}</span></div>`,
      buttons: [
        { label: '再玩一次', kind: 'primary', onClick: () => MW.app.restartPlay() },
        { label: '回到图稿改一改', onClick: () => MW.app.quitPlay() },
      ],
    });
  }

  function hud(force, dt = 0) {
    S.hudT -= dt;
    if (!force && S.hudT > 0) return;
    S.hudT = 0.1;
    const pct = Math.max(0, (S.hp / S.maxHp) * 100);
    const info = `<div class="hud-title">⚔️ ${MW.esc(S.spec.name)}</div>` +
      `<div class="hpbar"><i style="width:${pct.toFixed(0)}%"></i><b>${Math.ceil(S.hp)} / ${S.maxHp}</b></div>` +
      `<div class="hud-row"><span>第 <b>${Math.max(1, S.wave)}</b> / ${S.totalWaves} 波</span><span>消灭 <b>${S.kills}</b></span><span>敌人 <b>${S.enemies.length}</b></span></div>`;
    const boss = S.enemies.find((e) => e.boss);
    const side = boss ? `<div class="board"><h4>大 BOSS</h4><div><span>${MW.esc(boss.def.name)}</span><span>${Math.max(0, Math.ceil((boss.hp / boss.maxHp) * 100))}%</span></div></div>` :
      S.snakes.length ? `<div class="board"><h4>全息蛇小队</h4><div><span>正在帮你咬怪</span><span>${S.snakes.filter((s) => s.dead <= 0).length} 条</span></div></div>` : '';
    MW.ui.hud(info, side, '');
  }
})();
