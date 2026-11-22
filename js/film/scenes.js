// Prosedürel 3D sahneler. Her sahne: { scene, update(t) } ; kamera (0,0,10)'dan merkeze bakar.
import * as THREE from '../../vendor/three-bundle.js?v=202611221951';

function rng(seed) { return () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; }; }

const NOISE = `
float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0.0, a=0.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=0.5; } return v; }
`;

const texCache = new Map();
function glowTex(inner = 'rgba(255,255,255,1)', outer = 'rgba(255,255,255,0)', size = 256, key = '') {
  const k = key || inner + outer + size;
  if (texCache.has(k)) return texCache.get(k);
  const c = document.createElement('canvas'); c.width = c.height = size;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gr.addColorStop(0, inner); gr.addColorStop(0.25, inner.replace(/[\d.]+\)$/, '0.55)')); gr.addColorStop(1, outer);
  g.fillStyle = gr; g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set(k, t); return t;
}
function cloudTex() {
  if (texCache.has('cloud')) return texCache.get('cloud');
  const s = 256, c = document.createElement('canvas'); c.width = c.height = s; const g = c.getContext('2d'); const r = rng(11);
  for (let i = 0; i < 60; i++) {
    const x = s * (0.25 + r() * 0.5), y = s * (0.35 + r() * 0.3), rad = s * (0.08 + r() * 0.16);
    const gr = g.createRadialGradient(x, y, 0, x, y, rad); gr.addColorStop(0, 'rgba(255,255,255,0.22)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.beginPath(); g.arc(x, y, rad, 0, Math.PI * 2); g.fill();
  }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; texCache.set('cloud', t); return t;
}

function skyDome(top, mid, bottom, { stars = 0, nebula = 0, sun = null } = {}) {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bottom: { value: new THREE.Color(bottom) }, t: { value: 0 }, nebula: { value: nebula }, sunDir: { value: sun ? new THREE.Vector3(...sun.dir).normalize() : new THREE.Vector3(0, -1, 0) }, sunCol: { value: new THREE.Color(sun ? sun.color : '#000') } },
    vertexShader: `varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
    fragmentShader: `${NOISE} uniform vec3 top, mid, bottom, sunCol, sunDir; uniform float t, nebula; varying vec3 vP;
      void main(){ float h = vP.y; vec3 c = h > 0.0 ? mix(mid, top, smoothstep(0.0, 0.32, h)) : mix(mid, bottom, smoothstep(0.0, -0.3, h));
        if (nebula > 0.0) { float n = fbm(vP.xy*5.0 + vP.z*2.0 + vec2(t*0.01, 0.0)); float n2 = fbm(vP.yx*9.0 - vec2(0.0, t*0.008));
          c += nebula * (vec3(0.35,0.15,0.55)*smoothstep(0.45,0.9,n) + vec3(0.1,0.25,0.5)*smoothstep(0.5,0.95,n2)); }
        float s = max(dot(vP, sunDir), 0.0); c += sunCol * (pow(s, 400.0)*2.0 + pow(s, 32.0)*0.25 + pow(s, 6.0)*0.06);
        gl_FragColor = vec4(c, 1.0); }`
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(400, 48, 24), mat);
  m.userData.update = t => (mat.uniforms.t.value = t);
  return m;
}

function starField(n = 2500, radius = 300, seed = 3, size = 1.6) {
  const r = rng(seed), pos = new Float32Array(n * 3), ph = new Float32Array(n), sz = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const u = r() * 2 - 1, th = r() * Math.PI * 2, s = Math.sqrt(1 - u * u);
    pos[i * 3] = s * Math.cos(th) * radius; pos[i * 3 + 1] = Math.abs(u) * radius * 0.9 + radius * 0.02; pos[i * 3 + 2] = s * Math.sin(th) * radius;
    ph[i] = r() * 6.28; sz[i] = size * (0.4 + Math.pow(r(), 3) * 2.2);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1)); g.setAttribute('sz', new THREE.BufferAttribute(sz, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false, uniforms: { t: { value: 0 }, scale: { value: 1 } },
    vertexShader: `attribute float ph; attribute float sz; uniform float t, scale; varying float vA;
      void main(){ vA = 0.45 + 0.55*pow(sin(t*1.3 + ph)*0.5+0.5, 2.0); vec4 mv = modelViewMatrix*vec4(position,1.0); gl_PointSize = sz*scale; gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `varying float vA; void main(){ vec2 d = gl_PointCoord-0.5; float a = smoothstep(0.5, 0.0, length(d)); gl_FragColor = vec4(vec3(1.0,0.97,0.9)*a*vA, a*vA); }`
  });
  const p = new THREE.Points(g, mat);
  p.userData.update = t => (mat.uniforms.t.value = t);
  p.userData.mat = mat;
  return p;
}

