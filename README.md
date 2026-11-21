# Film Stüdyosu

Ayet, hadis, söz ya da tek bir kelimeden **3D sahneli, kurgulu, efektli film** üreten web uygulaması.
Yapay zekâ ve üyelik yok; her şey kodla ve tarayıcıda üretilir.

**Canlı:** https://dogankku.github.io/studioai/ · Basit toplu video aracı: https://dogankku.github.io/studioai/basit.html

## Film Stüdyosu neler yapıyor

- **Yönetmen motoru** (kural tabanlı): metni okunabilir ifadelere ve çekimlere böler (Uthmani durak işaretleri dahil), anahtar kelimelere göre sahne seçer (gece → yıldızlı gök, deniz → dalgalar, sabır → çöl, namaz/dua → cami, cennet/rahmet → bulutlar, ilim/kitap → geometrik tünel), kamera hareketlerini ve geçişleri tekrarsız dağıtır. **Yeniden yönet** her basışta farklı kurgu çıkarır.
- **8 prosedürel 3D sahne** (Three.js): yıldızlı gök ve dağlar, çöl, gece denizi, ışık hüzmeleri, cami silüeti ve fenerler, geometrik tünel, bulut denizi, soyut akış.
- **9 kamera hareketi**: yaklaşma, uzaklaşma, yörünge, vinç, yana kayma, eğim, elde çekim, sakin nefes, dolly zoom.
- **7 yazı animasyonu**, her kelime 3D uzayda ayrı canlanır; Arapça şekillendirme ve karışık yön desteği.
- **10 geçiş**: çapraz, karartma, ışık patlaması, yakınlaşma bulanıklığı, hızlı kaydırma, glitch, doku erimesi, daire, silme, kesme.
- **10 film stili** ve **14 efekt**: ışıma, film greni, vinyet, renk kayması, tarama çizgileri, VHS, glitch, piksel, posterleştirme, ışık sızıntısı, sinemaskop bant, film titremesi, toz-çizik, halation; pozlama, kontrast, doygunluk, sıcaklık, ton ayarları.
- **Ritim analizi**: müziğin temposu ve vuruşları bulunur, kesmeler vuruşlara oturtulur, glitch gibi efektler vuruşla nabız atar.
- **Referans video**: beğendiğiniz bir videoyu yükleyin; kesme noktaları, çekim süreleri, renk paleti, hareket yoğunluğu ve müziğin temposu çıkarılır, aynı kurgu sizin metninizle yeniden kurulur. İsterseniz renk karakteri ve müziği de kullanılır.
- **Zaman çizelgesi ve çekim düzenleyici**: her çekimin sahnesini, kamerasını, animasyonunu, geçişini, yoğunluğunu ve süresini elle değiştirin; değişiklikler "yeniden yönet"te korunur.
- **Çıktı**: tek film ya da her öğe ayrı video; 9:16, 4:5, 1:1, 16:9; 720p/1080p; MP4.

---

# Basit araç: Toplu Video Stüdyosu

Ayet, hadis, söz ya da tek bir kelime listesinden **tek seferde çok sayıda video** üreten web uygulaması.
**Canlı:** https://dogankku.github.io/studioai/ (GitHub Pages açıldıktan sonra)

Tamamen tarayıcıda çalışır: sunucu, veritabanı, üyelik yok. Yüklediğiniz görsel, video ve sesler bilgisayarınızdan çıkmaz.

## Özellikler

- **Kur'an'dan ekle**: sûre ve ayet aralığı seçin; doğrulanmış Uthmani metin ve Diyanet meali listeye eklenir (her ayet ayrı video ya da hepsi tek video). Veri uygulamanın içinde, internet gerekmez.
- **Tilavetle eşleme**: sesi dinlerken her kelimede Boşluk tuşuna basın; kelimeler tilavetle birlikte belirir. Geri al, baştan al, önizle.
- **Toplu liste**: metinleri `---` ile ayırarak yapıştırın, CSV/Excel'den alın ya da tek tek ekleyin. Her öğede ana metin, alt metin (meal), kaynak ve etiket olabilir.
- **Arapça desteği**: Arapça metin kendiliğinden algılanır, sağdan sola ve harekeli yazılır; Türkçe cümle içinde geçen Arapça kelimeler de doğru yönde durur. Amiri, Amiri Quran, Scheherazade, Noto Naskh ve Reem Kufi yazı tipleri uygulamaya gömülüdür.
- **Video bazında ayar**: her videoya ayrı tema, animasyon, yerleşim, arka plan ve ses verilebilir.
- **Giriş / kapanış kartı**: örneğin başta Besmele, sonda "Takip edin".
- **Arka plan**
  - 8 hazır hareketli tema: Gece, Altın, Zümrüt, Gün batımı, Aurora, Okyanus, Bordo, Sade
  - Düz renk ya da dönen gradyan
  - Kendi **görseliniz** (yavaş yakınlaşma efektiyle) ya da kendi **videonuz** (döngüde)
  - Birden fazla görsel/video ekleyip videolara *sırayla* ya da *karışık* dağıtma
  - Karartma, bulanıklık, parçacıklar (yıldız, ışık tozu, bokeh), geometrik desen, vinyet, çerçeve
