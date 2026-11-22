// Gerçek video çekimi sahnesi: arka planda çekim (ekranı kaplar), çekimler arasında yumuşak geçiş, önde hafif ışık tozu.
import * as THREE from '../../vendor/three-bundle.js?v=202611221556';
import { dust } from './scenes.js?v=202611221556';

const texCache = new WeakMap();
function texOf(video) {
  let t = texCache.get(video);
  if (!t) { t = new THREE.VideoTexture(video); t.colorSpace = THREE.SRGBColorSpace; t.minFilter = THREE.LinearFilter; t.magFilter = THREE.LinearFilter; t.generateMipmaps = false; texCache.set(video, t); }
  return t;
}

export class StockScene {
  constructor() {
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color('#000000');
    const mk = (z, transparent) => {
      const m = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent, opacity: 1, depthWrite: !transparent, fog: false, toneMapped: false });
      const p = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); p.position.z = z; p.visible = false; this.scene.add(p); return p;
    };
    this.back = mk(-40, false); this.front = mk(-39.9, true);
    // yazının okunması için: ortası hafif, kenarları biraz daha koyu bir karartma katmanı
    const shade = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, depthTest: false, toneMapped: false, fog: false,
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy * 2.0, 0.0, 1.0); }',
      fragmentShader: 'varying vec2 vUv; void main(){ float d = length((vUv - 0.5) * vec2(1.0, 1.25)); float a = 0.30 + 0.25 * smoothstep(0.2, 0.75, d); gl_FragColor = vec4(0.0, 0.0, 0.0, a); }'
    });
    this.shade = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), shade); this.shade.frustumCulled = false; this.shade.renderOrder = 10; this.scene.add(this.shade);
    this.motes = dust(160, [40, 30, 30], '#fff4e0', 1.1, 47, 0.03);
    this.scene.add(this.motes);
  }
  /** plan: [{video, alpha}] — ilk eleman arkada, ikinci (geçişteki) önde */
  set(plan, t, flow = false) {
    const dist = 50, visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(20)) * 1.5;
    const fit = (mesh, e) => {
      if (!e) { mesh.visible = false; return; }
      const v = e.video, tex = texOf(v);
      if (v.readyState >= 2) tex.needsUpdate = true;
      mesh.material.map = tex; mesh.material.needsUpdate = mesh.material._map !== tex; mesh.material._map = tex;
      mesh.material.opacity = e.alpha;
      const g = e.gain || [1, 1, 1]; mesh.material.color.setRGB(g[0], g[1], g[2]);
      const ar = (v.videoWidth || 16) / Math.max(1, v.videoHeight || 9);
      const h = Math.max(visH, visH * (16 / 9) / ar), w = h * ar;
      // akışta tek, kesintisiz yavaş hareket (çekim değişse de kamera aynı yolda devam eder)
      const k = flow ? 1.07 + 0.035 * Math.sin(t * 0.045) : 1 + 0.025 * Math.sin(t * 0.06);
      mesh.scale.set(w * k, h * k, 1); mesh.visible = true;
      if (flow) mesh.position.set(Math.sin(t * 0.031) * w * 0.012, Math.cos(t * 0.027) * h * 0.008, mesh.position.z); else mesh.position.set(0, 0, mesh.position.z);
    };
    fit(this.back, plan[0]); fit(this.front, plan[1]);
    this.motes.userData.update(t);
  }
}