export function dust(n, box, color = '#ffe8c0', size = 2.2, seed = 9, speed = 0.15) {
  const r = rng(seed), pos = new Float32Array(n * 3), ph = new Float32Array(n);
  for (let i = 0; i < n; i++) { pos[i * 3] = (r() - .5) * box[0]; pos[i * 3 + 1] = (r() - .5) * box[1]; pos[i * 3 + 2] = (r() - .5) * box[2]; ph[i] = r() * 6.28; }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('ph', new THREE.BufferAttribute(ph, 1));
  const mat = new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, fog: false,
    uniforms: { t: { value: 0 }, col: { value: new THREE.Color(color) }, size: { value: size }, box: { value: new THREE.Vector3(...box) }, speed: { value: speed }, scale: { value: 1 } },
    vertexShader: `attribute float ph; uniform float t, size, speed, scale; uniform vec3 box; varying float vA;
      void main(){ vec3 p = position; p.y = mod(p.y + t*speed*(0.5+fract(ph)) + box.y*0.5, box.y) - box.y*0.5; p.x += sin(t*0.3+ph)*0.6; p.z += cos(t*0.25+ph*1.3)*0.4;
        vec4 mv = modelViewMatrix*vec4(p,1.0); float dz = -mv.z; vA = (0.35 + 0.65*(sin(t*0.9+ph*3.0)*0.5+0.5)) * smoothstep(3.0, 9.0, dz); gl_PointSize = min(size*scale*(40.0/max(1.0,dz)), 9.0*scale); gl_Position = projectionMatrix*mv; }`,
    fragmentShader: `uniform vec3 col; varying float vA; void main(){ float a = smoothstep(0.5,0.0,length(gl_PointCoord-0.5)); gl_FragColor = vec4(col*a*vA, a*vA); }`
  });
  const p = new THREE.Points(g, mat);
  p.userData.update = t => (mat.uniforms.t.value = t);
  p.userData.mat = mat;
  return p;
}

function glowSprite(color, scale, pos, opacity = 1) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex(), color, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity, fog: false }));
  s.scale.set(scale, scale, 1); s.position.set(...pos); return s;
}

function ridge(z, color, amp, base, seed, width = 900) {
  const r = rng(seed); const shape = new THREE.Shape(); const N = 90;
  const ph = [r() * 6, r() * 6, r() * 6];
  shape.moveTo(-width / 2, base - 200);
  for (let i = 0; i <= N; i++) { const x = -width / 2 + width * i / N; const y = base + amp * (0.55 * Math.sin(x * 0.012 + ph[0]) + 0.3 * Math.sin(x * 0.031 + ph[1]) + 0.15 * Math.sin(x * 0.083 + ph[2]) + (r() - 0.5) * 0.08); shape.lineTo(x, y); }
  shape.lineTo(width / 2, base - 200); shape.closePath();
  const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false })); m.position.z = z; return m;
}

