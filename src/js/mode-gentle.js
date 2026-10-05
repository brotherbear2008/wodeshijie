/* 我的世界 · 温柔空间：没有敌人、不会死，摸摸小动物、收集星星、听音乐盒 */
(function () {
  'use strict';
  const MW = window.MW;
  const H = MW.holo, M = MW.models, K = MW.models.kit;
  let S = null;
  const MELODY = [523, 659, 784, 880, 784, 659, 587, 523];
  const RAINBOW = ['#ff5470', '#ff9f43', '#ffe45c', '#5dffa8', '#4ff3ff', '#b57bff'];

  function resolveEquip(list) {
    const eq = { speed: 1, magnet: 0, trail: false, jump: 1 };
    for (const it of list) {
      if (it.effect === 'speed') eq.speed *= Math.max(1.1, it.power);
      else if (it.effect === 'magnet') eq.magnet += it.power;
      else if (it.effect === 'trail') eq.trail = true;
      else if (it.effect === 'jump') eq.jump *= Math.max(1.2, it.power);
    }
    return eq;
  }
  function randomSpot(R) {
    const a = Math.random() * Math.PI * 2, d = 2 + Math.sqrt(Math.random()) * (R - 3.5);
    return { x: Math.cos(a) * d, z: Math.sin(a) * d };
  }

  const mode = (MW.modes = MW.modes || {}).gentle = {
    build(ctx) {
      const { spec, colors, group, layout } = ctx;
      S = { ctx, spec, colors, group, R: ctx.R, animals: [], stars: [], parts: [], running: false, love: 0, made: 0, got: 0, t: 0, hudT: 0, trailT: 0, tipT: 0 };
      S.hero = K.actor(spec.hero, colors.accent, colors.main, 1);
      S.hero.obj.add(K.heroRing(colors.accent));
      const tag = H.label(spec.hero.name || '你', colors.accent, { px: 34, size: 0.72, bg: true });
      tag.position.y = 2.6;
      S.hero.obj.add(tag);
      K.place(S.hero, 0, 0);
      group.add(S.hero.obj);
      for (const p of layout.parts) {
        const col = p.type === 'flower' ? MW.pick([colors.second, colors.accent, colors.main, '#ff9ad5'], ctx.rng) : colors.main;
        const g = M.part(p.type, col, colors.accent);
        g.position.set(p.x, 0, p.z);
        g.rotation.y = p.type === 'rainbow' ? Math.atan2(p.x, p.z) + Math.PI / 2 : ctx.rng() * Math.PI * 2;
        group.add(g);
        const item = { type: p.type, x: p.x, z: p.z, obj: g, cd: 0, bloom: 1 };
        if (p.type === 'star') { item.on = true; S.stars.push(item); } else S.parts.push(item);
      }
      // 星星太少的话多放几颗
      while (S.stars.length < 8) {
        const sp = randomSpot(S.R);
        const g = M.part('star', colors.accent, colors.main);
        g.position.set(sp.x, 0, sp.z);
        group.add(g);
        S.stars.push({ type: 'star', x: sp.x, z: sp.z, obj: g, on: true });
      }
      for (const c of layout.chars) {
        const a = K.actor(c, MW.pick([colors.main, colors.second, '#ffc2ea', '#b9f3ff'], ctx.rng), colors.accent, 0.9);
        K.place(a, c.x, c.z);
        a.home = { x: c.x, z: c.z };
        a.tx = c.x; a.tz = c.z; a.wait = Math.random() * 3; a.following = false; a.hop = 0;
        group.add(a.obj);
        S.animals.push(a);
      }
    },

    preview(dt, t) {
      if (!S) return;
      M.animate(S.hero.model, t, 0);
      wander(dt, t, false);
      for (const p of S.parts) M.animatePart(p.obj, t, dt);
      for (const s of S.stars) M.animatePart(s.obj, t, dt);
    },

    start() {
      Object.assign(S.hero, { y: 0, vx: 0, vz: 0, vy: 0, face: 0 });
      K.place(S.hero, 0, 0);
      S.love = 0; S.made = 0; S.got = 0; S.t = 0;
      for (const a of S.animals) { a.following = false; K.place(a, a.home.x, a.home.z); a.tx = a.home.x; a.tz = a.home.z; }
      for (const s of S.stars) { s.on = true; s.obj.visible = true; }
      S.eq = resolveEquip(MW.eco.activeEquip(S.spec));
      H.cam.mode = 'follow';
      H.cam.offset.set(0, 9.5, 11.5);
      H.cam.lerp = 3;
      H.cam.follow.set(0, 0, 0);
      S.running = true;
      hud(true);
      setTimeout(() => S && S.running && MW.toast('走到小动物旁边，按空格（或 💗）摸摸它'), 1600);
    },

    update(dt, t) {
      if (!S || !S.running) return;
      S.t += dt;
      const hero = S.hero, eq = S.eq;
      K.moveHero(hero, dt, t, { speed: eq.speed, jump: eq.jump, R: S.R, gravity: 12 });
      H.cam.follow.set(hero.x, 0, hero.z);
      if (MW.input.take('attack') || MW.input.take('interact')) pet();
      wander(dt, t, true);

      for (const s of S.stars) {
        if (!s.on) continue;
        M.animatePart(s.obj, t, dt);
        const d = Math.hypot(hero.x - s.x, hero.z - s.z);
        if (eq.magnet && d < 3 + eq.magnet * 2.5) {
          const k = Math.min(1, dt * 4);
          s.x += (hero.x - s.x) * k; s.z += (hero.z - s.z) * k;
          s.obj.position.x = s.x; s.obj.position.z = s.z;
        }
        if (d < 1.0 && hero.y < 2.6) {
          s.on = false;
          s.obj.visible = false;
          S.love += 1; S.got += 1;
          MW.sfx('chime');
          H.burst({ x: s.x, y: 0.6, z: s.z }, '#ffe45c', 10, 3);
          if (S.stars.every((x) => !x.on)) allStars();
        }
      }
      for (const p of S.parts) {
        M.animatePart(p.obj, t, dt);
        p.cd -= dt;
        const d = Math.hypot(hero.x - p.x, hero.z - p.z);
        if (p.type === 'flower') {
          const want = d < 3 ? 1.5 : 1;
          if (want > 1 && p.bloom < 1.05) H.spark({ x: p.x, y: 0.6, z: p.z }, '#ffb0e0', 0.8);
          p.bloom += (want - p.bloom) * Math.min(1, dt * 4);
          p.obj.scale.setScalar(p.bloom);
        } else if (p.type === 'jumppad' && d < 0.95 && hero.y < 0.15) {
          hero.vy = 10 * eq.jump;
          MW.sfx('bounce');
          H.ring({ x: p.x, y: 0, z: p.z }, S.colors.accent, 2.4);
        } else if (p.type === 'musicbox' && d < 2.2 && p.cd <= 0) {
          p.cd = 7;
          MELODY.forEach((f, i) => setTimeout(() => {
            if (!S || !S.running) return;
            MW.sfx('note', f);
            H.spark({ x: p.x + MW.rand(-0.4, 0.4), y: 0.9, z: p.z + MW.rand(-0.4, 0.4) }, RAINBOW[i % RAINBOW.length], 1.2);
          }, i * 260));
          H.floatText({ x: p.x, y: 0, z: p.z }, '♪ ♫', '#b9fbff', 0.8);
          S.love += 1;
        } else if ((p.type === 'heart' || p.type === 'coin' || p.type === 'crystal') && d < 1.0 && p.cd <= 0) {
          p.cd = 15;
          p.obj.visible = false;
          setTimeout(() => { if (p.obj) p.obj.visible = true; }, 15000);
          MW.eco.addCoins(2);
          S.love += 1;
          MW.sfx('coin');
        } else if (p.type === 'rainbow' && d < 2.6 && p.cd <= 0) {
          p.cd = 3;
          H.spark({ x: hero.x, y: 1.5, z: hero.z }, MW.pick(RAINBOW), 1);
        }
      }
      if (eq.trail && Math.hypot(hero.vx, hero.vz) > 1) {
        S.trailT -= dt;
        if (S.trailT <= 0) {
          S.trailT = 0.06;
          H.spark({ x: hero.x, y: hero.y, z: hero.z }, RAINBOW[Math.floor(S.t * 10) % RAINBOW.length], 1.3);
        }
      }
      hud(false, dt);
    },

    stop() {
      if (!S) return;
      S.running = false;
      Object.assign(S.hero, { y: 0, vx: 0, vz: 0, vy: 0 });
      K.place(S.hero, 0, 0);
      for (const a of S.animals) { a.following = false; }
      for (const s of S.stars) { s.on = true; s.obj.visible = true; }
      for (const p of S.parts) { p.obj.visible = true; if (p.type === 'flower') { p.bloom = 1; p.obj.scale.setScalar(1); } }
      if (S.love > 0) return `刚才收获了 ${S.love} 点温柔值，交到 ${S.made} 个好朋友 💗`;
      return null;
    },
    onEquip() { if (S && S.running) S.eq = resolveEquip(MW.eco.activeEquip(S.spec)); },
    dispose() { S = null; },
    _debug: () => S,
  };

  function wander(dt, t, playing) {
    const hero = S.hero;
    let slot = 0;
    for (const a of S.animals) {
      let tx = a.tx, tz = a.tz, sp = 1.3;
      if (playing && a.following) {
        const ang = hero.face + Math.PI + (slot++ - 1) * 0.6;
        tx = hero.x + Math.sin(ang) * 2.2;
        tz = hero.z + Math.cos(ang) * 2.2;
        sp = Math.min(5.5, Math.hypot(tx - a.x, tz - a.z) * 2.5);
      } else {
        a.wait -= dt;
        if (a.wait <= 0 && Math.hypot(a.tx - a.x, a.tz - a.z) < 0.3) {
          const sp2 = randomSpot(S.R);
          a.tx = MW.lerp(a.home.x, sp2.x, 0.4); a.tz = MW.lerp(a.home.z, sp2.z, 0.4);
          a.wait = MW.rand(1.5, 4);
        }
      }
      const dx = tx - a.x, dz = tz - a.z, d = Math.hypot(dx, dz);
      let moving = 0;
      if (d > 0.2) {
        const step = Math.min(d, sp * dt);
        a.x += (dx / d) * step; a.z += (dz / d) * step;
        a.face = Math.atan2(dx, dz);
        moving = Math.min(1, sp / 3);
      }
      a.hop = Math.max(0, a.hop - dt);
      a.obj.position.set(a.x, a.hop > 0 ? Math.sin((a.hop / 0.5) * Math.PI) * 0.8 : 0, a.z);
      a.obj.rotation.y = K.lerpAngle(a.obj.rotation.y, a.face, Math.min(1, dt * 6));
      M.animate(a.model, t + a.phase, moving);
    }
  }
  function pet() {
    let best = null, bd = 2.8;
    for (const a of S.animals) {
      const d = Math.hypot(a.x - S.hero.x, a.z - S.hero.z);
      if (d < bd) { bd = d; best = a; }
    }
    if (!best) {
      if (S.t - S.tipT > 3) { S.tipT = S.t; MW.toast('走近一点小动物再摸摸它吧～'); }
      return;
    }
    best.hop = 0.5;
    MW.sfx('heart');
    H.floatText(best.obj.position, '💗', '#ff7ad9', 1);
    H.burst({ x: best.x, y: 1, z: best.z }, '#ff7ad9', 10, 3);
    S.love += 3;
    if (!best.following) {
      best.following = true;
      S.made += 1;
      MW.toast(`${best.def.name} 成为你的好朋友啦！`, 'gold');
      if (S.made === S.animals.length) {
        MW.eco.addCoins(30);
        MW.sfx('win');
        MW.say('所有小动物都是你的好朋友啦！');
        MW.toast('所有小动物都成了你的好朋友！🪙 +30', 'gold');
      }
    }
  }
  function allStars() {
    MW.eco.addCoins(20);
    MW.sfx('win');
    MW.toast('收集完所有星星！🪙 +20，新的星星马上出现', 'gold');
    setTimeout(() => {
      if (!S || !S.running) return;
      for (const s of S.stars) {
        const sp = randomSpot(S.R);
        s.x = sp.x; s.z = sp.z;
        s.obj.position.set(sp.x, 0, sp.z);
        s.on = true;
        s.obj.visible = true;
        H.spark({ x: sp.x, y: 0.8, z: sp.z }, '#ffe45c', 1);
      }
    }, 1500);
  }
  function hud(force, dt = 0) {
    S.hudT -= dt;
    if (!force && S.hudT > 0) return;
    S.hudT = 0.15;
    const left = S.stars.filter((s) => s.on).length;
    const info = `<div class="hud-title">🌸 ${MW.esc(S.spec.name)}</div>` +
      `<div class="hud-row"><span>温柔值 <b>${S.love}</b> 💗</span><span>好朋友 <b>${S.made}</b>/${S.animals.length}</span><span>星星还剩 <b>${left}</b></span></div>`;
    let near = null;
    for (const a of S.animals) if (!a.following && Math.hypot(a.x - S.hero.x, a.z - S.hero.z) < 2.8) { near = a; break; }
    const center = near ? `<p class="keys">按空格（或 💗）摸摸「${MW.esc(near.def.name)}」</p>` : '';
    MW.ui.hud(info, '', center);
  }
})();
