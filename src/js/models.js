/* 我的世界 · models：全息人物、小零件、场景装饰（全部用几何体拼出来） */
(function () {
  'use strict';
  const MW = window.MW;
  const H = MW.holo;
  const M = (MW.models = {});

  const box = (w, h, d) => H.geo('box', w, h, d);
  const sph = (r, ws = 14, hs = 10) => H.geo('sphere', r, ws, hs);
  const cone = (r, h, s = 10) => H.geo('cone', r, h, s);
  const cyl = (rt, rb, h, s = 12) => H.geo('cyl', rt, rb, h, s);
  const tor = (R, r, rs = 8, ts = 24, arc) => H.geo('torus', R, r, rs, ts, arc);
  const grp = () => new THREE.Group();

  // P：往组里放一个零件。env=发光环境材质，edge=加描边，s=缩放，r=旋转
  function P(g, geo, color, x = 0, y = 0, z = 0, o = {}) {
    const m = new THREE.Mesh(geo, o.env ? H.mat(color, o.op || 1) : H.body(color, o.op || 1));
    m.position.set(x, y, z);
    if (o.r) m.rotation.set(o.r[0] || 0, o.r[1] || 0, o.r[2] || 0);
    if (o.s !== undefined) { if (Array.isArray(o.s)) m.scale.set(o.s[0], o.s[1], o.s[2]); else m.scale.setScalar(o.s); }
    if (o.edge) m.add(new THREE.LineSegments(H.edgeGeo(geo), H.lineMat(o.ec || color)));
    g.add(m);
    return m;
  }
  M.P = P;
  // 四肢：绕关节摆动
  function limb(g, geo, color, x, y, z, off, o = {}) {
    const p = new THREE.Group();
    p.position.set(x, y, z);
    g.add(p);
    P(p, geo, color, 0, off, 0, o);
    return p;
  }
  function done(g, an) { g.userData.anim = Object.assign({ phase: Math.random() * 10 }, an); return g; }

  // 通用小人（忍者、骑士、仙女、僵尸）
  function human(g, c, a, o = {}) {
    const an = { legs: [], arms: [] };
    const skin = o.skin || c;
    an.legs.push(limb(g, cyl(0.1, 0.09, 0.62, 8), c, -0.16, 0.62, 0, -0.31));
    an.legs.push(limb(g, cyl(0.1, 0.09, 0.62, 8), c, 0.16, 0.62, 0, -0.31));
    P(g, cyl(0.3, 0.36, 0.72, 10), c, 0, 0.98, 0, { edge: true });
    P(g, sph(0.3, 14, 10), skin, 0, 1.62, 0);
    an.arms.push(limb(g, cyl(0.08, 0.07, 0.6, 8), c, -0.42, 1.28, 0, -0.28));
    an.arms.push(limb(g, cyl(0.08, 0.07, 0.6, 8), c, 0.42, 1.28, 0, -0.28));
    return an;
  }

  const C = {};
  C.robot = (c, a) => {
    const g = grp(), an = { legs: [], arms: [] };
    P(g, box(0.9, 0.8, 0.6), c, 0, 1.0, 0, { edge: true });
    P(g, box(0.72, 0.56, 0.56), c, 0, 1.72, 0, { edge: true });
    P(g, box(0.52, 0.14, 0.04), a, 0, 1.76, 0.29);
    P(g, box(0.36, 0.1, 0.04), a, 0, 1.05, 0.31);
    P(g, cyl(0.03, 0.03, 0.32, 6), c, 0, 2.15, 0);
    P(g, sph(0.09, 8, 6), a, 0, 2.34, 0);
    an.arms.push(limb(g, box(0.2, 0.66, 0.22), c, -0.6, 1.36, 0, -0.3, { edge: true }));
    an.arms.push(limb(g, box(0.2, 0.66, 0.22), c, 0.6, 1.36, 0, -0.3, { edge: true }));
    an.legs.push(limb(g, box(0.26, 0.6, 0.28), c, -0.22, 0.6, 0, -0.3, { edge: true }));
    an.legs.push(limb(g, box(0.26, 0.6, 0.28), c, 0.22, 0.6, 0, -0.3, { edge: true }));
    return done(g, an);
  };
  C.cat = (c, a) => {
    const g = grp(), an = { legs: [] };
    P(g, sph(0.42), c, 0, 0.66, -0.05, { s: [1, 0.85, 1.25] });
    P(g, sph(0.36), c, 0, 1.14, 0.34);
    P(g, cone(0.13, 0.28, 4), c, -0.2, 1.46, 0.32, { r: [0, 0, 0.25], edge: true });
    P(g, cone(0.13, 0.28, 4), c, 0.2, 1.46, 0.32, { r: [0, 0, -0.25], edge: true });
    P(g, sph(0.065, 8, 6), a, -0.13, 1.18, 0.66);
    P(g, sph(0.065, 8, 6), a, 0.13, 1.18, 0.66);
    P(g, sph(0.04, 6, 4), a, 0, 1.07, 0.7);
    const tail = grp(); tail.position.set(0, 0.8, -0.55); g.add(tail);
    P(tail, cyl(0.05, 0.07, 0.8, 6), c, 0, 0.32, -0.12, { r: [-0.45, 0, 0] });
    an.tail = tail;
    for (const [x, z] of [[-0.2, 0.25], [0.2, 0.25], [-0.2, -0.32], [0.2, -0.32]]) an.legs.push(limb(g, cyl(0.07, 0.07, 0.4, 6), c, x, 0.4, z, -0.2));
    return done(g, an);
  };
  C.dog = (c, a) => {
    const g = grp(), an = { legs: [] };
    P(g, sph(0.44), c, 0, 0.68, -0.05, { s: [0.95, 0.85, 1.3] });
    P(g, sph(0.36), c, 0, 1.15, 0.36);
    P(g, box(0.24, 0.2, 0.26), c, 0, 1.05, 0.68, { edge: true });
    P(g, sph(0.06, 8, 6), a, 0, 1.12, 0.82);
    P(g, box(0.12, 0.34, 0.2), c, -0.32, 1.12, 0.32, { r: [0, 0, 0.35], edge: true });
    P(g, box(0.12, 0.34, 0.2), c, 0.32, 1.12, 0.32, { r: [0, 0, -0.35], edge: true });
    P(g, sph(0.06, 8, 6), a, -0.13, 1.25, 0.66);
    P(g, sph(0.06, 8, 6), a, 0.13, 1.25, 0.66);
    const tail = grp(); tail.position.set(0, 0.85, -0.6); g.add(tail);
    P(tail, cyl(0.05, 0.07, 0.5, 6), c, 0, 0.22, 0, { r: [-0.3, 0, 0] });
    an.tail = tail;
    for (const [x, z] of [[-0.2, 0.28], [0.2, 0.28], [-0.2, -0.34], [0.2, -0.34]]) an.legs.push(limb(g, cyl(0.08, 0.08, 0.42, 6), c, x, 0.42, z, -0.21));
    return done(g, an);
  };
  C.rabbit = (c, a) => {
    const g = grp(), an = { legs: [] };
    P(g, sph(0.42), c, 0, 0.6, 0, { s: [1, 1.05, 1] });
    P(g, sph(0.34), c, 0, 1.18, 0.12);
    P(g, sph(0.11, 8, 6), c, -0.13, 1.72, 0.05, { s: [0.7, 2.6, 0.5], r: [0, 0, 0.12] });
    P(g, sph(0.11, 8, 6), c, 0.13, 1.72, 0.05, { s: [0.7, 2.6, 0.5], r: [0, 0, -0.12] });
    P(g, sph(0.06, 8, 6), a, -0.12, 1.22, 0.42);
    P(g, sph(0.06, 8, 6), a, 0.12, 1.22, 0.42);
    P(g, sph(0.05, 6, 4), a, 0, 1.1, 0.46);
    P(g, sph(0.14, 8, 6), '#ffffff', 0, 0.55, -0.42);
    an.legs.push(limb(g, sph(0.13, 8, 6), c, -0.2, 0.16, 0.18, 0, { s: [1, 0.7, 1.5] }));
    an.legs.push(limb(g, sph(0.13, 8, 6), c, 0.2, 0.16, 0.18, 0, { s: [1, 0.7, 1.5] }));
    an.hop = true;
    return done(g, an);
  };
  C.bear = (c, a) => {
    const g = grp(), an = { legs: [], arms: [] };
    P(g, sph(0.55), c, 0, 0.85, 0, { s: [1, 1.08, 0.9] });
    P(g, sph(0.42), c, 0, 1.68, 0.06);
    P(g, sph(0.14, 8, 6), c, -0.32, 2.0, 0);
    P(g, sph(0.14, 8, 6), c, 0.32, 2.0, 0);
    P(g, sph(0.16, 10, 8), a, 0, 1.58, 0.4, { op: 0.9 });
    P(g, sph(0.07, 8, 6), a, -0.15, 1.78, 0.38);
    P(g, sph(0.07, 8, 6), a, 0.15, 1.78, 0.38);
    P(g, sph(0.3, 10, 8), a, 0, 0.85, 0.36, { s: [1, 1.2, 0.4], op: 0.6 });
    an.arms.push(limb(g, cyl(0.13, 0.12, 0.55, 8), c, -0.58, 1.18, 0, -0.25));
    an.arms.push(limb(g, cyl(0.13, 0.12, 0.55, 8), c, 0.58, 1.18, 0, -0.25));
    an.legs.push(limb(g, cyl(0.15, 0.15, 0.4, 8), c, -0.25, 0.4, 0, -0.2));
    an.legs.push(limb(g, cyl(0.15, 0.15, 0.4, 8), c, 0.25, 0.4, 0, -0.2));
    return done(g, an);
  };
  C.dino = (c, a) => {
    const g = grp(), an = { legs: [], arms: [] };
    P(g, sph(0.55), c, 0, 1.0, -0.1, { s: [0.85, 0.85, 1.35] });
    P(g, cyl(0.2, 0.28, 0.7, 8), c, 0, 1.55, 0.45, { r: [0.5, 0, 0] });
    P(g, box(0.46, 0.4, 0.66), c, 0, 1.95, 0.72, { edge: true });
    P(g, box(0.4, 0.08, 0.4), a, 0, 1.78, 0.9);
    P(g, sph(0.06, 8, 6), a, -0.17, 2.06, 0.9);
    P(g, sph(0.06, 8, 6), a, 0.17, 2.06, 0.9);
    const tail = grp(); tail.position.set(0, 0.95, -0.75); g.add(tail);
    P(tail, cone(0.3, 1.3, 8), c, 0, 0, -0.55, { r: [-Math.PI / 2, 0, 0], edge: true });
    an.tail = tail;
    for (let i = 0; i < 5; i++) P(g, cone(0.1, 0.28, 4), a, 0, 1.5 - i * 0.05, 0.35 - i * 0.28, { edge: true });
    an.legs.push(limb(g, cyl(0.15, 0.12, 0.6, 8), c, -0.28, 0.6, -0.15, -0.3));
    an.legs.push(limb(g, cyl(0.15, 0.12, 0.6, 8), c, 0.28, 0.6, -0.15, -0.3));
    an.arms.push(limb(g, cyl(0.05, 0.05, 0.3, 6), c, -0.25, 1.2, 0.45, -0.14, { r: [0.8, 0, 0] }));
    an.arms.push(limb(g, cyl(0.05, 0.05, 0.3, 6), c, 0.25, 1.2, 0.45, -0.14, { r: [0.8, 0, 0] }));
    return done(g, an);
  };
  C.dragon = (c, a) => {
    const g = grp(), an = { legs: [], wings: [] };
    P(g, sph(0.5), c, 0, 1.15, -0.05, { s: [0.8, 0.8, 1.3] });
    P(g, cyl(0.17, 0.24, 0.7, 8), c, 0, 1.65, 0.45, { r: [0.55, 0, 0] });
    P(g, box(0.42, 0.36, 0.6), c, 0, 2.02, 0.75, { edge: true });
    P(g, cone(0.07, 0.36, 5), a, -0.14, 2.32, 0.6, { r: [-0.5, 0, 0.2] });
    P(g, cone(0.07, 0.36, 5), a, 0.14, 2.32, 0.6, { r: [-0.5, 0, -0.2] });
    P(g, sph(0.06, 8, 6), a, -0.15, 2.1, 1.02);
    P(g, sph(0.06, 8, 6), a, 0.15, 2.1, 1.02);
    for (const s of [-1, 1]) {
      const w = grp(); w.position.set(s * 0.35, 1.4, -0.05); g.add(w);
      P(w, box(1.2, 0.05, 0.75), a, s * 0.62, 0, 0, { env: true, edge: true, r: [0, 0, 0] });
      an.wings.push(w);
    }
    const tail = grp(); tail.position.set(0, 1.05, -0.65); g.add(tail);
    P(tail, cone(0.24, 1.3, 8), c, 0, 0, -0.55, { r: [-Math.PI / 2, 0, 0], edge: true });
    an.tail = tail;
    an.legs.push(limb(g, cyl(0.12, 0.1, 0.55, 8), c, -0.25, 0.7, -0.1, -0.28));
    an.legs.push(limb(g, cyl(0.12, 0.1, 0.55, 8), c, 0.25, 0.7, -0.1, -0.28));
    an.flap = 7;
    return done(g, an);
  };
  C.ghost = (c, a) => {
    const g = grp(), an = { arms: [] };
    P(g, sph(0.52, 16, 10), c, 0, 1.3, 0, { op: 0.85 });
    P(g, H.geo('cyl', 0.52, 0.66, 0.8, 14, true), c, 0, 0.9, 0, { op: 0.7 });
    P(g, sph(0.1, 8, 6), a, -0.18, 1.38, 0.45, { s: [1, 1.4, 0.6] });
    P(g, sph(0.1, 8, 6), a, 0.18, 1.38, 0.45, { s: [1, 1.4, 0.6] });
    P(g, sph(0.08, 8, 6), a, 0, 1.12, 0.48, { s: [1.4, 0.8, 0.5] });
    an.arms.push(limb(g, sph(0.13, 8, 6), c, -0.6, 1.15, 0.1, 0, { op: 0.8 }));
    an.arms.push(limb(g, sph(0.13, 8, 6), c, 0.6, 1.15, 0.1, 0, { op: 0.8 }));
    an.float = true;
    return done(g, an);
  };
  C.ninja = (c, a) => {
    const g = grp();
    const an = human(g, c, a);
    P(g, tor(0.31, 0.05, 6, 20), a, 0, 1.7, 0, { r: [Math.PI / 2, 0, 0] });
    P(g, box(0.4, 0.09, 0.05), a, 0, 1.64, 0.28);
    P(g, box(0.07, 1.0, 0.07), a, 0.1, 1.15, -0.34, { r: [0, 0, 0.6], edge: true });
    return done(g, an);
  };
  C.knight = (c, a) => {
    const g = grp();
    const an = human(g, c, a);
    P(g, cyl(0.33, 0.33, 0.42, 12), c, 0, 1.68, 0, { edge: true });
    P(g, box(0.4, 0.06, 0.05), a, 0, 1.68, 0.33);
    P(g, cone(0.1, 0.4, 6), a, 0, 2.08, -0.05, { r: [-0.4, 0, 0] });
    P(an.arms[0], cyl(0.3, 0.3, 0.06, 14), a, -0.1, -0.35, 0.12, { r: [Math.PI / 2, 0, 0.1], edge: true });
    P(an.arms[1], box(0.07, 0.85, 0.07), '#e8f8ff', 0.05, -0.75, 0.2, { r: [0.6, 0, 0], edge: true });
    return done(g, an);
  };
  C.fairy = (c, a) => {
    const g = grp(), an = { arms: [], wings: [] };
    P(g, cone(0.5, 0.95, 12), c, 0, 0.62, 0, { edge: true });
    P(g, cyl(0.17, 0.22, 0.4, 10), c, 0, 1.25, 0);
    P(g, sph(0.27, 14, 10), c, 0, 1.68, 0);
    P(g, sph(0.3, 12, 8), a, 0, 1.75, -0.08, { s: [1, 1, 0.9], op: 0.75 });
    P(g, sph(0.05, 6, 4), a, -0.1, 1.7, 0.25);
    P(g, sph(0.05, 6, 4), a, 0.1, 1.7, 0.25);
    for (const s of [-1, 1]) {
      const w = grp(); w.position.set(s * 0.12, 1.3, -0.18); g.add(w);
      P(w, sph(0.4, 12, 8), a, s * 0.35, 0.1, 0, { env: true, s: [0.9, 1.3, 0.08] });
      an.wings.push(w);
    }
    an.arms.push(limb(g, cyl(0.06, 0.05, 0.5, 6), c, -0.27, 1.38, 0, -0.24));
    const ra = limb(g, cyl(0.06, 0.05, 0.5, 6), c, 0.27, 1.38, 0, -0.24);
    P(ra, cyl(0.02, 0.02, 0.5, 5), '#ffffff', 0, -0.6, 0.1);
    P(ra, H.geo('star'), a, 0, -0.9, 0.1, { s: 0.12 });
    an.arms.push(ra);
    an.flap = 10;
    an.float = true;
    return done(g, an);
  };
  C.alien = (c, a) => {
    const g = grp(), an = { legs: [], arms: [] };
    P(g, sph(0.48, 16, 12), c, 0, 1.55, 0, { s: [1, 1.15, 1] });
    P(g, sph(0.15, 10, 8), a, -0.18, 1.6, 0.38, { s: [1, 1.4, 0.5], r: [0, 0, 0.4] });
    P(g, sph(0.15, 10, 8), a, 0.18, 1.6, 0.38, { s: [1, 1.4, 0.5], r: [0, 0, -0.4] });
    for (const s of [-1, 1]) {
      P(g, cyl(0.025, 0.025, 0.45, 5), c, s * 0.2, 2.15, 0, { r: [0, 0, -s * 0.35] });
      P(g, sph(0.07, 8, 6), a, s * 0.28, 2.37, 0);
    }
    P(g, cone(0.3, 0.75, 10), c, 0, 0.82, 0, { r: [Math.PI, 0, 0] });
    an.arms.push(limb(g, cyl(0.05, 0.05, 0.5, 6), c, -0.3, 1.0, 0, -0.22));
    an.arms.push(limb(g, cyl(0.05, 0.05, 0.5, 6), c, 0.3, 1.0, 0, -0.22));
    an.legs.push(limb(g, cyl(0.06, 0.06, 0.48, 6), c, -0.13, 0.48, 0, -0.24));
    an.legs.push(limb(g, cyl(0.06, 0.06, 0.48, 6), c, 0.13, 0.48, 0, -0.24));
    return done(g, an);
  };
  C.slime = (c, a) => {
    const g = grp();
    P(g, sph(0.62, 16, 12), c, 0, 0.47, 0, { s: [1, 0.76, 1] });
    P(g, sph(0.09, 8, 6), a, -0.2, 0.62, 0.48, { s: [1, 1.3, 0.6] });
    P(g, sph(0.09, 8, 6), a, 0.2, 0.62, 0.48, { s: [1, 1.3, 0.6] });
    P(g, sph(0.2, 10, 8), '#ffffff', -0.22, 0.75, 0.25, { env: true, op: 0.5 });
    return done(g, { squash: true });
  };
  C.monster = (c, a) => {
    const g = grp(), an = { legs: [], arms: [] };
    P(g, sph(0.75, 16, 12), c, 0, 1.15, 0);
    P(g, cone(0.14, 0.5, 6), a, -0.38, 1.92, 0, { r: [0, 0, 0.4], edge: true });
    P(g, cone(0.14, 0.5, 6), a, 0.38, 1.92, 0, { r: [0, 0, -0.4], edge: true });
    P(g, sph(0.15, 10, 8), a, -0.25, 1.35, 0.62);
    P(g, sph(0.15, 10, 8), a, 0.25, 1.35, 0.62);
    P(g, box(0.55, 0.12, 0.1), a, 0, 0.98, 0.7);
    for (let i = 0; i < 4; i++) P(g, cone(0.05, 0.12, 4), '#ffffff', -0.2 + i * 0.13, 0.9, 0.73, { r: [Math.PI, 0, 0] });
    an.arms.push(limb(g, sph(0.24, 10, 8), c, -0.85, 1.15, 0, -0.1, { s: [1, 1.4, 1] }));
    an.arms.push(limb(g, sph(0.24, 10, 8), c, 0.85, 1.15, 0, -0.1, { s: [1, 1.4, 1] }));
    an.legs.push(limb(g, cyl(0.2, 0.22, 0.45, 8), c, -0.35, 0.45, 0, -0.22));
    an.legs.push(limb(g, cyl(0.2, 0.22, 0.45, 8), c, 0.35, 0.45, 0, -0.22));
    return done(g, an);
  };
  C.bird = (c, a) => {
    const g = grp(), an = { wings: [], legs: [] };
    P(g, sph(0.4, 14, 10), c, 0, 0.85, 0, { s: [0.9, 0.95, 1.15] });
    P(g, sph(0.27, 12, 10), c, 0, 1.28, 0.25);
    P(g, cone(0.08, 0.26, 6), '#ffb35c', 0, 1.24, 0.6, { r: [Math.PI / 2, 0, 0] });
    P(g, sph(0.05, 6, 4), a, -0.12, 1.36, 0.47);
    P(g, sph(0.05, 6, 4), a, 0.12, 1.36, 0.47);
    for (const s of [-1, 1]) {
      const w = grp(); w.position.set(s * 0.32, 0.95, 0); g.add(w);
      P(w, box(0.55, 0.06, 0.4), c, s * 0.27, 0, 0, { edge: true });
      an.wings.push(w);
    }
    P(g, box(0.3, 0.05, 0.4), a, 0, 0.9, -0.5, { r: [0.4, 0, 0] });
    an.legs.push(limb(g, cyl(0.025, 0.025, 0.4, 4), '#ffb35c', -0.12, 0.45, 0, -0.2));
    an.legs.push(limb(g, cyl(0.025, 0.025, 0.4, 4), '#ffb35c', 0.12, 0.45, 0, -0.2));
    an.flap = 14;
    return done(g, an);
  };
  C.fish = (c, a) => {
    const g = grp(), an = {};
    P(g, sph(0.45, 14, 10), c, 0, 0, 0, { s: [0.65, 0.85, 1.3] });
    const tail = grp(); tail.position.set(0, 0, -0.55); g.add(tail);
    P(tail, cone(0.35, 0.55, 4), a, 0, 0, -0.2, { r: [-Math.PI / 2, 0, 0], s: [0.25, 1, 1], edge: true });
    an.tail = tail;
    P(g, cone(0.18, 0.4, 4), a, 0, 0.42, -0.05, { s: [0.2, 1, 1] });
    P(g, sph(0.07, 8, 6), '#ffffff', -0.22, 0.12, 0.38);
    P(g, sph(0.07, 8, 6), '#ffffff', 0.22, 0.12, 0.38);
    an.float = true;
    an.baseY = 0.6;
    return done(g, an);
  };
  C.unicorn = (c, a) => {
    const g = grp(), an = { legs: [] };
    P(g, sph(0.5, 14, 10), c, 0, 1.05, 0, { s: [0.75, 0.75, 1.3] });
    P(g, cyl(0.16, 0.22, 0.65, 8), c, 0, 1.55, 0.52, { r: [0.5, 0, 0] });
    P(g, box(0.32, 0.34, 0.6), c, 0, 1.88, 0.8, { edge: true, r: [0.3, 0, 0] });
    P(g, cone(0.07, 0.55, 8), '#ffe45c', 0, 2.25, 0.78, { r: [0.35, 0, 0], edge: true });
    P(g, sph(0.05, 6, 4), a, -0.15, 1.95, 0.92);
    P(g, sph(0.05, 6, 4), a, 0.15, 1.95, 0.92);
    for (let i = 0; i < 5; i++) P(g, sph(0.1, 8, 6), ['#ff7ad9', '#ffe45c', '#5dffa8', '#4ff3ff', '#b57bff'][i], 0, 2.0 - i * 0.16, 0.6 - i * 0.12);
    const tail = grp(); tail.position.set(0, 1.15, -0.62); g.add(tail);
    P(tail, cone(0.14, 0.7, 8), a, 0, -0.25, -0.15, { r: [-2.5, 0, 0] });
    an.tail = tail;
    for (const [x, z] of [[-0.2, 0.42], [0.2, 0.42], [-0.2, -0.42], [0.2, -0.42]]) an.legs.push(limb(g, cyl(0.07, 0.06, 0.7, 6), c, x, 0.7, z, -0.35));
    return done(g, an);
  };
  C.zombie = (c, a) => {
    const g = grp();
    const an = human(g, c, a);
    an.arms.forEach((arm) => { arm.rotation.x = -1.4; });
    an.armsFixed = true;
    P(g, box(0.18, 0.05, 0.05), a, -0.1, 1.68, 0.28);
    P(g, box(0.1, 0.05, 0.05), a, 0.12, 1.62, 0.28);
    an.slow = true;
    return done(g, an);
  };

  M.SHAPES = Object.keys(C);
  M.character = (shape, color, accent) => {
    const fn = C[shape] || C.robot;
    const g = fn(color, accent || '#ffffff');
    g.userData.baseScale = 1;
    return g;
  };

  // 让人物动起来：走路摆腿、扇翅膀、上下飘
  M.animate = (model, t, move = 0) => {
    const a = model.userData.anim;
    if (!a) return;
    const ph = t * (a.slow ? 6 : 10) + a.phase;
    const sw = Math.sin(ph) * 0.7 * move;
    if (a.legs) for (let i = 0; i < a.legs.length; i++) a.legs[i].rotation.x = (i % 2 ? sw : -sw) * (a.legs.length > 2 && i >= 2 ? -1 : 1);
    if (a.arms && !a.armsFixed) for (let i = 0; i < a.arms.length; i++) a.arms[i].rotation.x = i % 2 ? -sw : sw;
    if (a.armsFixed) for (const arm of a.arms) arm.rotation.z = Math.sin(ph * 0.5) * 0.08;
    if (a.wings) for (let i = 0; i < a.wings.length; i++) a.wings[i].rotation.z = (i % 2 ? -1 : 1) * (0.25 + Math.sin(t * (a.flap || 12) + a.phase) * 0.45);
    if (a.tail) a.tail.rotation.y = Math.sin(t * 4 + a.phase) * 0.5;
    const base = a.baseY || 0;
    const bs = model.userData.baseScale || 1;
    if (a.float) model.position.y = base + 0.45 + Math.sin(t * 2 + a.phase) * 0.2;
    else if (a.hop) model.position.y = Math.abs(Math.sin(ph * 0.6)) * (0.06 + move * 0.35);
    else model.position.y = Math.abs(Math.sin(ph)) * 0.06 * (0.3 + move);
    if (a.squash) {
      const s = 1 + Math.sin(t * 6 + a.phase) * (0.06 + move * 0.08);
      model.scale.set(bs / Math.sqrt(s), bs * s, bs / Math.sqrt(s));
    }
  };

  // ---------- 小零件 ----------
  const PT = {};
  PT.tree = (c, a) => {
    const g = grp();
    P(g, cyl(0.12, 0.16, 0.9, 6), '#c9a46a', 0, 0.45, 0, { env: true });
    P(g, cone(0.85, 1.25, 7), c, 0, 1.3, 0, { env: true, edge: true });
    P(g, cone(0.65, 1.0, 7), c, 0, 1.95, 0, { env: true, edge: true });
    P(g, cone(0.42, 0.8, 7), c, 0, 2.5, 0, { env: true, edge: true });
    return g;
  };
  PT.crystal = (c, a) => {
    const g = grp();
    P(g, H.geo('oct', 0.5), a, 0, 1.0, 0, { s: [0.7, 1.6, 0.7], edge: true });
    P(g, H.geo('oct', 0.3), c, 0.45, 0.45, 0.1, { s: [0.7, 1.4, 0.7], r: [0, 0, -0.4], edge: true });
    P(g, H.geo('oct', 0.25), c, -0.4, 0.38, -0.1, { s: [0.7, 1.3, 0.7], r: [0, 0, 0.5], edge: true });
    g.userData.spin = 0.6;
    return g;
  };
  PT.cloud = () => {
    const g = grp();
    [[0, 0, 0, 0.7], [0.62, -0.1, 0.1, 0.5], [-0.62, -0.1, -0.1, 0.55], [0.2, 0.28, -0.2, 0.5], [-0.25, 0.22, 0.25, 0.45]]
      .forEach(([x, y, z, r]) => P(g, sph(r, 12, 8), '#9fd4f5', x, y + 3.4, z, { env: true, op: 0.4 }));
    g.userData.floatY = 0.3;
    return g;
  };
  PT.flower = (c, a) => {
    const g = grp();
    P(g, cyl(0.03, 0.03, 0.6, 5), '#7dff9a', 0, 0.3, 0, { env: true });
    for (let i = 0; i < 5; i++) {
      const an = (i / 5) * Math.PI * 2;
      P(g, sph(0.13, 8, 6), c, Math.cos(an) * 0.17, 0.66, Math.sin(an) * 0.17, { s: [1, 0.5, 1] });
    }
    P(g, sph(0.09, 8, 6), a, 0, 0.68, 0);
    g.userData.bloom = true;
    return g;
  };
  PT.tower = (c, a) => {
    const g = grp();
    P(g, cyl(0.5, 0.65, 3.2, 8), c, 0, 1.6, 0, { env: true, edge: true });
    P(g, cone(0.75, 1.0, 8), a, 0, 3.7, 0, { env: true, edge: true });
    P(g, tor(0.62, 0.04, 6, 24), a, 0, 2.4, 0, { r: [Math.PI / 2, 0, 0], env: true });
    P(g, sph(0.12, 8, 6), a, 0, 4.35, 0);
    return g;
  };
  PT.chest = (c, a) => {
    const g = grp();
    P(g, box(0.9, 0.5, 0.6), c, 0, 0.25, 0, { edge: true });
    const lid = grp(); lid.position.set(0, 0.5, -0.3); g.add(lid);
    P(lid, box(0.92, 0.22, 0.62), c, 0, 0.11, 0.3, { edge: true });
    P(g, box(0.16, 0.18, 0.05), a, 0, 0.45, 0.31);
    g.userData.lid = lid;
    return g;
  };
  PT.coin = () => {
    const g = grp();
    P(g, cyl(0.32, 0.32, 0.08, 18), '#ffd24d', 0, 0.9, 0, { r: [Math.PI / 2, 0, 0], edge: true });
    g.userData.spin = 2.5; g.userData.floatY = 0.15;
    return g;
  };
  PT.heart = () => {
    const g = grp();
    P(g, H.geo('heart'), '#ff5f8f', 0, 0.95, 0, { s: 0.5 });
    g.userData.spin = 1.5; g.userData.floatY = 0.15;
    return g;
  };
  PT.star = () => {
    const g = grp();
    P(g, H.geo('star'), '#ffe45c', 0, 1.0, 0, { s: 0.5 });
    g.userData.spin = 1.8; g.userData.floatY = 0.18;
    return g;
  };
  PT.portal = (c, a) => {
    const g = grp();
    P(g, tor(0.9, 0.1, 8, 32), c, 0, 1.1, 0);
    P(g, H.geo('circle', 0.82), a, 0, 1.1, 0, { env: true, op: 0.55 });
    g.userData.spinZ = true;
    return g;
  };
  PT.rock = (c) => {
    const g = grp();
    P(g, H.geo('dode', 0.6), c, 0, 0.35, 0, { s: [1.2, 0.7, 1], env: true, edge: true });
    return g;
  };
  PT.lamp = (c, a) => {
    const g = grp();
    P(g, cyl(0.05, 0.07, 2.2, 6), c, 0, 1.1, 0, { env: true });
    P(g, sph(0.22, 10, 8), a, 0, 2.3, 0);
    P(g, cone(0.3, 0.2, 8), c, 0, 2.5, 0, { env: true, edge: true });
    return g;
  };
  PT.house = (c, a) => {
    const g = grp();
    P(g, box(1.6, 1.2, 1.4), c, 0, 0.6, 0, { env: true, edge: true });
    P(g, cone(1.25, 0.9, 4), a, 0, 1.65, 0, { r: [0, Math.PI / 4, 0], env: true, edge: true });
    P(g, box(0.35, 0.6, 0.05), a, 0, 0.3, 0.71);
    P(g, box(0.3, 0.3, 0.05), '#ffe45c', 0.45, 0.75, 0.71);
    return g;
  };
  PT.mushroom = (c) => {
    const g = grp();
    P(g, cyl(0.16, 0.2, 0.6, 8), '#f4f8ff', 0, 0.3, 0, { env: true });
    P(g, H.geo('dome', 0.5), c, 0, 0.55, 0);
    for (let i = 0; i < 4; i++) { const an = i * 1.7; P(g, sph(0.07, 6, 4), '#ffffff', Math.cos(an) * 0.3, 0.82, Math.sin(an) * 0.3); }
    return g;
  };
  PT.jumppad = (c, a) => {
    const g = grp();
    P(g, cyl(0.7, 0.8, 0.18, 20), c, 0, 0.09, 0, { edge: true });
    P(g, tor(0.5, 0.04, 6, 24), a, 0, 0.22, 0, { r: [Math.PI / 2, 0, 0], env: true });
    P(g, cone(0.22, 0.35, 4), a, 0, 0.5, 0, { env: true, edge: true });
    return g;
  };
  PT.candy = (c, a) => {
    const g = grp();
    P(g, cyl(0.05, 0.05, 1.6, 6), '#ffffff', 0, 0.8, 0, { env: true });
    P(g, cyl(0.55, 0.55, 0.14, 20), c, 0, 1.8, 0, { r: [Math.PI / 2, 0, 0], edge: true });
    P(g, tor(0.32, 0.06, 6, 20), a, 0, 1.8, 0.08);
    return g;
  };
  PT.rainbow = () => {
    const g = grp();
    ['#ff5470', '#ff9f43', '#ffe45c', '#5dffa8', '#4ff3ff', '#b57bff'].forEach((col, i) => P(g, H.geo('torus', 2.6 - i * 0.18, 0.09, 6, 40, Math.PI), col, 0, 0, 0, { env: true }));
    return g;
  };
  PT.castle = (c, a) => {
    const g = grp();
    P(g, box(2.2, 1.4, 1.6), c, 0, 0.7, 0, { env: true, edge: true });
    for (const [x, z] of [[-1.1, -0.8], [1.1, -0.8], [-1.1, 0.8], [1.1, 0.8]]) {
      P(g, cyl(0.32, 0.36, 2.0, 8), c, x, 1.0, z, { env: true, edge: true });
      P(g, cone(0.42, 0.7, 8), a, x, 2.35, z, { env: true, edge: true });
    }
    P(g, box(0.5, 0.7, 0.05), a, 0, 0.35, 0.81);
    return g;
  };
  PT.musicbox = (c, a) => {
    const g = grp();
    P(g, box(0.7, 0.45, 0.5), c, 0, 0.23, 0, { edge: true });
    const top = grp(); top.position.y = 0.46; g.add(top);
    P(top, cone(0.12, 0.4, 8), a, 0, 0.2, 0);
    P(top, sph(0.08, 8, 6), a, 0, 0.45, 0);
    g.userData.spinner = top;
    return g;
  };
  M.PARTS = Object.keys(PT);
  M.part = (type, c, a) => {
    const g = (PT[type] || PT.crystal)(c, a);
    g.userData.type = type;
    return g;
  };
  // 零件自己的小动画（转圈、飘浮）
  M.animatePart = (g, t, dt) => {
    const u = g.userData;
    if (u.spin) g.rotation.y += u.spin * dt;
    if (u.floatY) g.position.y = (u.baseY || 0) + Math.sin(t * 2 + (u.ph || (u.ph = Math.random() * 6))) * u.floatY;
    if (u.spinZ && g.children[0]) g.children[0].rotation.z += dt * 1.5;
    if (u.spinner) u.spinner.rotation.y += dt * 2;
  };

  // 数学闯关的浮空岛
  M.island = (c, a, deco) => {
    const g = grp();
    P(g, cone(1.7, 2.4, 7), c, 0, -1.25, 0, { r: [Math.PI, 0, 0], env: true, edge: true, op: 0.4 });
    P(g, cyl(1.8, 1.72, 0.32, 18), c, 0, -0.1, 0, { edge: true });
    P(g, tor(1.8, 0.04, 6, 40), a, 0, 0.07, 0, { r: [Math.PI / 2, 0, 0], env: true });
    if (deco) {
      const d = M.part(deco, c, a);
      d.scale.setScalar(deco === 'tree' || deco === 'castle' || deco === 'house' ? 0.55 : 0.75);
      d.position.set(-0.9, 0.06, -0.5);
      g.add(d);
    }
    return g;
  };

  // 首页旋转的全息地球
  M.globe = (colors) => {
    const g = grp();
    g.position.y = 5.4;
    const core = P(g, H.geo('ico', 2.4, 2), colors.main, 0, 0, 0, { env: true, op: 0.6 });
    const shell = new THREE.LineSegments(H.edgeGeo(H.geo('ico', 3.1, 1)), H.lineMat(colors.main, 0.7));
    g.add(shell);
    const rings = [];
    [[colors.second, 0.4, 4.2], [colors.accent, -0.7, 4.8], [colors.main, 1.2, 5.4]].forEach(([col, tilt, r]) => {
      const ring = P(g, tor(r, 0.03, 6, 120), col, 0, 0, 0, { env: true });
      ring.rotation.x = Math.PI / 2 + tilt;
      rings.push(ring);
    });
    const orbit = grp(); g.add(orbit);
    const minis = [M.character('robot', colors.main, colors.accent), M.character('rabbit', colors.second, colors.accent), M.part('star', colors.accent), M.character('slime', colors.accent, colors.main)];
    minis.forEach((m, i) => {
      const a = (i / minis.length) * Math.PI * 2;
      m.scale.setScalar(0.55);
      m.position.set(Math.cos(a) * 5.2, -0.6, Math.sin(a) * 5.2);
      orbit.add(m);
    });
    g.userData.update = (t) => {
      core.rotation.y = t * 0.3;
      shell.rotation.y = -t * 0.15;
      shell.rotation.x = Math.sin(t * 0.2) * 0.2;
      rings.forEach((r, i) => { r.rotation.z = t * (0.2 + i * 0.1); });
      orbit.rotation.y = t * 0.35;
      minis.forEach((m, i) => { m.rotation.y = -t * 0.35 + i; M.animate(m, t + i, 0.6); });
      g.position.y = 5.4 + Math.sin(t * 0.8) * 0.3;
    };
    return g;
  };

  // 场景装饰：围在投影台外面
  M.decorate = (scene, colors, rng) => {
    const g = grp();
    const R = H.R;
    const c = colors.main, s = colors.second, a = colors.accent;
    const ring = (n, r0, r1, fn) => {
      for (let i = 0; i < n; i++) {
        const an = (i / n) * Math.PI * 2 + rng() * 0.5;
        const r = r0 + rng() * (r1 - r0);
        const o = fn(i);
        o.position.x += Math.cos(an) * r;
        o.position.z += Math.sin(an) * r;
        o.rotation.y = rng() * 6.28;
        g.add(o);
      }
    };
    const scaled = (o, k) => { o.scale.setScalar(k); return o; };
    switch (scene) {
      case 'city':
        ring(28, R + 4, R + 15, () => {
          const o = grp();
          const h = 3 + rng() * 13, w = 1 + rng() * 1.8;
          P(o, box(w, h, w), rng() < 0.5 ? c : s, 0, h / 2 - 2.2, 0, { env: true, edge: true, op: 0.5 });
          if (rng() < 0.5) P(o, cyl(0.04, 0.04, 2, 4), a, 0, h - 1.2, 0, { env: true });
          return o;
        });
        break;
      case 'space': {
        const planet = grp();
        P(planet, H.geo('ico', 6, 2), s, 0, 0, 0, { env: true, op: 0.7 });
        const pr = P(planet, tor(9, 0.25, 6, 90), a, 0, 0, 0, { env: true });
        pr.rotation.x = Math.PI / 2.4;
        planet.position.set(-26, 11, -34);
        g.add(planet);
        const moon = grp();
        P(moon, H.geo('ico', 2.4, 1), c, 0, 0, 0, { env: true, edge: true, op: 0.6 });
        moon.position.set(30, 14, -20);
        g.add(moon);
        ring(22, R + 5, R + 13, () => {
          const o = grp();
          P(o, H.geo('dode', 0.5 + rng() * 0.9), rng() < 0.5 ? c : a, 0, -3 + rng() * 9, 0, { env: true, edge: true, op: 0.6 });
          return o;
        });
        break;
      }
      case 'forest':
        ring(34, R + 3, R + 11, () => scaled(PT.tree(rng() < 0.6 ? '#5dffa8' : c, a), 1.4 + rng() * 1.4));
        break;
      case 'ocean':
        ring(34, R + 3, R + 11, () => {
          const o = grp();
          const h = 2 + rng() * 4;
          P(o, cone(0.25, h, 5), rng() < 0.5 ? '#5dffd2' : c, 0, h / 2 - 1, 0, { env: true, edge: true });
          return o;
        });
        ring(10, R + 4, R + 9, () => scaled(C.fish(rng() < 0.5 ? s : a, '#ffffff'), 1.6));
        break;
      case 'volcano':
        for (let i = 0; i < 4; i++) {
          const o = grp();
          const h = 9 + rng() * 6;
          P(o, cone(6 + rng() * 3, h, 9), c, 0, h / 2 - 2.5, 0, { env: true, edge: true, op: 0.55 });
          P(o, sph(1.2, 10, 8), a, 0, h - 2.5, 0, { env: true });
          const an = (i / 4) * Math.PI * 2 + 0.6;
          o.position.set(Math.cos(an) * 32, 0, Math.sin(an) * 32);
          g.add(o);
        }
        ring(16, R + 3, R + 8, () => { const o = grp(); P(o, H.geo('dode', 0.6 + rng() * 0.6), s, 0, 0, 0, { env: true, edge: true }); return o; });
        break;
      case 'ice':
        ring(22, R + 4, R + 13, () => { const o = grp(); const k = 1 + rng() * 2.5; P(o, H.geo('oct', 1), c, 0, k * 0.8 - 1, 0, { env: true, edge: true, s: [k * 0.7, k * 1.8, k * 0.7], op: 0.6 }); return o; });
        ring(16, R + 3, R + 8, () => scaled(PT.tree('#e8f8ff', a), 1.3 + rng()));
        break;
      case 'candy':
        ring(18, R + 3, R + 10, () => scaled(PT.candy(rng() < 0.5 ? c : s, a), 1.8 + rng() * 1.5));
        ring(12, R + 4, R + 9, () => { const o = grp(); P(o, H.geo('dome', 1 + rng()), rng() < 0.5 ? a : s, 0, -0.5, 0, { env: true, edge: true }); return o; });
        break;
      case 'desert':
        for (let i = 0; i < 3; i++) {
          const o = grp();
          const k = 7 + rng() * 5;
          P(o, cone(k, k * 0.9, 4), c, 0, k * 0.45 - 2, 0, { env: true, edge: true, op: 0.5 });
          const an = (i / 3) * Math.PI * 2 + 0.3;
          o.position.set(Math.cos(an) * 34, 0, Math.sin(an) * 34);
          g.add(o);
        }
        ring(18, R + 3, R + 10, () => {
          const o = grp();
          P(o, cyl(0.25, 0.3, 2.4, 8), '#5dffa8', 0, 0.8, 0, { env: true, edge: true });
          P(o, cyl(0.15, 0.15, 0.9, 6), '#5dffa8', 0.45, 1.2, 0, { env: true, r: [0, 0, 0.9] });
          return o;
        });
        break;
      case 'grass':
        ring(14, R + 5, R + 14, () => { const o = grp(); P(o, H.geo('dome', 2 + rng() * 3), '#5dffa8', 0, -1, 0, { env: true, op: 0.45 }); return o; });
        ring(18, R + 3, R + 9, () => scaled(PT.tree('#7dff9a', a), 1.2 + rng()));
        ring(24, R + 2, R + 6, () => scaled(PT.flower(rng() < 0.5 ? s : a, '#ffe45c'), 1.5));
        break;
      case 'sky':
      default:
        ring(14, R + 4, R + 22, () => { const o = PT.cloud(); o.userData.floatY = 0; const k = 1.8 + rng() * 2; o.position.y = -9 - rng() * 5 - 3.4 * k; o.scale.setScalar(k); return o; });
        ring(6, R + 12, R + 20, () => { const o = M.island(c, a, rng() < 0.5 ? 'tree' : 'crystal'); o.position.y = rng() * 8; o.scale.setScalar(1.4); return o; });
        break;
    }
    return g;
  };

  // ---------- 共用的移动逻辑 ----------
  const kit = (M.kit = {});
  kit.lerpAngle = (a, b, t) => {
    let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return a + d * t;
  };
  kit.actor = (def, color, accent, scale = 1) => {
    const obj = new THREE.Group();
    const model = M.character(def.shape, color, accent);
    model.scale.setScalar(scale);
    model.userData.baseScale = scale;
    obj.add(model);
    return { obj, model, def, x: 0, z: 0, y: 0, vx: 0, vz: 0, vy: 0, face: 0, hp: 1, maxHp: 1, r: 0.55 * scale, scale, phase: Math.random() * 10 };
  };
  kit.place = (a, x, z) => { a.x = x; a.z = z; a.obj.position.set(x, a.y, z); };
  kit.moveHero = (h, dt, t, o) => {
    const mv = MW.input.move();
    const spd = 6 * (o.speed || 1);
    const k = 1 - Math.exp(-12 * dt);
    h.vx += (mv.x * spd - h.vx) * k;
    h.vz += (mv.y * spd - h.vz) * k;
    h.x += h.vx * dt;
    h.z += h.vz * dt;
    const d = Math.hypot(h.x, h.z), lim = o.R - 0.8;
    if (d > lim) { h.x *= lim / d; h.z *= lim / d; }
    if (Math.hypot(mv.x, mv.y) > 0.15) h.face = Math.atan2(mv.x, mv.y);
    h.obj.rotation.y = kit.lerpAngle(h.obj.rotation.y, h.face, Math.min(1, dt * 12));
    if (MW.input.take('jump') && h.y <= 0.001) { h.vy = 7.5 * (o.jump || 1); MW.sfx('jump'); }
    h.vy -= (o.gravity || 22) * dt;
    h.y += h.vy * dt;
    if (h.y < 0) { h.y = 0; h.vy = 0; }
    h.obj.position.set(h.x, h.y, h.z);
    M.animate(h.model, t, Math.min(1, Math.hypot(h.vx, h.vz) / 4));
  };
  kit.heroRing = (color) => {
    const r = new THREE.Mesh(H.geo('ring', 0.62, 0.78, 40), H.mat(color));
    r.rotation.x = -Math.PI / 2;
    r.position.y = 0.04;
    return r;
  };
})();