/* ---------------- sahneler ---------------- */
const BUILDERS = {
  yildiz() {
    const scene = new THREE.Scene();
    const sky = skyDome('#01020a', '#0b1638', '#1a2350', { nebula: 0.28 });
    const stars = starField(5200, 300, 3, 2.3);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(4, 48, 32), new THREE.MeshBasicMaterial({ color: '#fff3d6', fog: false }));
    moon.position.set(-26, 22, -90);
    const mg = glowSprite('#ffe9b8', 60, [-26, 22, -91], 0.55);
    const near = dust(260, [40, 24, 30], '#cfe0ff', 1.6, 5, 0.05);
    scene.add(sky, stars, moon, mg, near);
    scene.add(ridge(-160, '#0c1230', 26, -22, 71, 1400), ridge(-90, '#070a1c', 14, -16, 72), ridge(-55, '#03040c', 8, -12, 73));
    scene.add(glowSprite('#3a4c9a', 260, [0, -30, -170], 0.35));
    // kayan yıldız
    const trailMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
    const trail = new THREE.Mesh(new THREE.PlaneGeometry(14, 0.12), trailMat); trail.position.set(10, 30, -80); trail.rotation.z = -0.35; scene.add(trail);
    return { scene, update(t) { sky.userData.update(t); stars.userData.update(t); near.userData.update(t); stars.rotation.y = t * 0.004;
      const c = (t % 9) / 9; trailMat.opacity = c < 0.12 ? Math.sin(c / 0.12 * Math.PI) * 0.9 : 0; trail.position.x = 30 - c * 260; trail.position.y = 34 - c * 90; } };
  },

  col() {
    const scene = new THREE.Scene();
    const sunDir = [-0.32, 0.07, -1];
    scene.add(skyDome('#3a2a6e', '#f08a4b', '#a5502e', { sun: { dir: sunDir, color: '#ffb36b' } }));
    scene.fog = new THREE.Fog('#e08350', 40, 260);
    const geo = new THREE.PlaneGeometry(600, 600, 220, 220); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position; const r = rng(21);
    const waves = Array.from({ length: 6 }, () => ({ a: 1 + r() * 3.5, fx: 0.01 + r() * 0.03, fz: 0.01 + r() * 0.03, ph: r() * 6 }));
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), z = p.getZ(i); let y = 0;
      for (const w of waves) y += w.a * Math.pow(Math.sin(x * w.fx + z * w.fz + w.ph) * 0.5 + 0.5, 2.2);
      p.setY(i, y - 9 + Math.max(0, -z - 60) * 0.02);
    }
    geo.computeVertexNormals();
    const dunes = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: '#d99a62', roughness: 0.95, metalness: 0 }));
    scene.add(dunes);
    const sun = new THREE.DirectionalLight('#ffbe7a', 2.6); sun.position.set(-32, 7, -100); scene.add(sun);
    scene.add(new THREE.HemisphereLight('#7a6bd0', '#4a2a18', 0.75));
    const sunDisc = glowSprite('#ffd9a0', 30, [-80, 17, -250], 0.75);
    const sand = dust(400, [60, 14, 40], '#ffd6a6', 1.4, 7, 0.06); sand.position.y = -4;
    scene.add(sunDisc, sand);
    return { scene, update(t) { sand.userData.update(t); sunDisc.material.opacity = 0.85 + 0.1 * Math.sin(t * 0.5); } };
  },

  deniz() {
    const scene = new THREE.Scene();
    const moonDir = new THREE.Vector3(0.12, 0.2, -1).normalize();
    scene.add(skyDome('#030716', '#0e1e44', '#0a1836', { sun: { dir: moonDir.toArray(), color: '#9fb6ff' }, nebula: 0.25 }));
    scene.add(starField(1600, 300, 8, 1.6));
    scene.fog = new THREE.Fog('#0d1d40', 30, 230);
    const moon = new THREE.Mesh(new THREE.SphereGeometry(5, 48, 32), new THREE.MeshBasicMaterial({ color: '#f4f1ff', fog: false }));
    moon.position.copy(moonDir.clone().multiplyScalar(240)); scene.add(moon);
    scene.add(glowSprite('#b9c8ff', 90, moon.position.toArray(), 0.5));
    const wMat = new THREE.ShaderMaterial({
      fog: true, uniforms: { ...THREE.UniformsUtils.clone(THREE.UniformsLib.fog), t: { value: 0 }, moonDir: { value: moonDir }, deep: { value: new THREE.Color('#04102a') }, shallow: { value: new THREE.Color('#163a6e') } },
      vertexShader: `uniform float t; varying vec3 vV; varying vec3 vN; #include <fog_pars_vertex>
        float h(vec2 p){ return sin(p.x*0.08+t*0.9)*0.9 + sin(p.y*0.11+t*1.1)*0.7 + sin((p.x+p.y)*0.21+t*1.7)*0.35 + sin((p.x-p.y)*0.37+t*2.3)*0.18; }
        void main(){ vec3 p = position; p.y += h(p.xz); float e=0.5; vec3 n = normalize(vec3(h(p.xz-vec2(e,0.0))-h(p.xz+vec2(e,0.0)), 2.0*e, h(p.xz-vec2(0.0,e))-h(p.xz+vec2(0.0,e))));
          vN = normalize(normalMatrix * n); vec4 mvPosition = modelViewMatrix*vec4(p,1.0); vV = -mvPosition.xyz; gl_Position = projectionMatrix*mvPosition; #include <fog_vertex> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n'),
      fragmentShader: `uniform vec3 moonDir, deep, shallow; varying vec3 vV; varying vec3 vN; #include <common> #include <fog_pars_fragment>
        void main(){ vec3 V = normalize(vV); vec3 N = normalize(vN); vec3 L = normalize((viewMatrix * vec4(moonDir, 0.0)).xyz); vec3 R = reflect(-V, N);
          float rl = max(dot(R, L), 0.0); float spec = pow(rl, 600.0)*3.0 + pow(rl, 60.0)*0.12;
          float fres = pow(1.0 - max(dot(V, N), 0.0), 4.0); vec3 c = mix(deep, shallow, fres*0.8) + vec3(0.75,0.82,1.0)*spec; gl_FragColor = vec4(c,1.0); #include <fog_fragment> }`.replace(/#include <(\w+)>/g, '\n#include <$1>\n')
    });
    const geo = new THREE.PlaneGeometry(600, 600, 260, 260); geo.rotateX(-Math.PI / 2);
    const water = new THREE.Mesh(geo, wMat); water.position.y = -6; scene.add(water);
    const mist = dust(200, [60, 10, 40], '#a9bfff', 1.2, 4, 0.03); mist.position.y = -3; scene.add(mist);
    wMat.uniforms.fogColor.value.copy(scene.fog.color); wMat.uniforms.fogNear.value = scene.fog.near; wMat.uniforms.fogFar.value = scene.fog.far;
    return { scene, update(t) { wMat.uniforms.t.value = t; mist.userData.update(t); } };
  },

  nur() {
    const scene = new THREE.Scene();
    scene.add(skyDome('#0b0703', '#1c120a', '#070402'));
    const src = new THREE.Vector3(0, 26, -30);
    scene.add(glowSprite('#ffdca0', 40, src.toArray(), 0.9));
    const rays = [];
    const rayMat = () => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { col: { value: new THREE.Color('#ffd08a') }, a: { value: 0.18 }, t: { value: 0 }, ph: { value: Math.random() } },
      vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `${NOISE} uniform vec3 col; uniform float a, t, ph; varying vec2 vUv;
        void main(){ float along = vUv.y; float edge = sin(vUv.x*3.14159); float n = fbm(vec2(vUv.x*6.0 + ph*10.0, along*2.0 - t*0.15));
          float al = a * pow(edge, 2.0) * smoothstep(0.0, 0.25, along) * (0.6 + 0.6*n); gl_FragColor = vec4(col*al, al); }`
    });
    const r = rng(17);
    for (let i = 0; i < 9; i++) {
      const len = 70, geo = new THREE.ConeGeometry(4 + r() * 7, len, 32, 1, true); geo.translate(0, -len / 2, 0);
      const m = new THREE.Mesh(geo, rayMat()); m.material.uniforms.ph.value = r();
      m.position.copy(src); m.userData = { base: (i - 4) * 0.13 + (r() - .5) * 0.08, sp: 0.1 + r() * 0.15, ph: r() * 6, tilt: (r() - .5) * 0.3 };
      rays.push(m); scene.add(m);
    }
    const motes = dust(700, [50, 40, 40], '#ffe2b0', 2.2, 13, 0.08);
    scene.add(motes, glowSprite('#ff9a40', 120, [0, -10, -60], 0.18));
    return { scene, update(t) { motes.userData.update(t); for (const m of rays) { m.rotation.z = m.userData.base + Math.sin(t * m.userData.sp + m.userData.ph) * 0.06; m.rotation.x = m.userData.tilt; m.material.uniforms.t.value = t; } } };
  },

  cami() {
    const scene = new THREE.Scene();
    scene.add(skyDome('#0b1438', '#5a3d78', '#f29a63', {}));
    scene.add(starField(1400, 300, 12, 1.5));
    scene.fog = new THREE.Fog('#7a4f7c', 20, 160);
    // hilal
    const cres = new THREE.Mesh(new THREE.PlaneGeometry(14, 14), new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, fog: false, uniforms: {},
      vertexShader: `varying vec2 vUv; void main(){ vUv=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);} `,
      fragmentShader: `varying vec2 vUv; void main(){ vec2 p = vUv-0.5; float a = smoothstep(0.30,0.29,length(p)); float b = smoothstep(0.26,0.25,length(p-vec2(0.11,0.06))); float m = a*(1.0-b);
        float g = smoothstep(0.5,0.0,length(p))*0.25; gl_FragColor = vec4(vec3(1.0,0.95,0.8)*(m+g), m+g*0.6); }`
    }));
    cres.position.set(18, 26, -110); scene.add(cres);
    const layers = [{ z: -95, col: '#3a2850', s: 1.7 }, { z: -62, col: '#24183a', s: 1.2 }, { z: -38, col: '#120c20', s: 0.8 }];
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(800, 400), new THREE.MeshBasicMaterial({ color: '#0d0818' })); ground.rotation.x = -Math.PI / 2; ground.position.set(0, -8, -100); scene.add(ground);
    const r = rng(31);
    for (const L of layers) {
      const mat = new THREE.MeshBasicMaterial({ color: L.col });
      const g = new THREE.Group(); g.position.z = L.z;
      let x = -60 * L.s;
      while (x < 60 * L.s) {
        const w = (6 + r() * 8) * L.s, h = (3 + r() * 4) * L.s;
        const base = new THREE.Mesh(new THREE.BoxGeometry(w, h, 4 * L.s), mat); base.position.set(x, -8 + h / 2, 0); g.add(base);
        if (r() < 0.75) {
          const dr = w * (0.3 + r() * 0.15);
          const dome = new THREE.Mesh(new THREE.SphereGeometry(dr, 32, 16, 0, Math.PI * 2, 0, Math.PI / 2), mat); dome.position.set(x, -8 + h, 0); dome.scale.y = 1.15; g.add(dome);
          const fin = new THREE.Mesh(new THREE.ConeGeometry(0.12 * L.s, dr * 0.5, 8), mat); fin.position.set(x, -8 + h + dr * 1.15 + dr * 0.2, 0); g.add(fin);
        }
        if (r() < 0.45) {
          const mh = (12 + r() * 10) * L.s, mx = x + w / 2 + 0.6 * L.s;
          const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.45 * L.s, 0.55 * L.s, mh, 12), mat); shaft.position.set(mx, -8 + mh / 2, 0); g.add(shaft);
          const bal = new THREE.Mesh(new THREE.CylinderGeometry(0.8 * L.s, 0.8 * L.s, 0.35 * L.s, 12), mat); bal.position.set(mx, -8 + mh * 0.78, 0); g.add(bal);
          const cap = new THREE.Mesh(new THREE.ConeGeometry(0.5 * L.s, 2.6 * L.s, 12), mat); cap.position.set(mx, -8 + mh + 1.3 * L.s, 0); g.add(cap);
        }
        x += w + (1 + r() * 5) * L.s;
      }
      scene.add(g);
    }
    const lanterns = [];
    for (let i = 0; i < 14; i++) {
      const s = glowSprite('#ffb85c', 0.5 + r() * 0.7, [(r() - .5) * 34, -5 + r() * 9, -14 - r() * 20], 0.9);
      s.userData = { y: s.position.y, ph: r() * 6, sp: 0.2 + r() * 0.3 }; lanterns.push(s); scene.add(s);
    }
    return { scene, update(t) { for (const s of lanterns) { s.position.y = s.userData.y + Math.sin(t * s.userData.sp + s.userData.ph) * 0.5; s.material.opacity = 0.7 + 0.3 * Math.sin(t * 2 + s.userData.ph); } } };
  },

  desen() {
    const scene = new THREE.Scene();
    scene.add(skyDome('#050302', '#0b0703', '#050302'));
    scene.add(glowSprite('#ffb84d', 60, [0, 0, -140], 0.6));
    const ringGeo = (() => {
      const pts = []; const R = 9, r2 = R * 0.72; const N = 16;
      for (let i = 0; i < N; i++) {
        const a1 = i / N * Math.PI * 2, a2 = (i + 1) / N * Math.PI * 2;
        const R1 = i % 2 ? r2 : R, R2 = (i + 1) % 2 ? r2 : R;
        pts.push(Math.cos(a1) * R1, Math.sin(a1) * R1, 0, Math.cos(a2) * R2, Math.sin(a2) * R2, 0);
      }
      for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2; pts.push(Math.cos(a) * R, Math.sin(a) * R, 0, Math.cos(a + Math.PI * 3 / 4) * R, Math.sin(a + Math.PI * 3 / 4) * R, 0); }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3)); return g;
    })();
    const rings = []; const N = 18, gap = 9;
    for (let i = 0; i < N; i++) {
      const m = new THREE.LineSegments(ringGeo, new THREE.LineBasicMaterial({ color: '#ffc45a', transparent: true, opacity: 1, fog: false }));
      m.userData.z0 = -i * gap; rings.push(m); scene.add(m);
    }
    const tiles = new THREE.Group(); const r = rng(44);
    const tileGeo = new THREE.CircleGeometry(0.5, 8);
    for (let i = 0; i < 160; i++) {
      const a = r() * Math.PI * 2, rad = 11 + r() * 5, z = -r() * N * gap;
      const m = new THREE.Mesh(tileGeo, new THREE.MeshBasicMaterial({ color: r() < 0.5 ? '#d9a441' : '#7a5418', transparent: true, opacity: 0.6, fog: false }));
      m.position.set(Math.cos(a) * rad, Math.sin(a) * rad, z); m.rotation.z = a; m.userData.z0 = z; tiles.add(m);
    }
    scene.add(tiles, dust(300, [30, 30, 120], '#ffd38a', 1.6, 6, 0.0));
    const L = N * gap;
    return { scene, update(t) {
      for (const m of rings) { const z = ((m.userData.z0 + t * 6) % L + L) % L - L + 8; m.position.z = z; m.rotation.z = t * 0.08 + z * 0.01; m.material.opacity = 0.85 * Math.min(1, Math.max(0, (z + L) / (L * 0.6))) * (z > -2 ? Math.max(0, (6 - z) / 8) : 1); }
      for (const m of tiles.children) { m.position.z = ((m.userData.z0 + t * 6) % L + L) % L - L + 8; }
      tiles.rotation.z = -t * 0.05; } };
  },

  bulut() {
    const scene = new THREE.Scene();
    const sunDir = new THREE.Vector3(-0.35, 0.1, -1).normalize();
    scene.add(skyDome('#0b1e4e', '#e09a66', '#f5c08a', { sun: { dir: sunDir.toArray(), color: '#ffcf8a' } }));
    const cloudMat = (y, scale, density, alphaMul) => new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide, fog: false,
      uniforms: { t: { value: 0 }, sunDir: { value: sunDir }, lit: { value: new THREE.Color('#fff0dc') }, shade: { value: new THREE.Color('#5b3f63') }, hor: { value: new THREE.Color('#f0a874') }, sc: { value: scale }, dens: { value: density }, am: { value: alphaMul } },
      vertexShader: `varying vec3 vW; void main(){ vec4 w = modelMatrix*vec4(position,1.0); vW = w.xyz; gl_Position = projectionMatrix*viewMatrix*w; }`,
      fragmentShader: `${NOISE} uniform float t, sc, dens, am; uniform vec3 sunDir, lit, shade, hor; varying vec3 vW;
        void main(){ vec2 p = vW.xz*sc + vec2(t*0.012, t*0.004); float d = fbm(p) * 0.65 + fbm(p*2.7 + 3.1) * 0.35;
          float a = smoothstep(dens, dens + 0.28, d); float hi = smoothstep(dens + 0.05, dens + 0.45, fbm(p + vec2(0.04, 0.0)*sunDir.x));
          vec3 c = mix(shade, lit, clamp(hi*1.4, 0.0, 1.0)); float dist = length(vW.xz - cameraPosition.xz); float far = smoothstep(80.0, 420.0, dist);
          c = mix(c, hor, far*0.85); gl_FragColor = vec4(c, a * am * (1.0 - smoothstep(380.0, 470.0, dist))); }`
    });
    const lowMat = cloudMat(-6, 0.05, 0.46, 1.0), highMat = cloudMat(40, 0.012, 0.6, 0.35);
    const low = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 1, 1), lowMat); low.rotation.x = -Math.PI / 2; low.position.y = -5;
    const high = new THREE.Mesh(new THREE.PlaneGeometry(1000, 1000, 1, 1), highMat); high.rotation.x = -Math.PI / 2; high.position.y = 45;
    scene.add(low, high);
    scene.add(glowSprite('#ffd79a', 46, sunDir.clone().multiplyScalar(300).toArray(), 0.95));
    const motes = dust(140, [50, 24, 30], '#fff2dc', 1.2, 19, 0.03);
    scene.add(motes);
    return { scene, update(t) { motes.userData.update(t); lowMat.uniforms.t.value = t; highMat.uniforms.t.value = t; } };
  },

  soyut() {
    const scene = new THREE.Scene();
    scene.add(skyDome('#04020c', '#0b0620', '#020108'));
    const ribbons = [];
    const cols = ['#4af2ff', '#b06cff', '#ff5fb8', '#5c7dff'];
    for (let i = 0; i < 4; i++) {
      const geo = new THREE.PlaneGeometry(160, 16, 200, 1);
      const mat = new THREE.ShaderMaterial({
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
        uniforms: { t: { value: 0 }, col: { value: new THREE.Color(cols[i]) }, ph: { value: i * 1.7 } },
        vertexShader: `uniform float t, ph; varying vec2 vUv; void main(){ vUv=uv; vec3 p=position; p.y += sin(p.x*0.05 + t*0.6 + ph)*6.0 + sin(p.x*0.11 - t*0.4 + ph*2.0)*2.5; p.z += cos(p.x*0.04 + t*0.3 + ph)*8.0; gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.0);} `,
        fragmentShader: `${NOISE} uniform float t, ph; uniform vec3 col; varying vec2 vUv; void main(){ float band = pow(sin(vUv.y*3.14159), 3.0); float n = fbm(vec2(vUv.x*8.0 - t*0.3 + ph, vUv.y*2.0)); float a = band*(0.25+0.55*n)*0.55; gl_FragColor = vec4(col*a, a); }`
      });
      const m = new THREE.Mesh(geo, mat); m.position.set(0, (i - 1.5) * 5, -30 - i * 8); m.rotation.z = (i - 1.5) * 0.15;
      ribbons.push(m); scene.add(m);
    }
    const sp = dust(900, [80, 50, 60], '#cfd8ff', 1.4, 23, 0.1);
    scene.add(sp);
    return { scene, update(t) { sp.userData.update(t); for (const m of ribbons) m.material.uniforms.t.value = t; } };
  }
};

