// Video kodlama: WebCodecs ile hızlı MP4, yoksa gerçek zamanlı MediaRecorder
import { Muxer, ArrayBufferTarget } from '../vendor/mp4-muxer.mjs';
import { SR } from './audio.js';

const VCODECS = ['avc1.640033', 'avc1.64002A', 'avc1.640028', 'avc1.4D4033', 'avc1.4D4028', 'avc1.42E033', 'avc1.42E028', 'avc1.42E01F'];

export const hasFast = () => 'VideoEncoder' in window && 'VideoFrame' in window;

async function pickVideo(W, H, fps, bitrate) {
  for (const codec of VCODECS) {
    const cfg = { codec, width: W, height: H, bitrate, framerate: fps, avc: { format: 'avc' } };
    try { const r = await VideoEncoder.isConfigSupported(cfg); if (r.supported) return cfg; } catch (e) { }
  }
  return null;
}
async function pickAudio() {
  if (!('AudioEncoder' in window)) return null;
  for (const [codec, mux] of [['mp4a.40.2', 'aac'], ['opus', 'opus']]) {
    const cfg = { codec, sampleRate: SR, numberOfChannels: 2, bitrate: 192000 };
    try { const r = await AudioEncoder.isConfigSupported(cfg); if (r.supported) return { cfg, mux }; } catch (e) { }
  }
  return null;
}

const tick = () => new Promise(r => setTimeout(r, 0));

/**
 * renderAt(t): kanvasa t anındaki kareyi çizer (async olabilir).
 * audio: AudioBuffer (48 kHz) ya da null.
 */
export async function encodeFast({ canvas, W, H, fps, dur, bitrate, renderAt, audio, onProgress, cancelled }) {
  const vcfg = await pickVideo(W, H, fps, bitrate);
  if (!vcfg) throw new Error('NO_FAST');
  const ac = audio ? await pickAudio() : null;
  const target = new ArrayBufferTarget();
  const muxer = new Muxer({
    target,
    video: { codec: 'avc', width: W, height: H, frameRate: fps },
    audio: ac ? { codec: ac.mux, numberOfChannels: 2, sampleRate: SR } : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset'
  });
  let err = null;
  const ve = new VideoEncoder({ output: (c, m) => muxer.addVideoChunk(c, m), error: e => (err = e) });
  ve.configure(vcfg);
  const N = Math.max(1, Math.round(dur * fps));
  const fdur = Math.round(1e6 / fps);
  try {
    for (let i = 0; i < N; i++) {
      if (cancelled()) throw new Error('CANCEL');
      if (err) throw err;
      await renderAt(i / fps);
      const f = new VideoFrame(canvas, { timestamp: Math.round(i * 1e6 / fps), duration: fdur });
      ve.encode(f, { keyFrame: i % (fps * 2) === 0 });
      f.close();
      while (ve.encodeQueueSize > 6) await new Promise(r => setTimeout(r, 2));
      if (i % 4 === 0) { onProgress(i / N * (ac ? 0.93 : 0.98)); await tick(); }
    }
    await ve.flush();
  } finally { try { ve.close(); } catch (e) { } }

  if (ac) {
    const ae = new AudioEncoder({ output: (c, m) => muxer.addAudioChunk(c, m), error: e => (err = e) });
    ae.configure(ac.cfg);
    const L = audio.getChannelData(0), R = audio.numberOfChannels > 1 ? audio.getChannelData(1) : L;
    const total = Math.min(audio.length, Math.ceil(dur * SR)), block = 4800;
    for (let s = 0; s < total; s += block) {
      const n = Math.min(block, total - s);
      const data = new Float32Array(n * 2); data.set(L.subarray(s, s + n), 0); data.set(R.subarray(s, s + n), n);
      const ad = new AudioData({ format: 'f32-planar', sampleRate: SR, numberOfFrames: n, numberOfChannels: 2, timestamp: Math.round(s / SR * 1e6), data });
      ae.encode(ad); ad.close();
      if (ae.encodeQueueSize > 20) await ae.flush();
    }
    await ae.flush(); ae.close();
  }
  if (err) throw err;
  muxer.finalize();
  onProgress(1);
  return { blob: new Blob([target.buffer], { type: 'video/mp4' }), ext: 'mp4', audioCodec: ac ? ac.mux : null };
}

function pickMime() {
  for (const m of ['video/mp4;codecs=avc1.640028,mp4a.40.2', 'video/mp4', 'video/webm;codecs=vp9,opus', 'video/webm'])
    if (window.MediaRecorder && MediaRecorder.isTypeSupported(m)) return m;
  return '';
}

/** Yedek yol: gerçek zamanlı kayıt. renderLive(t) eşzamanlı çizim yapmalı. */
export function encodeRealtime({ canvas, fps, dur, bitrate, renderLive, startMedia, audio, audioCtx, onProgress, cancelled }) {
  return new Promise((resolve, reject) => {
    const stream = canvas.captureStream(fps);
    let srcNode = null;
    if (audio && audioCtx) {
      const dest = audioCtx.createMediaStreamDestination();
      srcNode = audioCtx.createBufferSource(); srcNode.buffer = audio; srcNode.connect(dest);
      dest.stream.getAudioTracks().forEach(t => stream.addTrack(t));
    }
    const mime = pickMime();
    let rec;
    try { rec = new MediaRecorder(stream, { mimeType: mime || undefined, videoBitsPerSecond: bitrate }); }
    catch (e) { rec = new MediaRecorder(stream); }
    const chunks = [];
    rec.ondataavailable = e => e.data && e.data.size && chunks.push(e.data);
    rec.onstop = () => {
      stream.getTracks().forEach(t => t.stop());
      if (cancelled()) return reject(new Error('CANCEL'));
      const type = rec.mimeType || 'video/webm';
      resolve({ blob: new Blob(chunks, { type }), ext: type.includes('mp4') ? 'mp4' : 'webm' });
    };
    renderLive(0);
    rec.start(250);
    startMedia && startMedia();
    if (srcNode) srcNode.start();
    const t0 = performance.now();
    const step = () => {
      const t = (performance.now() - t0) / 1000;
      if (cancelled() || t >= dur) { renderLive(Math.min(t, dur)); setTimeout(() => rec.state !== 'inactive' && rec.stop(), 120); return; }
      renderLive(t); onProgress(t / dur);
      requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  });
}
