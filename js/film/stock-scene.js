// Gerçek video çekimi sahnesi: arka planda çekim (ekranı kaplar), çekimler arasında yumuşak geçiş, önde hafif ışık tozu.
import * as THREE from '../../vendor/three-bundle.js?v=202611221445';
import { dust } from './scenes.js?v=202611221445';

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
    this.motes = dust(160, [40, 30, 30], '#fff4e0', 1.1, 47, 0.03);
    this.scene.add(this.motes);
  }
  /** plan: [{video, alpha}] — ilk eleman arkada, ikinci (geçişteki) önde */
  set(plan, t) {
    const dist = 50, visH = 2 * dist * Math.tan(THREE.MathUtils.degToRad(20)) * 1.5;
    const fit = (mesh, e) => {
      if (!e) { mesh.visible = false; return; }
      const v = e.video, tex = texOf(v);
      if (v.readyState >= 2) tex.needsUpdate = true;
      mesh.material.map = tex; mesh.material.needsUpdate = mesh.material._map !== tex; mesh.material._map = tex;
      mesh.material.opacity = e.alpha;
      const ar = (v.videoWidth || 16) / Math.max(1, v.videoHeight || 9);
      const h = Math.max(visH, visH * (16 / 9) / ar), w = h * ar;
      const k = 1 + 0.025 * Math.sin(t * 0.06);
      mesh.scale.set(w * k, h * k, 1); mesh.visible = true;
    };
    fit(this.back, plan[0]); fit(this.front, plan[1]);
    this.motes.userData.update(t);
  }
}
