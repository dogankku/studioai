// Film stilleri: renk derecelendirme + efekt + yönetmen tercihleri
// Renk değerleri doğrusal RGB çarpanları; efekt değerleri 0..1 arası yoğunluk.

export const GRADE_DEFAULT = {
  exposure: 0, contrast: 1, saturation: 1, temperature: 0, tint: 0,
  lift: [0, 0, 0], gamma: [1, 1, 1], gain: [1, 1, 1],
  shadowTint: [0, 0, 0], highlightTint: [0, 0, 0], splitAmount: 0, bw: 0
};
export const FX_DEFAULT = {
  bloom: 0.6, bloomRadius: 0.5, bloomThreshold: 0.75,
  grain: 0.04, vignette: 0.35, ca: 0, scanlines: 0, vhs: 0, glitch: 0, pixelate: 0, posterize: 0,
  lightLeak: 0, letterbox: 0, gateWeave: 0, dust: 0, halation: 0, sharpen: 0
};

export const EFFECTS = {
  bloom: 'Işıma', grain: 'Film greni', vignette: 'Vinyet', ca: 'Renk kayması', scanlines: 'Tarama çizgileri',
  vhs: 'VHS bozulması', glitch: 'Glitch', pixelate: 'Piksel', posterize: 'Posterleştirme', lightLeak: 'Işık sızıntısı',
  letterbox: 'Sinemaskop bant', gateWeave: 'Film titremesi', dust: 'Toz ve çizik', halation: 'Halation (kırmızı hale)'
};

export const SCENES = {
  yildiz: 'Yıldızlı gök', col: 'Çöl', deniz: 'Gece denizi', nur: 'Işık hüzmeleri', cami: 'Cami silüeti',
  desen: 'Geometrik tünel', bulut: 'Bulutlar', soyut: 'Soyut akış', gorsel: 'AI görseli', video: 'Gerçek çekim'
};
export const CAMERAS = {
  yaklas: 'Yaklaşma', uzaklas: 'Uzaklaşma', yorunge: 'Yörünge', vinc: 'Vinç (yükselme)', kaydir: 'Yana kayma',
  egim: 'Eğim', el: 'Elde çekim', nefes: 'Sakin nefes', dolly: 'Dolly zoom'
};
export const TEXT_ANIMS = {
  yuksel: 'Yükselerek', derinlik: 'Derinlikten', dagil: 'Dağılıp toplanma', donus: 'Dönerek', isik: 'Işıkla belirme', daktilo: 'Daktilo', tek: 'Tek tek büyük'
};
export const TRANSITIONS = {
  fade: 'Çapraz geçiş', dip: 'Karartma', flash: 'Işık patlaması', zoom: 'Yakınlaşma bulanıklığı', whip: 'Hızlı kaydırma',
  glitch: 'Glitch kesme', luma: 'Doku erimesi', circle: 'Daire açılma', wipe: 'Yumuşak silme', cut: 'Kesme'
};

const S = (o) => ({ ...o, grade: { ...GRADE_DEFAULT, ...(o.grade || {}) }, fx: { ...FX_DEFAULT, ...(o.fx || {}) } });

