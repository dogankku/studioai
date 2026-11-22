// Son işlem: geçiş karıştırma, ışıma, renk derecelendirme ve film efektleri
import * as THREE from '../../vendor/three-bundle.js?v=202611221956';
import { EffectComposer, UnrealBloomPass, ShaderPass, OutputPass, Pass, FullScreenQuad } from '../../vendor/three-bundle.js?v=202611221956';

const TRANS_IDS = { fade: 0, dip: 1, flash: 2, zoom: 3, whip: 4, glitch: 5, luma: 6, circle: 7, wipe: 8, cut: 9 };

const transitionShader = {
  uniforms: { tA: { value: null }, tB: { value: null }, p: { value: 0 }, kind: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, seed: { value: 0 } },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }`,
  fragmentShader: `
    uniform sampler2D tA, tB; uniform float p, seed; uniform int kind; uniform vec2 res; varying vec2 vUv;
    float hash(vec2 p){ p += seed; vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    vec4 zoomBlur(sampler2D t, vec2 uv, float amt, float sc){ vec4 c = vec4(0.0); vec2 d = uv - 0.5; for (int i=0;i<14;i++){ float f = float(i)/13.0; c += texture2D(t, 0.5 + d*(sc - amt*f)); } return c/14.0; }
    vec4 dirBlur(sampler2D t, vec2 uv, vec2 dir){ vec4 c = vec4(0.0); for (int i=0;i<16;i++){ float f = float(i)/15.0 - 0.5; c += texture2D(t, uv + dir*f); } return c/16.0; }
    void main(){
      vec2 uv = vUv; vec4 a = texture2D(tA, uv), b = texture2D(tB, uv); vec4 c;
      if (kind == 0) c = mix(a, b, smoothstep(0.0, 1.0, p));
      else if (kind == 1) c = p < 0.5 ? mix(a, vec4(0,0,0,1), p*2.0) : mix(vec4(0,0,0,1), b, (p-0.5)*2.0);
      else if (kind == 2) { c = mix(a, b, smoothstep(0.42, 0.58, p)); float f = 1.0 - abs(p-0.5)*2.0; c.rgb += vec3(1.0,0.95,0.85) * pow(f, 2.5) * 3.0; }
      else if (kind == 3) { if (p < 0.5) c = zoomBlur(tA, uv, p*0.6, 1.0 - p*0.3); else c = zoomBlur(tB, uv, (1.0-p)*0.6, 1.0 + (1.0-p)*0.3); }
      else if (kind == 4) { float s = smoothstep(0.0,1.0,p); vec2 ua = uv + vec2(s, 0.0), ub = uv + vec2(s - 1.0, 0.0); float bl = sin(p*3.14159)*0.25;
        c = (ua.x <= 1.0) ? dirBlur(tA, ua, vec2(bl,0.0)) : dirBlur(tB, ub, vec2(bl,0.0)); }
      else if (kind == 5) { vec2 blk = floor(uv * vec2(14.0, 26.0)); float r = hash(blk + floor(p*12.0)); vec2 off = vec2((hash(blk*1.3)-0.5)*0.12*sin(p*3.14159), 0.0);
        bool useB = r < p; vec4 s1 = useB ? texture2D(tB, uv+off) : texture2D(tA, uv+off);
        float sp = 0.012*sin(p*3.14159); vec4 sr = useB ? texture2D(tB, uv+off+vec2(sp,0.0)) : texture2D(tA, uv+off+vec2(sp,0.0)); vec4 sb = useB ? texture2D(tB, uv+off-vec2(sp,0.0)) : texture2D(tA, uv+off-vec2(sp,0.0));
        c = vec4(sr.r, s1.g, sb.b, 1.0); }
      else if (kind == 6) { float n = noise(uv*vec2(5.0, 9.0)) * 0.7 + noise(uv*28.0)*0.3; c = mix(a, b, smoothstep(p*1.3-0.2, p*1.3, n)); c = mix(a, b, 1.0 - smoothstep(p*1.25-0.15, p*1.25, n)); }
      else if (kind == 7) { vec2 d = (uv-0.5) * vec2(res.x/res.y, 1.0); float r = p*1.3; c = mix(b, a, smoothstep(r-0.03, r, length(d))); }
      else if (kind == 8) { float e = uv.x*0.7 + uv.y*0.3; c = mix(a, b, smoothstep(p*1.3-0.25, p*1.3-0.05, 1.0-e)); }
      else c = p < 0.5 ? a : b;
      gl_FragColor = c;
    }`
};

const uberShader = {
  uniforms: {
    tDiffuse: { value: null }, time: { value: 0 }, res: { value: new THREE.Vector2(1, 1) }, pulse: { value: 0 },
    exposure: { value: 0 }, contrast: { value: 1 }, saturation: { value: 1 }, temperature: { value: 0 }, tint: { value: 0 },
    lift: { value: new THREE.Vector3() }, gammaV: { value: new THREE.Vector3(1, 1, 1) }, gain: { value: new THREE.Vector3(1, 1, 1) },
    shadowTint: { value: new THREE.Vector3() }, highlightTint: { value: new THREE.Vector3() }, splitAmount: { value: 0 }, bw: { value: 0 },
    grain: { value: 0 }, vignette: { value: 0 }, ca: { value: 0 }, scanlines: { value: 0 }, vhs: { value: 0 }, glitch: { value: 0 },
    pixelate: { value: 0 }, posterize: { value: 0 }, lightLeak: { value: 0 }, letterbox: { value: 0 }, gateWeave: { value: 0 }, dust: { value: 0 }, halation: { value: 0 },
    fade: { value: 0 }
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float time, pulse, exposure, contrast, saturation, temperature, tint, splitAmount, bw;
    uniform vec3 lift, gammaV, gain, shadowTint, highlightTint; uniform vec2 res;
    uniform float grain, vignette, ca, scanlines, vhs, glitch, pixelate, posterize, lightLeak, letterbox, gateWeave, dust, halation, fade;
    varying vec2 vUv;
    float hash(vec2 p){ vec3 p3 = fract(vec3(p.xyx) * 0.1031); p3 += dot(p3, p3.yzx + 33.33); return fract((p3.x + p3.y) * p3.z); }
    float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.0-2.0*f); return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
    vec3 samp(vec2 uv){ return texture2D(tDiffuse, clamp(uv, 0.001, 0.999)).rgb; }
    void main(){
      vec2 uv = vUv; float fr = floor(time*24.0);
      if (gateWeave > 0.0) uv += vec2(hash(vec2(fr,1.0))-0.5, hash(vec2(fr,2.0))-0.5) * 0.003 * gateWeave;
      if (pixelate > 0.0) { float px = mix(1.0, 18.0, pixelate) ; vec2 g = res / px; uv = (floor(uv*g)+0.5)/g; }
      if (vhs > 0.0) { float line = floor(uv.y*res.y/3.0); float j = (hash(vec2(line, fr))-0.5) * 0.004 * vhs; float band = step(0.985, noise(vec2(uv.y*6.0 - time*0.7, fr*0.1))); uv.x += j + band*0.02*vhs; }
      if (glitch > 0.0) { float g = glitch * (0.25 + pulse); vec2 blk = floor(uv*vec2(10.0, 32.0)); float r = hash(blk + fr); if (r > 1.0 - 0.18*g) uv.x += (hash(blk*3.1+fr)-0.5)*0.15*g; }
      vec3 col;
      float caAmt = (ca + vhs*0.6 + glitch*pulse*0.8) * 0.006;
      if (caAmt > 0.0) { vec2 d = (uv-0.5); col = vec3(samp(uv + d*caAmt*2.0).r, samp(uv).g, samp(uv - d*caAmt*2.0).b); }
      else col = samp(uv);
      if (halation > 0.0) { vec3 h = vec3(0.0); for (int i=0;i<8;i++){ float a = float(i)*0.785; h += samp(uv + vec2(cos(a), sin(a))*0.006); } h /= 8.0; float l = max(max(h.r,h.g),h.b); col += vec3(1.0,0.25,0.1) * smoothstep(0.6, 1.0, l) * 0.35 * halation; }
      // renk derecelendirme
      col *= exp2(exposure);
      col *= vec3(1.0 + temperature*0.12 + tint*0.04, 1.0 - tint*0.08, 1.0 - temperature*0.12 + tint*0.04);
      col = pow(max(col * gain + lift * (1.0 - col), 0.0), 1.0 / gammaV);
      float luma = dot(col, vec3(0.2126, 0.7152, 0.0722));
      col = mix(vec3(luma), col, saturation);
      col = (col - 0.5) * contrast + 0.5;
      if (splitAmount > 0.0) { float l2 = clamp(luma, 0.0, 1.0); col += splitAmount * (shadowTint * (1.0 - l2) * (1.0 - l2) * 0.6 + highlightTint * l2 * l2 * 0.35 - 0.1 * (shadowTint+highlightTint)*0.0); }
      if (bw > 0.0) col = mix(col, vec3(dot(col, vec3(0.3, 0.59, 0.11))), bw);
      if (lightLeak > 0.0) { vec2 c1 = vec2(0.1 + 0.25*sin(time*0.21), 0.85 + 0.1*cos(time*0.17)); vec2 c2 = vec2(0.95, 0.2 + 0.3*sin(time*0.13+1.0));
        float l1 = smoothstep(0.75, 0.0, distance(uv, c1)); float l2b = smoothstep(0.6, 0.0, distance(uv, c2));
        col += lightLeak * (vec3(1.0, 0.45, 0.15)*l1*0.55 + vec3(1.0, 0.25, 0.45)*l2b*0.35) * (0.7 + 0.3*sin(time*0.9)); }
      if (posterize > 0.0) { float lv = mix(24.0, 5.0, posterize); float dth = (hash(floor(vUv*res/2.0)) - 0.5) / lv; col = floor((col + dth) * lv + 0.5) / lv; }
      if (scanlines > 0.0) col *= 1.0 - scanlines * 0.22 * (0.5 + 0.5*sin(vUv.y*res.y*1.6));
      if (dust > 0.0) { float s = step(0.9985 - dust*0.0015, hash(floor(vUv*res/3.0) + fr)); col = mix(col, vec3(0.9), s*0.6);
        float sx = hash(vec2(fr, 7.0)); float scratch = smoothstep(0.0015, 0.0, abs(vUv.x - sx)) * step(0.7, hash(vec2(fr, 9.0))); col = mix(col, vec3(0.85), scratch * dust * 0.5); }
      if (grain > 0.0) { float g = hash(vUv*res + fr*13.0) - 0.5; col += g * grain * (1.2 - luma*0.6); }
      if (vignette > 0.0) { vec2 d = (vUv - 0.5) * vec2(1.0, res.y/res.x*0.6 + 0.4); col *= 1.0 - vignette * smoothstep(0.25, 0.85, length(d)*1.25); }
      if (letterbox > 0.0) { float ar = res.x/res.y; float target = ar < 1.0 ? 0.0 : 0.0; float bar = ar >= 1.0 ? (1.0 - ar/2.39)*0.5 : 0.085; bar *= letterbox; if (vUv.y < bar || vUv.y > 1.0 - bar) col = vec3(0.0); }
      col = mix(col, vec3(0.0), fade);
      gl_FragColor = vec4(clamp(col, 0.0, 1.0), 1.0);
    }`
};