- **Yazı**: 6 animasyon (kelime kelime, karaoke, kinetik, daktilo, satır satır, yumuşak belirme), konum (üst/orta/alt), yarı saydam kutu ya da buzlu cam arka, renkler, imza ve logo.
- **Ses**: müzik, tilavet ya da seslendirme ekleyin; hepsine aynı sesi, sırayla ya da karışık dağıtın. Video süresi sese eşitlenebilir.
- **Çıktı**: 9:16, 4:5, 1:1, 16:9 · 720p / 1080p / 1440p · 24/30/60 fps · MP4 (H.264).
  Chrome ve Edge'de **hızlı mod** (WebCodecs) ile videolar gerçek süresinden hızlı üretilir. Hepsi tek ZIP olarak indirilebilir.
- **Altyazı**: istenirse her videoya `.srt` dosyası.
- **Kalıcılık**: metinler, ayarlar, görseller, videolar, sesler ve logo tarayıcıda saklanır; sayfa yenilense de kaybolmaz. "Projeyi kaydet" medyalarla birlikte tek `.zip` üretir, başka bilgisayarda "Proje aç" ile açılır.
- **Klasöre doğrudan yazma**: Chrome/Edge'de bir klasör seçerseniz her video bitince diske yazılır, bellek dolmaz.

## Kullanım

1. **Metinler** sekmesinde listeyi oluşturun.
2. **Arka plan**, **Yazı**, **Ses** sekmelerinde görünümü ayarlayın. Önizlemede `‹ ›` ile öğeler arasında gezin.
3. **Çıktı** sekmesinde formatı seçin.
4. **Tümünü üret**'e basın, bitince tek tek ya da ZIP olarak indirin.

### Toplu metin biçimi

```
فَإِنَّ مَعَ الْعُسْرِ يُسْرًا
meal: Demek ki zorlukla beraber bir kolaylık vardır.
kaynak: İnşirah, 5
etiket: Günün Ayeti
---
Sabır, imanın yarısıdır.
---
SABIR
meal: Acının içinde dimdik durabilmektir.
```

CSV sütunları: `ana, alt, kaynak, etiket` (başlık satırı varsa adlarına göre eşlenir).

## GitHub Pages ile yayınlama

1. Bu depoyu GitHub'a yükleyin.
2. **Settings → Pages → Build and deployment** bölümünde *Source: Deploy from a branch*, *Branch: `main` / `(root)`* seçin.
3. Birkaç dakika sonra uygulama `https://dogankku.github.io/studioai/` adresinde açılır.

Kodda değişiklik yaptıktan sonra `./bump-version.sh` çalıştırın; dosyalara sürüm etiketi ekler, böylece kullanıcıların tarayıcısı eski dosyaları önbellekten kullanmaz.

Yerelde denemek için klasörde bir sunucu açın (modüller `file://` ile çalışmaz):

```
python3 -m http.server 8000
```

ve `http://localhost:8000` adresine gidin.

## Notlar

- En iyi sonuç için masaüstü **Chrome** ya da **Edge** kullanın. Firefox/Safari'de video gerçek zamanlı kaydedilir (her video kendi süresi kadar sürer).
- Linux'taki Chrome AAC ses kodlayamayabilir; o durumda ses Opus olarak eklenir. iPhone uyumluluğu için Windows/Mac'te üretin.
- Sekme arka plandayken üretim yavaşlayabilir; sekmeyi önde tutun.
- Video arka plan kullanırken kare kare arama yapıldığı için üretim biraz yavaşlar; kısa ve düşük çözünürlüklü arka plan videoları daha hızlıdır.

## Dosyalar

```
index.html          arayüz
css/style.css       görünüm
js/app.js           durum, liste, önizleme, üretim kuyruğu
js/renderer.js      metin yerleşimi ve animasyon
js/backgrounds.js   temalar, görsel/video arka plan, efektler
js/encoder.js       MP4 kodlama (WebCodecs + mp4-muxer, yedek: MediaRecorder)
js/audio.js         ses çözme ve karıştırma
js/parser.js        toplu metin ve CSV ayrıştırma
js/quran.js         Kur'an verisi
js/storage.js       medya saklama (IndexedDB)
vendor/             mp4-muxer (MIT), JSZip (MIT)
fonts/, css/fonts.css  gömülü yazı tipleri (SIL OFL 1.1, Fontsource)
data/quran/         114 sûre: Arapça metin + Türkçe meal
```

## Veri kaynakları

- Arapça metin: King Fahd Kur'an Kompleksi Uthmani hattı ([quranenc.com](https://quranenc.com)).
- Türkçe meal: Diyanet İşleri Başkanlığı ([tanzil.net](https://tanzil.net/trans/tr.diyanet)).
- Paket: [quran-json](https://github.com/risan/quran-json), CC BY-SA 4.0. Meal metinlerinin kullanım koşulları için ilgili kaynaklara bakınız.

## Lisans

Uygulama kodu MIT. Yazı tipleri SIL OFL 1.1, Kur'an verisi CC BY-SA 4.0 (yukarıya bakınız).
