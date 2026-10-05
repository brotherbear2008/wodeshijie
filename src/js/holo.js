/* 我的世界 · holo：全息投影 3D 引擎（投影台、光柱、全息材质、特效、镜头） */
(function () {
  'use strict';
  const MW = window.MW;
  const H = (MW.holo = {});
  H.R = 14; // 投影台半径（格）

  const timeU = { value: 0 };
  const revealU = { value: 999 };
  H.timeU = timeU;
  let renderer, scene, camera, composer, stage, world;
  let floorMat, wallMat, wall, rimMat, dashMat, dustPts, dustMat, scanGroup, starPts;
  let useComposer = true;
  const updaters = [];
  H.onUpdate = (fn) => updaters.push(fn);

  // ---------- 着色器 ----------
  const HOLO_VS = `
    uniform vec3 uColor;
    varying vec3 vN; varying vec3 vW; varying vec3 vC;
    void main() {
      vec4 lp = vec4(position, 1.0);
      vec3 n = normal;
      #ifdef USE_INSTANCING
        lp = instanceMatrix * lp;
        n = mat3(instanceMatrix) * n;
      #endif
      vec4 wp = modelMatrix * lp;
      vW = wp.xyz;
      vN = normalize(mat3(modelMatrix) * n);
      #ifdef USE_INSTANCING_COLOR
        vC = instanceColor;
      #else
        vC = uColor;
      #endif
      gl_Position = projectionMatrix * viewMatrix * wp;
    }`;
  const HOLO_FS = `
    uniform float uTime; uniform float uReveal; uniform float uOpacity; uniform float uBody;
    varying vec3 vN; varying vec3 vW; varying vec3 vC;
    void main() {
      if (vW.y > uReveal) discard;
      vec3 V = normalize(cameraPosition - vW);
      float f = 1.0 - abs(dot(normalize(vN), V));
      float fres = f * f;
      float scan = 0.5 + 0.5 * sin(vW.y * 24.0 - uTime * 3.0);
      float band = smoothstep(0.94, 1.0, fract(vW.y * 0.16 - uTime * 0.22));
      float edge = smoothstep(0.8, 0.0, uReveal - vW.y);
      vec3 col; float a;
      if (uBody > 0.5) {
        col = vC * (0.6 + fres * 1.2 + band * 0.55 + scan * 0.08) + vC * edge * 1.6;
        a = 0.68 + fres * 0.32;
      } else {
        col = vC * (0.7 + fres * 1.1 + band * 0.9) + vC * edge * 2.0;
        a = 0.13 + fres * 0.72 + scan * 0.08 + band * 0.4;
      }
      gl_FragColor = vec4(col, clamp(a, 0.0, 1.0) * uOpacity);
    }`;
  const LINE_VS = `varying float vY; void main(){ vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const LINE_FS = `uniform vec3 uColor; uniform float uReveal; uniform float uOpacity; varying float vY;
    void main(){ if (vY > uReveal) discard; float edge = smoothstep(0.8, 0.0, uReveal - vY); gl_FragColor = vec4(uColor * (1.0 + edge * 2.0), uOpacity); }`;
  const FLOOR_VS = `varying vec2 vP; varying float vY; void main(){ vP = position.xy; vec4 wp = modelMatrix * vec4(position, 1.0); vY = wp.y; gl_Position = projectionMatrix * viewMatrix * wp; }`;
  const FLOOR_FS = `
    uniform vec3 uColor; uniform vec3 uColor2; uniform float uTime; uniform float uR; uniform float uReveal;
    varying vec2 vP; varying float vY;
    float gl(float v, float w) { float d = abs(fract(v - 0.5) - 0.5) / max(fwidth(v), 1e-4); return 1.0 - min(d / w, 1.0); }
    void main(){
      if (vY > uReveal) discard;
      float r = length(vP);
      float g1 = max(gl(vP.x, 1.0), gl(vP.y, 1.0)) * 0.2;
      float g2 = max(gl(vP.x / 4.0, 1.4), gl(vP.y / 4.0, 1.4)) * 0.34;
      float rings = gl(r / 3.5, 1.2) * 0.28;
      float t = mod(uTime * 3.5, uR + 8.0);
      float pulse = smoothstep(1.6, 0.0, abs(r - t)) * 0.45;
      float rim = smoothstep(uR - 0.5, uR - 0.05, r) * 0.9;
      float fade = 1.0 - smoothstep(uR * 0.6, uR, r) * 0.45;
      float a = (g1 + g2 + rings) * fade + pulse * 0.5 + rim + 0.035;
      gl_FragColor = vec4(mix(uColor, uColor2, clamp(pulse * 1.4, 0.0, 1.0)), a);
    }`;
  const WALL_VS = `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
  const WALL_FS = `
    uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
    void main(){
      float fade = pow(1.0 - vUv.y, 1.7);
      float stripes = smoothstep(0.8, 1.0, sin(vUv.x * 6.2831853 * 72.0) * 0.5 + 0.5) * 0.3;
      float band = smoothstep(0.035, 0.0, abs(vUv.y - fract(uTime * 0.11)));
      float a = fade * (0.15 + stripes) + band * 0.22 * (1.0 - vUv.y * 0.7);
      gl_FragColor = vec4(uColor * (0.9 + band), a);
    }`;
  const DASH_FS = `
    uniform vec3 uColor; uniform float uTime; varying vec2 vUv;
    void main(){
      float d = step(0.5, fract(vUv.x * 64.0 - uTime * 0.6));
      gl_FragColor = vec4(uColor, d * 0.75);
    }`;

  // ---------- 材质与几何体缓存（所有世界共用，省内存） ----------
  const matCache = new Map();
  function normColor(c) { return typeof c === 'string' ? c : '#' + new THREE.Color(c).getHexString(); }
  function holoMat(color, body, opacity) {
    const key = color + (body ? 'b' : 'e') + opacity;
    let m = matCache.get(key);
    if (m) return m;
    m = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color(color) }, uTime: timeU, uReveal: revealU, uOpacity: { value: opacity }, uBody: { value: body ? 1 : 0 } },
      vertexShader: HOLO_VS,
      fragmentShader: HOLO_FS,
      transparent: true,
      depthWrite: !!body,
      blending: body ? THREE.NormalBlending : THREE.AdditiveBlending,
    });
    matCache.set(key, m);
    return m;
  }
  H.mat = (c, op = 1) => holoMat(normColor(c), false, op); // 发光的环境全息
  H.body = (c, op = 1) => holoMat(normColor(c), true, op); // 人物、道具：半透明实体
  const lineCache = new Map();
  H.lineMat = (c, op = 0.85) => {
    const key = normColor(c) + op;
    let m = lineCache.get(key);
    if (!m) {
      m = new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(normColor(c)) }, uReveal: revealU, uOpacity: { value: op } },
        vertexShader: LINE_VS, fragmentShader: LINE_FS,
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      });
      lineCache.set(key, m);
    }
    return m;
  };
  const edgeCache = new Map();
  H.edgeGeo = (geo) => {
    let e = edgeCache.get(geo.uuid);
    if (!e) { e = new THREE.EdgesGeometry(geo, 25); edgeCache.set(geo.uuid, e); }
    return e;
  };
  const geoCache = new Map();
  H.geo = (kind, ...a) => {
    const key = kind + ':' + a.join(',');
    let g = geoCache.get(key);
    if (g) return g;
    switch (kind) {
      case 'box': g = new THREE.BoxGeometry(a[0], a[1], a[2]); break;
      case 'sphere': g = new THREE.SphereGeometry(a[0], a[1] || 14, a[2] || 10); break;
      case 'dome': g = new THREE.SphereGeometry(a[0], 16, 8, 0, Math.PI * 2, 0, Math.PI / 2); break;
      case 'ico': g = new THREE.IcosahedronGeometry(a[0], a[1] || 0); break;
      case 'oct': g = new THREE.OctahedronGeometry(a[0], 0); break;
      case 'dode': g = new THREE.DodecahedronGeometry(a[0], 0); break;
      case 'cone': g = new THREE.ConeGeometry(a[0], a[1], a[2] || 10); break;
      case 'cyl': g = new THREE.CylinderGeometry(a[0], a[1], a[2], a[3] || 12, 1, !!a[4]); break;
      case 'torus': g = new THREE.TorusGeometry(a[0], a[1], a[2] || 8, a[3] || 24, a[4] || Math.PI * 2); break;
      case 'circle': g = new THREE.CircleGeometry(a[0], a[1] || 32); break;
      case 'ring': g = new THREE.RingGeometry(a[0], a[1], a[2] || 48); break;
      case 'plane': g = new THREE.PlaneGeometry(a[0], a[1]); break;
      case 'heart': g = heartGeo(); break;
      case 'star': g = starGeo(); break;
      default: g = new THREE.BoxGeometry(1, 1, 1);
    }
    geoCache.set(key, g);
    return g;
  };
  function heartGeo() {
    const s = new THREE.Shape();
    s.moveTo(0, -0.9);
    s.bezierCurveTo(-0.2, -0.6, -1.0, -0.2, -1.0, 0.3);
    s.bezierCurveTo(-1.0, 0.8, -0.4, 1.0, 0, 0.55);
    s.bezierCurveTo(0.4, 1.0, 1.0, 0.8, 1.0, 0.3);
    s.bezierCurveTo(1.0, -0.2, 0.2, -0.6, 0, -0.9);
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.35, bevelEnabled: true, bevelSize: 0.12, bevelThickness: 0.12, bevelSegments: 2, curveSegments: 10 });
    g.center();
    return g;
  }
  function starGeo() {
    const s = new THREE.Shape();
    for (let i = 0; i < 10; i++) {
      const r = i % 2 ? 0.45 : 1.0, a = (i / 10) * Math.PI * 2 + Math.PI / 2;
      if (i === 0) s.moveTo(Math.cos(a) * r, Math.sin(a) * r); else s.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    s.closePath();
    const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: true, bevelSize: 0.08, bevelThickness: 0.08, bevelSegments: 1 });
    g.center();
    return g;
  }

  // 圆点贴图（星星、灰尘、天气）
  function dotTexture() {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const x = c.getContext('2d');
    const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.35, 'rgba(255,255,255,0.6)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    x.fillStyle = g;
    x.fillRect(0, 0, 64, 64);
    const t = new THREE.CanvasTexture(c);
    return t;
  }
  let DOT = null;

  // ---------- 初始化 ----------
  H.init = (parent) => {
    renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
    H.quality = MW.save.settings.fx === 'low' ? 'low' : 'high';
    renderer.setPixelRatio(H.quality === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setClearColor(0x030914, 1);
    parent.appendChild(renderer.domElement);
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x030914, 0.011);
    camera = new THREE.PerspectiveCamera(50, window.innerWidth / window.innerHeight, 0.1, 500);
    camera.position.set(0, 16, 34);
    DOT = dotTexture();
    if (THREE.EffectComposer && THREE.RenderPass && THREE.UnrealBloomPass) {
      try {
        composer = new THREE.EffectComposer(renderer);
        composer.addPass(new THREE.RenderPass(scene, camera));
        composer.addPass(new THREE.UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.8, 0.45, 0.42));
      } catch (e) { composer = null; }
    }
    useComposer = !!composer && H.quality === 'high';
    H.renderer = renderer; H.scene = scene; H.camera = camera;
    buildStage();
    world = H.world = new THREE.Group();
    scene.add(world);
    initPointer();
    window.addEventListener('resize', onResize);
    const clock = new THREE.Clock();
    renderer.setAnimationLoop(() => loop(Math.min(clock.getDelta(), 0.05)));
  };

  function buildStage() {
    stage = new THREE.Group();
    scene.add(stage);
    const R = H.R;
    floorMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#4ff3ff') }, uColor2: { value: new THREE.Color('#ff62d4') }, uTime: timeU, uR: { value: R }, uReveal: revealU },
      vertexShader: FLOOR_VS, fragmentShader: FLOOR_FS,
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      extensions: { derivatives: true },
    });
    const floor = new THREE.Mesh(new THREE.CircleGeometry(R, 96), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.01;
    stage.add(floor);
    const under = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ color: 0x06121f, transparent: true, opacity: 0.88 }));
    under.rotation.x = -Math.PI / 2;
    under.position.y = -0.03;
    stage.add(under);
    // 投影台底座
    const pedMat = new THREE.MeshBasicMaterial({ color: 0x0a1a2c });
    const ped = new THREE.Mesh(new THREE.CylinderGeometry(R + 0.6, R + 1.6, 1.4, 96), pedMat);
    ped.position.y = -0.75;
    stage.add(ped);
    const ped2 = new THREE.Mesh(new THREE.CylinderGeometry(R + 1.6, R + 2.4, 0.8, 96), new THREE.MeshBasicMaterial({ color: 0x07121f }));
    ped2.position.y = -1.85;
    stage.add(ped2);
    rimMat = new THREE.MeshBasicMaterial({ color: 0x4ff3ff, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending });
    const rim = new THREE.Mesh(new THREE.TorusGeometry(R + 0.6, 0.06, 6, 160), rimMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = -0.05;
    stage.add(rim);
    const rim2 = new THREE.Mesh(new THREE.TorusGeometry(R + 1.6, 0.05, 6, 160), rimMat);
    rim2.rotation.x = Math.PI / 2;
    rim2.position.y = -1.45;
    stage.add(rim2);
    for (let i = 0; i < 32; i++) {
      const a = (i / 32) * Math.PI * 2;
      const l = new THREE.Mesh(H.geo('box', 0.55, 0.1, 0.1), rimMat);
      l.position.set(Math.cos(a) * (R + 1.12), -0.8, Math.sin(a) * (R + 1.12));
      l.rotation.y = -a + Math.PI / 2;
      stage.add(l);
    }
    dashMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#ff62d4') }, uTime: timeU },
      vertexShader: WALL_VS, fragmentShader: DASH_FS, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    });
    const dash = new THREE.Mesh(new THREE.RingGeometry(R + 0.15, R + 0.45, 160, 1), dashMat);
    dash.rotation.x = -Math.PI / 2;
    dash.position.y = 0.02;
    stage.add(dash);
    // 光柱（投影出来的光）
    wallMat = new THREE.ShaderMaterial({
      uniforms: { uColor: { value: new THREE.Color('#4ff3ff') }, uTime: timeU },
      vertexShader: WALL_VS, fragmentShader: WALL_FS,
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
    });
    wall = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 1, 96, 1, true), wallMat);
    stage.add(wall);
    H.setWallHeight(10);
    // 上升的光尘
    const N = 260;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * R;
      pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = Math.random() * 10; pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const dg = new THREE.BufferGeometry();
    dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    dustMat = new THREE.PointsMaterial({ size: 0.14, map: DOT, color: 0x9ff8ff, transparent: true, opacity: 0.7, depthWrite: false, blending: THREE.AdditiveBlending });
    dustPts = new THREE.Points(dg, dustMat);
    stage.add(dustPts);
    // 远处的星空
    const S = 1400, sp = new Float32Array(S * 3);
    for (let i = 0; i < S; i++) {
      const v = new THREE.Vector3(Math.random() * 2 - 1, Math.random() * 1.2 - 0.2, Math.random() * 2 - 1).normalize().multiplyScalar(160 + Math.random() * 120);
      sp[i * 3] = v.x; sp[i * 3 + 1] = v.y; sp[i * 3 + 2] = v.z;
    }
    const sg = new THREE.BufferGeometry();
    sg.setAttribute('position', new THREE.BufferAttribute(sp, 3));
    starPts = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, map: DOT, color: 0xcfefff, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    scene.add(starPts);
    // 生成世界时从下往上扫描的光环
    scanGroup = new THREE.Group();
    const sr = new THREE.Mesh(new THREE.RingGeometry(R - 0.9, R + 0.1, 128, 1), new THREE.MeshBasicMaterial({ color: 0x4ff3ff, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    const sd = new THREE.Mesh(new THREE.CircleGeometry(R, 96), new THREE.MeshBasicMaterial({ color: 0x4ff3ff, transparent: true, opacity: 0.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    sr.rotation.x = sd.rotation.x = -Math.PI / 2;
    scanGroup.add(sr, sd);
    scanGroup.visible = false;
    scene.add(scanGroup);
    buildWeather();
  }

  H.setWallHeight = (h) => {
    if (!wall) return;
    wall.scale.y = h;
    wall.position.y = h / 2;
    H.wallH = h;
  };

  const SCENE_BG = {
    home: '#030914', sky: '#06203a', space: '#02040c', ocean: '#021a2a', volcano: '#170609', ice: '#071a26',
    candy: '#170b22', city: '#050818', desert: '#170f06', forest: '#04150d', grass: '#05160f',
  };
  H.setScene = (sceneName, colors) => {
    const bg = new THREE.Color(SCENE_BG[sceneName] || '#030914');
    renderer.setClearColor(bg, 1);
    scene.fog.color.copy(bg);
    floorMat.uniforms.uColor.value.set(colors.main);
    floorMat.uniforms.uColor2.value.set(colors.second);
    wallMat.uniforms.uColor.value.set(colors.main);
    rimMat.color.set(colors.main);
    dashMat.uniforms.uColor.value.set(colors.second);
    dustMat.color.set(colors.accent);
    scanGroup.children.forEach((m) => m.material.color.set(colors.main));
    starPts.material.opacity = sceneName === 'space' || sceneName === 'home' ? 0.9 : 0.45;
  };

  // ---------- 天气粒子 ----------
  let wPts = null, wVel = null, wKind = 'none';
  const WN = 380;
  function buildWeather() {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(WN * 3), 3));
    wVel = new Float32Array(WN * 3);
    wPts = new THREE.Points(g, new THREE.PointsMaterial({ size: 0.22, map: DOT, color: 0xffffff, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }));
    wPts.visible = false;
    scene.add(wPts);
  }
  const WEATHER = {
    snow: { color: '#f2fbff', size: 0.24, vy: [-1.4, -0.7], sway: 0.6 },
    rain: { color: '#9fd8ff', size: 0.13, vy: [-16, -12], sway: 0 },
    petals: { color: '#ffb0e0', size: 0.3, vy: [-1.1, -0.6], sway: 1.2 },
    bubbles: { color: null, size: 0.34, vy: [0.6, 1.4], sway: 0.5 },
    stars: { color: null, size: 0.3, vy: [-0.15, 0.15], sway: 0.15 },
    embers: { color: '#ffb05c', size: 0.2, vy: [1.0, 2.2], sway: 0.8 },
  };
  function resetParticle(i, anyY) {
    const w = WEATHER[wKind];
    const p = wPts.geometry.attributes.position.array;
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * (H.R + 6);
    const top = Math.max(10, H.wallH || 10) + 2;
    p[i * 3] = Math.cos(a) * r;
    p[i * 3 + 2] = Math.sin(a) * r;
    p[i * 3 + 1] = anyY ? Math.random() * top : w.vy[0] < 0 ? top : 0;
    wVel[i * 3 + 1] = MW.rand(w.vy[0], w.vy[1]);
    wVel[i * 3] = Math.random() * 6.28;
  }
  H.setWeather = (kind, colors) => {
    wKind = WEATHER[kind] ? kind : 'none';
    if (wKind === 'none') { wPts.visible = false; return; }
    const w = WEATHER[wKind];
    wPts.material.color.set(w.color || (colors && colors.accent) || '#ffffff');
    wPts.material.size = w.size;
    for (let i = 0; i < WN; i++) resetParticle(i, true);
    wPts.geometry.attributes.position.needsUpdate = true;
    wPts.visible = true;
  };
  function updateWeather(dt) {
    if (!wPts.visible) return;
    const w = WEATHER[wKind];
    const p = wPts.geometry.attributes.position.array;
    const t = timeU.value;
    const top = Math.max(10, H.wallH || 10) + 2;
    for (let i = 0; i < WN; i++) {
      const ph = wVel[i * 3];
      p[i * 3 + 1] += wVel[i * 3 + 1] * dt;
      p[i * 3] += Math.sin(t * 0.8 + ph) * w.sway * dt;
      p[i * 3 + 2] += Math.cos(t * 0.7 + ph) * w.sway * dt;
      if (p[i * 3 + 1] < -0.5 || p[i * 3 + 1] > top + 1) resetParticle(i, false);
    }
    wPts.geometry.attributes.position.needsUpdate = true;
    if (wKind === 'stars') wPts.material.opacity = 0.6 + Math.sin(t * 3) * 0.3;
  }

  // ---------- 文字标签 ----------
  H.label = (text, color = '#e2fbff', opts = {}) => {
    const px = opts.px || 44;
    const c = document.createElement('canvas');
    const x = c.getContext('2d');
    const font = `900 ${px}px "PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif`;
    x.font = font;
    const w = Math.ceil(x.measureText(text).width + px * 0.9);
    const h = Math.ceil(px * 1.55);
    c.width = w; c.height = h;
    x.font = font;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    if (opts.bg) {
      x.fillStyle = 'rgba(3,14,28,0.72)';
      x.strokeStyle = color;
      x.lineWidth = 3;
      const r = h / 2 - 3;
      x.beginPath();
      x.moveTo(r + 3, 3); x.lineTo(w - r - 3, 3); x.arc(w - r - 3, h / 2, r, -Math.PI / 2, Math.PI / 2);
      x.lineTo(r + 3, h - 3); x.arc(r + 3, h / 2, r, Math.PI / 2, -Math.PI / 2);
      x.closePath(); x.fill(); x.stroke();
    }
    x.shadowColor = color;
    x.shadowBlur = px * 0.3;
    x.fillStyle = opts.bg ? '#ffffff' : color;
    x.fillText(text, w / 2, h / 2 + px * 0.04);
    const tex = new THREE.CanvasTexture(c);
    tex.minFilter = THREE.LinearFilter;
    const mat = new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: opts.depthTest !== false });
    const s = new THREE.Sprite(mat);
    const size = opts.size || 0.8;
    s.scale.set((w / h) * size, size, 1);
    s.renderOrder = 10;
    s.userData.dispose = () => { tex.dispose(); mat.dispose(); };
    return s;
  };

  // ---------- 特效 ----------
  const fx = [];
  const tmpV = new THREE.Vector3();
  H.burst = (pos, color, n = 16, spread = 5) => {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(H.geo('box', 0.16, 0.16, 0.16), H.mat(color));
      m.position.set(pos.x, (pos.y || 0) + 0.7, pos.z);
      const v = new THREE.Vector3(MW.rand(-1, 1), MW.rand(0.3, 1.4), MW.rand(-1, 1)).normalize().multiplyScalar(MW.rand(spread * 0.4, spread));
      scene.add(m);
      fx.push({ obj: m, v, life: MW.rand(0.5, 0.95), t: 0, kind: 'bit', spin: MW.rand(-9, 9) });
    }
  };
  H.spark = (pos, color, life = 0.8) => {
    const m = new THREE.Mesh(H.geo('oct', 0.12), H.mat(color));
    m.position.set(pos.x, (pos.y || 0) + 0.15, pos.z);
    scene.add(m);
    fx.push({ obj: m, kind: 'spark', t: 0, life, v: new THREE.Vector3(0, 0.6, 0) });
  };
  H.ring = (pos, color, maxR = 3, dur = 0.45) => {
    const m = new THREE.Mesh(H.geo('torus', 1, 0.06, 6, 48), H.mat(color));
    m.rotation.x = Math.PI / 2;
    m.position.set(pos.x, (pos.y || 0) + 0.2, pos.z);
    scene.add(m);
    fx.push({ obj: m, kind: 'ring', t: 0, life: dur, maxR });
  };
  H.floatText = (pos, text, color = '#ffe45c', size = 0.8) => {
    const s = H.label(text, color, { px: 40, size, depthTest: false });
    s.position.set(pos.x, (pos.y || 0) + 2.3, pos.z);
    scene.add(s);
    fx.push({ obj: s, kind: 'text', t: 0, life: 1.0 });
  };
  H.beam = (pos, color, dur = 0.8) => {
    const m = new THREE.Mesh(H.geo('cyl', 0.8, 0.8, 14, 20, true), H.mat(color));
    m.position.set(pos.x, 7, pos.z);
    scene.add(m);
    fx.push({ obj: m, kind: 'beam', t: 0, life: dur });
  };
  H.zap = (a, b, color) => {
    const g = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(a.x, a.y + 1, a.z), new THREE.Vector3((a.x + b.x) / 2 + MW.rand(-0.4, 0.4), (a.y + b.y) / 2 + 1.6, (a.z + b.z) / 2 + MW.rand(-0.4, 0.4)), new THREE.Vector3(b.x, b.y + 0.9, b.z)]);
    const l = new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }));
    l.userData.dispose = () => { g.dispose(); l.material.dispose(); };
    scene.add(l);
    fx.push({ obj: l, kind: 'zap', t: 0, life: 0.18 });
  };
  function updateFx(dt) {
    for (let i = fx.length - 1; i >= 0; i--) {
      const f = fx[i];
      f.t += dt;
      const k = f.t / f.life;
      if (k >= 1) {
        scene.remove(f.obj);
        if (f.obj.userData.dispose) f.obj.userData.dispose();
        fx.splice(i, 1);
        continue;
      }
      const o = f.obj;
      if (f.kind === 'bit') {
        f.v.y -= 12 * dt;
        o.position.addScaledVector(f.v, dt);
        o.rotation.x += f.spin * dt; o.rotation.y += f.spin * dt;
        o.scale.setScalar(Math.max(0.01, 1 - k));
        if (o.position.y < 0.05) { o.position.y = 0.05; f.v.y *= -0.4; f.v.x *= 0.7; f.v.z *= 0.7; }
      } else if (f.kind === 'spark') {
        o.position.addScaledVector(f.v, dt);
        o.rotation.y += dt * 6;
        o.scale.setScalar(Math.max(0.01, 1 - k));
      } else if (f.kind === 'ring') {
        const s = 0.3 + k * f.maxR;
        o.scale.set(s, s, 1);
      } else if (f.kind === 'text') {
        o.position.y += dt * 1.5;
        o.material.opacity = 1 - k * k;
      } else if (f.kind === 'beam') {
        const s = Math.max(0.01, 1 - k);
        o.scale.set(s, 1, s);
      } else if (f.kind === 'zap') {
        o.material.opacity = 1 - k;
      }
    }
  }

  // ---------- 生成动画：扫描线从下往上把世界“打印”出来 ----------
  let reveal = null;
  H.materialize = (dur = 2.2, maxY = 12) => {
    reveal = { t: 0, dur, maxY };
    revealU.value = -3;
    scanGroup.visible = true;
    MW.sfx('build');
  };
  function updateReveal(dt) {
    if (!reveal) return;
    reveal.t += dt;
    const k = Math.min(1, reveal.t / reveal.dur);
    const e = k < 0.5 ? 2 * k * k : 1 - Math.pow(-2 * k + 2, 2) / 2;
    revealU.value = -3 + e * (reveal.maxY + 3.5);
    scanGroup.position.y = Math.max(0.05, revealU.value);
    if (k >= 1) { revealU.value = 999; scanGroup.visible = false; reveal = null; }
  }

  // ---------- 镜头 ----------
  const cam = (H.cam = {
    mode: 'orbit', // orbit 自动环绕 / follow 跟随角色 / fixed 固定
    target: new THREE.Vector3(0, 2, 0),
    angle: 0.5, dist: 32, height: 15, auto: true,
    follow: new THREE.Vector3(),
    offset: new THREE.Vector3(0, 11, 12.5),
    fixedPos: new THREE.Vector3(0, 27, 17),
    lookAt: new THREE.Vector3(0, 0, 1),
    lerp: 3,
    zoom: 1, // 额外拉远（手机上图稿面板挡住下半屏时用）
  });
  // 竖屏（手机）时自动把镜头拉远，整个投影台都能看到
  H.zoomK = () => {
    const a = window.innerWidth / Math.max(1, window.innerHeight);
    return (a >= 1.2 ? 1 : Math.min(2.1, Math.pow(1.2 / a, 0.85))) * cam.zoom;
  };
  const curLook = new THREE.Vector3(0, 2, 0);
  const want = new THREE.Vector3();
  const lookT = new THREE.Vector3();
  let dragging = false;
  function updateCam(dt) {
    const zk = H.zoomK();
    if (cam.mode === 'orbit') {
      if (cam.auto && !dragging) cam.angle += dt * 0.09;
      want.set(cam.target.x + Math.sin(cam.angle) * cam.dist * zk, cam.target.y + cam.height * zk, cam.target.z + Math.cos(cam.angle) * cam.dist * zk);
      lookT.copy(cam.target);
    } else if (cam.mode === 'follow') {
      want.copy(cam.offset).multiplyScalar(1 + (zk - 1) * 0.75).add(cam.follow);
      lookT.copy(cam.follow); lookT.y += 1;
    } else {
      want.copy(cam.fixedPos).sub(cam.lookAt).multiplyScalar(zk).add(cam.lookAt);
      lookT.copy(cam.lookAt);
    }
    const k = 1 - Math.exp(-cam.lerp * dt);
    camera.position.lerp(want, k);
    curLook.lerp(lookT, k);
    camera.lookAt(curLook);
  }
  // 让投影中心避开左边（或下边）的面板
  const shift = { x: 0, y: 0, tx: 0, ty: 0 };
  H.setViewShift = (x, y) => { shift.tx = x; shift.ty = y; };
  function applyShift(dt) {
    const k = 1 - Math.exp(-5 * dt);
    shift.x += (shift.tx - shift.x) * k;
    shift.y += (shift.ty - shift.y) * k;
    const W = window.innerWidth, Hh = window.innerHeight;
    if (Math.abs(shift.x) < 0.5 && Math.abs(shift.y) < 0.5 && shift.tx === 0 && shift.ty === 0) {
      if (camera.view && camera.view.enabled) camera.clearViewOffset();
      return;
    }
    camera.setViewOffset(W, Hh, -shift.x, shift.y, W, Hh);
  }

  // ---------- 拖动转镜头、点选、滑动 ----------
  function initPointer() {
    const el = renderer.domElement;
    let sx = 0, sy = 0, lx = 0, ly = 0, t0 = 0, down = false, moved = 0;
    el.addEventListener('pointerdown', (e) => {
      down = true; moved = 0; sx = lx = e.clientX; sy = ly = e.clientY; t0 = performance.now();
      if (cam.mode === 'orbit') dragging = true;
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    });
    el.addEventListener('pointermove', (e) => {
      if (!down) return;
      const dx = e.clientX - lx, dy = e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
      moved += Math.abs(dx) + Math.abs(dy);
      if (dragging && cam.mode === 'orbit') {
        cam.angle -= dx * 0.006;
        cam.height = MW.clamp(cam.height + dy * 0.05, 3, 34);
      }
    });
    const up = (e) => {
      if (!down) return;
      down = false; dragging = false;
      const dt = performance.now() - t0;
      const dx = e.clientX - sx, dy = e.clientY - sy;
      if (moved < 8 && dt < 500) MW.emit('stageClick', e);
      else if (Math.hypot(dx, dy) > 28 && dt < 600) {
        MW.emit('stageSwipe', Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
      }
    };
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', () => { down = false; dragging = false; });
    el.addEventListener('wheel', (e) => {
      if (cam.mode !== 'orbit') return;
      e.preventDefault();
      cam.dist = MW.clamp(cam.dist + e.deltaY * 0.02, 14, 56);
    }, { passive: false });
  }
  const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
  H.pick = (clientX, clientY, objects) => {
    const r = renderer.domElement.getBoundingClientRect();
    ndc.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, camera);
    const hits = ray.intersectObjects(objects, true);
    return hits[0] || null;
  };

  H.clearWorld = () => {
    for (const ch of [...world.children]) {
      world.remove(ch);
      ch.traverse((o) => {
        if (o.userData && o.userData.dispose) o.userData.dispose();
        if (o.isInstancedMesh) o.dispose();
      });
    }
    for (const f of fx) { scene.remove(f.obj); if (f.obj.userData.dispose) f.obj.userData.dispose(); }
    fx.length = 0;
    revealU.value = 999;
    reveal = null;
    scanGroup.visible = false;
  };

  // ---------- 画质：卡的时候自动关掉辉光 ----------
  H.setQuality = (q, auto) => {
    H.quality = q;
    renderer.setPixelRatio(q === 'high' ? Math.min(window.devicePixelRatio || 1, 1.75) : 1);
    if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(window.innerWidth, window.innerHeight); }
    useComposer = !!composer && q === 'high';
    if (auto) {
      MW.save.settings.fx = q;
      MW.persist();
      MW.toast('画面有点卡，已经切换到流畅模式');
    }
  };
  let fpsT = 0, fpsN = 0, slow = 0;
  function watchFps(dt) {
    fpsT += dt; fpsN++;
    if (fpsT < 2.5) return;
    const fps = fpsN / fpsT;
    fpsT = 0; fpsN = 0;
    if (H.quality === 'high' && fps < 30 && !document.hidden) {
      slow++;
      if (slow >= 2) { H.setQuality('low', true); slow = 0; }
    } else slow = 0;
  }

  function onResize() {
    const W = window.innerWidth, Hh = window.innerHeight;
    renderer.setSize(W, Hh);
    if (composer) composer.setSize(W, Hh);
    camera.aspect = W / Hh;
    camera.updateProjectionMatrix();
    MW.emit('resize');
  }

  function loop(dt) {
    timeU.value += dt;
    for (const fn of updaters) {
      try { fn(dt, timeU.value); } catch (e) { console.error(e); }
    }
    updateFx(dt);
    updateReveal(dt);
    updateWeather(dt);
    updateCam(dt);
    applyShift(dt);
    // 光尘慢慢上升
    const p = dustPts.geometry.attributes.position.array;
    const top = H.wallH || 10;
    for (let i = 1; i < p.length; i += 3) { p[i] += dt * 0.35; if (p[i] > top) p[i] = 0; }
    dustPts.geometry.attributes.position.needsUpdate = true;
    starPts.rotation.y += dt * 0.004;
    watchFps(dt);
    if (useComposer) composer.render(dt);
    else renderer.render(scene, camera);
  }
})();