class SourcePass extends Pass {
  constructor(renderer, W, H) {
    super();
    this.needsSwap = false;
    const opt = { type: THREE.HalfFloatType, colorSpace: THREE.LinearSRGBColorSpace };
    this.rtA = new THREE.WebGLRenderTarget(W, H, opt);
    this.rtB = new THREE.WebGLRenderTarget(W, H, opt);
    this.mat = new THREE.ShaderMaterial(THREE.UniformsUtils ? { ...transitionShader, uniforms: THREE.UniformsUtils.clone(transitionShader.uniforms) } : transitionShader);
    this.mat.uniforms.res.value.set(W, H);
    this.quad = new FullScreenQuad(this.mat);
    this.job = null; // {a:{scene,camera}, b?:{scene,camera}, p, kind}
  }
  setSize(W, H) { this.rtA.setSize(W, H); this.rtB.setSize(W, H); this.mat.uniforms.res.value.set(W, H); }
  render(renderer, writeBuffer, readBuffer) {
    const j = this.job; if (!j) return;
    if (!j.b) { renderer.setRenderTarget(readBuffer); renderer.clear(); renderer.render(j.a.scene, j.a.camera); return; }
    renderer.setRenderTarget(this.rtA); renderer.clear(); renderer.render(j.a.scene, j.a.camera);
    renderer.setRenderTarget(this.rtB); renderer.clear(); renderer.render(j.b.scene, j.b.camera);
    this.mat.uniforms.tA.value = this.rtA.texture; this.mat.uniforms.tB.value = this.rtB.texture;
    this.mat.uniforms.p.value = j.p; this.mat.uniforms.kind.value = TRANS_IDS[j.kind] ?? 0; this.mat.uniforms.seed.value = j.seed || 0;
    renderer.setRenderTarget(readBuffer); this.quad.render(renderer);
  }
}

