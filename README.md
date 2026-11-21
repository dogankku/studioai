# Toplu Video Stüdyosu

Ayet, hadis, söz ya da tek bir kelime listesinden **tek seferde çok sayıda video** üreten web uygulaması.
Tamamen tarayıcıda çalışır: sunucu, veritabanı, üyelik yok. Yüklediğiniz görsel, video ve sesler bilgisayarınızdan çıkmaz.

## Özellikler

- **Toplu liste**: metinleri `---` ile ayırarak yapıştırın, CSV/Excel'den alın ya da tek tek ekleyin. Her öğede ana metin, alt metin (meal), kaynak ve etiket olabilir.
- **Arapça desteği**: Arapça metin kendiliğinden algılanır, sağdan sola ve harekeli yazılır. Amiri, Scheherazade, Noto Naskh ve Reem Kufi yazı tipleri.
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
- **Proje kaydetme**: ayarları ve metinleri `.json` dosyasına kaydedip sonra açabilirsiniz. Son çalışma tarayıcıda da hatırlanır.

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
3. Birkaç dakika sonra uygulama `https://KULLANICI.github.io/DEPO-ADI/` adresinde açılır.

Yerelde denemek için klasörde bir sunucu açın (modüller `file://` ile çalışmaz):

```
python3 -m http.server 8000
```

ve `http://localhost:8000` adresine gidin.

## Notlar

- En iyi sonuç için masaüstü **Chrome** ya da **Edge** kullanın. Firefox/Safari'de video gerçek zamanlı kaydedilir (her video kendi süresi kadar sürer).
- Linux'taki Chrome AAC ses kodlayamayabilir; o durumda ses Opus olarak eklenir. iPhone uyumluluğu için Windows/Mac'te üretin.
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
vendor/             mp4-muxer (MIT), JSZip (MIT)
```

## Lisans

MIT
