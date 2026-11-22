// Kamera hareketleri: çekim içi ilerleme p (0..1) ve yoğunluk k ile
import * as THREE from '../../vendor/three-bundle.js?v=202611221957';

const ease = p => p < .5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
const n1 = (t, s) => Math.sin(t * 1.7 + s) * 0.5 + Math.sin(t * 2.9 + s * 2.1) * 0.3 + Math.sin(t * 5.3 + s * 0.7) * 0.2;

export function applyCamera(cam, move, p, k, lt, seed = 0, aspect = 9 / 16) {
  const e = ease(Math.max(0, Math.min(1, p)));
  let x = 0, y = 0, z = 10, tx = 0, ty = 0, tz = 0, fov = 40, roll = 0;
  const K = 0.5 + k; // 0.5..1.5
  switch (move) {
    case 'yaklas': z = 11.8 - 2.6 * e * K; break;
    case 'uzaklas': z = 9.0 + 2.6 * e * K; break;
    case 'yorunge': { const a = (-0.32 + 0.64 * e) * K; x = Math.sin(a) * 10.5; z = Math.cos(a) * 10.5; break; }
    case 'vinc': y = (-1.6 + 3.2 * e) * K; ty = y * 0.35; z = 10.6; break;
    case 'kaydir': x = (-1.8 + 3.6 * e) * K; tx = x * 0.45; z = 10.3; break;
    case 'egim': ty = (1.4 - 2.2 * e) * K * 0.6; y = ty * 0.3; break;
    case 'el': x = n1(lt, seed) * 0.18 * K; y = n1(lt * 1.1, seed + 3) * 0.14 * K; roll = n1(lt * 0.8, seed + 7) * 0.012 * K; z = 10.2 - 0.5 * e; break;
    case 'dolly': { z = 13.5 - 5 * e * K * 0.8; const visH = 2 * 10 * Math.tan(THREE.MathUtils.degToRad(20)); fov = THREE.MathUtils.radToDeg(2 * Math.atan(visH / (2 * z))); break; }
    case 'akis': z = 10.4; break; // çekim akışı: kamera sabit, hareketi arka plan kendisi yapar (yazı değişince arka plan atlamasın)
    default: z = 10.4 - 0.5 * e; y = Math.sin(lt * 0.6 + seed) * 0.08; // nefes
  }
  cam.fov = fov; cam.aspect = aspect; cam.updateProjectionMatrix();
  cam.position.set(x, y, z);
  cam.up.set(Math.sin(roll), Math.cos(roll), 0);
  cam.lookAt(tx, ty, tz);
  return { target: new THREE.Vector3(tx, ty, tz) };
}
