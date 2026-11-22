// Hızlı çekim çözme: MP4'ü ayrıştırıp WebCodecs VideoDecoder ile kareleri sırayla çözer.
// Video çıktısı ileriye doğru ilerlediği için her kare için "ileri sarma" yapmaya gerek kalmaz.
let MP4Box = null;
async function lib() { if (!MP4Box) { const m = await import('../../vendor/mp4box.js'); MP4Box = m.default; MP4Box.DataStream = m.DataStream || MP4Box.DataStream; } return MP4Box; }

function descriptionOf(trak, DS) {
  for (const e of trak.mdia.minf.stbl.stsd.entries) {
    const box = e.avcC || e.hvcC || e.vpcC || e.av1C;
    if (box) { const s = new DS(undefined, 0, DS.BIG_ENDIAN); box.write(s); return new Uint8Array(s.buffer, 8); }
  }
  return undefined;
}

export class ClipDecoder {
  static async create(blob) {
    if (!('VideoDecoder' in window)) return null;
    const M = await lib(); const buf = await blob.arrayBuffer();
    const d = new ClipDecoder();
    const ok = await new Promise(res => {
      const f = M.createFile(); let track = null; const samples = [];
      f.onError = () => res(false);
      f.onReady = info => {
        track = info.videoTracks[0]; if (!track) return res(false);
        d.track = track; d.ts = track.timescale; d.desc = descriptionOf(f.getTrackById(track.id), M.DataStream);
        f.setExtractionOptions(track.id, null, { nbSamples: 1e9 }); f.start();
      };
      f.onSamples = (id, user, ss) => { for (const s of ss) samples.push({ data: s.data, cts: s.cts, dur: s.duration, key: s.is_sync }); d.samples = samples; };
      buf.fileStart = 0; f.appendBuffer(buf); f.flush();
      setTimeout(() => res(!!(d.track && d.samples && d.samples.length)), 0);
    });
    if (!ok) return null;
    const cfg = { codec: d.track.codec, codedWidth: d.track.video.width, codedHeight: d.track.video.height, description: d.desc };
    try { const sup = await VideoDecoder.isConfigSupported(cfg); if (!sup.supported) return null; } catch (e) { return null; }
    d.cfg = cfg; d.frames = []; d.next = 0; d.wake = null; d.makeDecoder();
    return d;
  }
  makeDecoder() {
    if (this.dec && this.dec.state !== 'closed') try { this.dec.close(); } catch (e) { }
    this.dec = new VideoDecoder({ output: f => { this.frames.push(f); if (this.wake) { const w = this.wake; this.wake = null; w(); } }, error: e => { this.err = e; if (this.wake) { const w = this.wake; this.wake = null; w(); } } });
    this.dec.configure(this.cfg); this.next = 0;
    for (const f of this.frames) f.close(); this.frames = [];
  }
  seek(tt) { // tt: zaman ölçeği biriminde; öncesindeki son anahtar kareden başla
    this.makeDecoder();
    let k = 0; for (let i = 0; i < this.samples.length; i++) { if (this.samples[i].key && this.samples[i].cts <= tt) k = i; if (this.samples[i].cts > tt && this.samples[i].key) break; }
    this.next = k;
  }
  /** t saniyedeki (t'yi geçmeyen en yakın) kare; döndürülen kare bir sonraki çağrıya kadar geçerlidir */
  async frameAt(t) {
    const tt = t * this.ts;
    const last = this.frames[this.frames.length - 1];
    if (this.next === 0 && !this.frames.length) this.seek(tt);
    else if (this.lastTT != null && tt < this.lastTT - this.ts * 0.04) this.seek(tt); // geriye gidildi
    else if (last == null && this.next < this.samples.length && this.samples[this.next].cts > tt + this.ts * 2) this.seek(tt);
    this.lastTT = tt;
    for (let guard = 0; guard < 2000; guard++) {
      if (this.err) return null;
      // tt'yi geçen bir kare çözüldüyse, tt'den küçük/eşit en son kare cevaptır
      const fr = this.frames;
      const after = fr.findIndex(f => f.timestamp > tt * 1e6 / this.ts + 1);
      if (after > 0 || (after === -1 && this.next >= this.samples.length && this.dec.decodeQueueSize === 0)) {
        const idx = after > 0 ? after - 1 : fr.length - 1; if (idx < 0) return null;
        for (let i = 0; i < idx; i++) fr[i].close(); this.frames = fr.slice(idx); return this.frames[0];
      }
      if (after === 0) return fr[0]; // istenen andan sonraki ilk kare (başlangıçta)
      if (this.next < this.samples.length && this.dec.decodeQueueSize < 6) {
        const s = this.samples[this.next++];
        this.dec.decode(new EncodedVideoChunk({ type: s.key ? 'key' : 'delta', timestamp: s.cts * 1e6 / this.ts, duration: s.dur * 1e6 / this.ts, data: s.data }));
        continue;
      }
      if (this.next >= this.samples.length && this.dec.decodeQueueSize === 0) { await this.dec.flush().catch(() => { }); continue; }
      await new Promise(r => { this.wake = r; setTimeout(r, 50); });
    }
    return this.frames[this.frames.length - 1] || null;
  }
  close() { for (const f of this.frames) f.close(); this.frames = []; try { this.dec.close(); } catch (e) { } }
}