export const STYLES = {
  sinematik: S({
    name: 'Sinematik', desc: 'Teal & orange, sinemaskop bant, ince gren',
    grade: { contrast: 1.12, saturation: 1.05, shadowTint: [0.0, 0.35, 0.45], highlightTint: [1.0, 0.55, 0.2], splitAmount: 0.22, gain: [1.03, 1, 0.97] },
    fx: { bloom: 0.55, grain: 0.05, vignette: 0.45, letterbox: 1, ca: 0.15, halation: 0.25 },
    scenes: ['col', 'deniz', 'bulut', 'nur'], cameras: ['yaklas', 'kaydir', 'vinc', 'yorunge', 'dolly'], anims: ['yuksel', 'derinlik'],
    transitions: ['fade', 'dip', 'zoom'], text: '#fff4e6', accent: '#ffc27a', sub: '#e6d6c4', pace: 1
  }),
  nur: S({
    name: 'Nur', desc: 'Altın ışık, güçlü ışıma, ışık sızıntıları',
    grade: { exposure: 0.08, contrast: 1.05, saturation: 1.1, temperature: 0.35, highlightTint: [1, 0.8, 0.45], splitAmount: 0.18 },
    fx: { bloom: 1.1, bloomThreshold: 0.6, grain: 0.03, vignette: 0.4, lightLeak: 0.55, halation: 0.2 },
    scenes: ['nur', 'cami', 'bulut', 'col'], cameras: ['nefes', 'yaklas', 'vinc', 'yorunge'], anims: ['isik', 'yuksel'],
    transitions: ['flash', 'fade', 'luma'], text: '#fff8e8', accent: '#ffd27a', sub: '#f3e3c3', pace: 1.15
  }),
  gece: S({
    name: 'Gece', desc: 'Soğuk mavi, yıldızlar, derinlik',
    grade: { contrast: 1.1, saturation: 0.95, temperature: -0.35, shadowTint: [0.1, 0.2, 0.55], splitAmount: 0.2 },
    fx: { bloom: 0.8, grain: 0.04, vignette: 0.55, ca: 0.1 },
    scenes: ['yildiz', 'deniz', 'cami', 'desen'], cameras: ['yorunge', 'uzaklas', 'nefes', 'vinc'], anims: ['derinlik', 'isik'],
    transitions: ['dip', 'luma', 'fade'], text: '#eef4ff', accent: '#9fd0ff', sub: '#c4d2ea', pace: 1.1
  }),
  retro: S({
    name: 'Retro VHS', desc: '90\'lar kaseti: tarama çizgileri, renk kayması, bozulma',
    grade: { contrast: 1.05, saturation: 1.25, gamma: [1, 0.95, 1.05], lift: [0.04, 0.02, 0.06] },
    fx: { bloom: 0.5, grain: 0.1, vignette: 0.45, ca: 0.8, scanlines: 0.6, vhs: 0.55, gateWeave: 0.3 },
    scenes: ['desen', 'soyut', 'yildiz'], cameras: ['el', 'kaydir', 'yaklas'], anims: ['daktilo', 'tek'],
    transitions: ['glitch', 'whip', 'cut'], text: '#fdf6ff', accent: '#ff7ad9', sub: '#c9f0ff', pace: 0.9
  }),
  noir: S({
    name: 'Noir', desc: 'Siyah-beyaz, sert kontrast, yoğun gren',
    grade: { contrast: 1.35, saturation: 0, bw: 1, exposure: -0.03 },
    fx: { bloom: 0.45, grain: 0.14, vignette: 0.7, dust: 0.4, gateWeave: 0.15 },
    scenes: ['yildiz', 'cami', 'nur', 'deniz'], cameras: ['yaklas', 'egim', 'uzaklas', 'nefes'], anims: ['yuksel', 'tek'],
    transitions: ['dip', 'cut', 'fade'], text: '#ffffff', accent: '#ffffff', sub: '#cfcfcf', pace: 1
  }),
  gercek: S({
    name: 'Gerçek çekim', desc: 'Gerçek video çekimleri için: doğal renk, sinematik kontrast, sakin yazı',
    grade: { contrast: 1.08, saturation: 1.06, temperature: 0.05, shadowTint: [0.92, 0.98, 1.06], highlightTint: [1.04, 1, 0.94], splitAmount: 0.18 },
    fx: { bloom: 0.25, bloomThreshold: 0.85, grain: 0.035, vignette: 0.4, halation: 0.1 },
    scenes: ['video', 'nur', 'bulut'], cameras: ['nefes', 'yaklas', 'kaydir'], anims: ['yuksel', 'tek'],
    transitions: ['fade', 'dip', 'cut'], text: '#ffffff', accent: '#ffe2a8', sub: '#f1ece2', pace: 1
  }),
  pastel: S({
    name: 'Pastel rüya', desc: 'Yumuşak kontrast, pastel tonlar, hafif ışıma',
    grade: { contrast: 0.85, saturation: 0.8, lift: [0.08, 0.06, 0.1], temperature: 0.1, tint: 0.08 },
    fx: { bloom: 0.9, bloomThreshold: 0.55, grain: 0.03, vignette: 0.15, lightLeak: 0.35 },
    scenes: ['bulut', 'deniz', 'soyut'], cameras: ['nefes', 'kaydir', 'vinc'], anims: ['dagil', 'isik'],
    transitions: ['luma', 'fade', 'wipe'], text: '#ffffff', accent: '#ffe0f0', sub: '#fff4fa', pace: 1.2
  }),
  altin: S({
    name: 'Altın geometri', desc: 'Geometrik tünel, altın ışıma, dönen yazı',
    grade: { contrast: 1.15, saturation: 1.1, temperature: 0.25, highlightTint: [1, 0.78, 0.35], splitAmount: 0.25 },
    fx: { bloom: 1.2, bloomThreshold: 0.55, grain: 0.03, vignette: 0.55, ca: 0.12 },
    scenes: ['desen', 'cami', 'nur'], cameras: ['yaklas', 'yorunge', 'dolly'], anims: ['donus', 'isik'],
    transitions: ['zoom', 'circle', 'flash'], text: '#fff6dc', accent: '#ffcf66', sub: '#efdcae', pace: 1
  }),
  glitch: S({
    name: 'Siber glitch', desc: 'Neon, glitch kesmeler, ritme göre bozulma',
    grade: { contrast: 1.2, saturation: 1.35, temperature: -0.15, tint: 0.2, shadowTint: [0.3, 0, 0.6], splitAmount: 0.3 },
    fx: { bloom: 1.0, grain: 0.06, vignette: 0.5, ca: 0.6, glitch: 0.5, scanlines: 0.25 },
    scenes: ['soyut', 'desen', 'yildiz'], cameras: ['el', 'yaklas', 'kaydir', 'dolly'], anims: ['dagil', 'tek'],
    transitions: ['glitch', 'whip', 'zoom'], text: '#f2fbff', accent: '#5cf2ff', sub: '#d8c8ff', pace: 0.85
  }),
  vintage: S({
    name: '70\'ler vintage', desc: 'Solgun sıcak tonlar, toz, film titremesi',
    grade: { contrast: 0.92, saturation: 0.78, temperature: 0.3, lift: [0.07, 0.05, 0.02], gain: [1, 0.97, 0.88] },
    fx: { bloom: 0.5, grain: 0.12, vignette: 0.55, lightLeak: 0.45, dust: 0.5, gateWeave: 0.4, halation: 0.35 },
    scenes: ['col', 'bulut', 'deniz', 'cami'], cameras: ['kaydir', 'nefes', 'yaklas'], anims: ['yuksel', 'daktilo'],
    transitions: ['dip', 'fade', 'flash'], text: '#fff1dc', accent: '#ffbf80', sub: '#efdcc2', pace: 1.05
  }),
  piksel: S({
    name: '8-bit piksel', desc: 'Piksel, posterleştirme, retro oyun',
    grade: { contrast: 1.1, saturation: 1.3 },
    fx: { bloom: 0.3, grain: 0, vignette: 0.2, pixelate: 0.6, posterize: 0.6, scanlines: 0.2 },
    scenes: ['desen', 'yildiz', 'soyut'], cameras: ['kaydir', 'yaklas'], anims: ['tek', 'daktilo'],
    transitions: ['cut', 'wipe', 'glitch'], text: '#ffffff', accent: '#ffe066', sub: '#cfe8ff', pace: 0.9
  })
};