const cache = new Map();
export function getScene(type) {
  if (!BUILDERS[type]) type = 'yildiz';
  if (!cache.has(type)) cache.set(type, BUILDERS[type]());
  return cache.get(type);
}
export function setPointScale(s) {
  for (const sc of cache.values()) sc.scene.traverse(o => { if (o.userData && o.userData.mat && o.userData.mat.uniforms.scale) o.userData.mat.uniforms.scale.value = s; });
}
export const SCENE_TYPES = Object.keys(BUILDERS);

/** AI görseli sahnesi: görsel uzak bir düzlemde, önünde ışık tozu; kamera hareketiyle derinlik hissi */
export function imageScene(id, img) {
  const key = 'img:' + id;
  if (cache.has(key)) return cache.get(key);
  const scene = new THREE.Scene();
  scene.add(skyDome('#05060a', '#0b0d14', '#05060a'));
  const tex = new THREE.Texture(img); tex.colorSpace = THREE.SRGBColorSpace; tex.needsUpdate = true;
  const z = -40, dist = 50, visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(20)) * 1.55;
  const ar = (img.naturalWidth || img.width) / Math.max(1, img.naturalHeight || img.height);
  const h = Math.max(visH, visH * (16 / 9) / ar), w = h * ar;
  const plane = new THREE.Mesh(new THREE.PlaneGeometry(w, h), new THREE.MeshBasicMaterial({ map: tex, fog: false }));
  plane.position.z = z; scene.add(plane);
  const motes = dust(260, [40, 30, 30], '#fff2dc', 1.4, 31, 0.04);
  scene.add(motes);
  const sc = { scene, update(t) { motes.userData.update(t); const k = 1 + 0.03 * Math.sin(t * 0.07); plane.scale.set(k, k, 1); } };
  cache.set(key, sc);
  return sc;
}