class TextPass extends Pass {
  constructor() { super(); this.needsSwap = false; this.scene = new THREE.Scene(); this.items = []; }
  render(renderer, writeBuffer, readBuffer) {
    if (!this.items.length) return;
    const ac = renderer.autoClear; renderer.autoClear = false;
    renderer.setRenderTarget(this.renderToScreen ? null : readBuffer);
    for (const it of this.items) { it.group.position.copy(it.target); it.group.quaternion.copy(it.camera.quaternion); this.scene.add(it.group); renderer.render(this.scene, it.camera); this.scene.remove(it.group); }
    renderer.autoClear = ac;
  }
}

export class Post {
  constructor(renderer, W, H) {
    this.renderer = renderer;
    this.composer = new EffectComposer(renderer, new THREE.WebGLRenderTarget(W, H, { type: THREE.HalfFloatType }));
    this.composer.setPixelRatio(1); this.composer.setSize(W, H);
    this.source = new SourcePass(renderer, W, H);
    this.bloom = new UnrealBloomPass(new THREE.Vector2(W, H), 0.6, 0.5, 0.75);
    this.output = new OutputPass();
    this.uber = new ShaderPass({ ...uberShader, uniforms: THREE.UniformsUtils.clone(uberShader.uniforms) });
    this.uber.uniforms.res.value.set(W, H);
    this.text = new TextPass();
    this.composer.addPass(this.source); this.composer.addPass(this.bloom); this.composer.addPass(this.output); this.composer.addPass(this.text); this.composer.addPass(this.uber);
  }
  setSize(W, H) { this.composer.setSize(W, H); this.source.setSize(W, H); this.uber.uniforms.res.value.set(W, H); }
  apply(style, fxOverride = {}) {
    const g = style.grade, f = { ...style.fx, ...fxOverride }, U = this.uber.uniforms;
    for (const k of ['exposure', 'contrast', 'saturation', 'temperature', 'tint', 'splitAmount', 'bw']) U[k].value = g[k];
    U.lift.value.set(...g.lift); U.gammaV.value.set(...g.gamma); U.gain.value.set(...g.gain);
    U.shadowTint.value.set(...g.shadowTint); U.highlightTint.value.set(...g.highlightTint);
    for (const k of ['grain', 'vignette', 'ca', 'scanlines', 'vhs', 'glitch', 'pixelate', 'posterize', 'lightLeak', 'letterbox', 'gateWeave', 'dust', 'halation']) U[k].value = f[k] || 0;
    this.bloom.strength = f.bloom; this.bloom.radius = f.bloomRadius; this.bloom.threshold = f.bloomThreshold;
    this.bloom.enabled = f.bloom > 0.01;
  }
  render(job, time, pulse = 0, fade = 0, texts = []) {
    this.source.job = job; this.text.items = texts;
    this.uber.uniforms.time.value = time; this.uber.uniforms.pulse.value = pulse; this.uber.uniforms.fade.value = fade;
    this.composer.render();
  }
}
