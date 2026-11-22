# Video Stüdyosu

Yazdığınız metni **profesyonel kısa videoya** dönüştüren web uygulaması: formatı seçin, bilgileri yazın; sahneler, gerçek video çekimleri, Türkçe seslendirme, müzik, ses efektleri ve kurgu hazır. Her şey tarayıcınızda ve bilgisayarınızda çalışır, üyelik gerekmez.

**Canlı:** https://dogankku.github.io/studioai/

## Nasıl çalışır

1. **Format seçin**
   - **Bilgi / eğitim:** dikkat çeken giriş, numaralı bilgiler, kapanış çağrısı.
   - **Liste (Top 5):** numaralı maddeler. Geri sayım seçeneği var.
   - **Söz / motivasyon:** tek güçlü söz ve imza, sinematik görünüm.
   - **Ürün / marka tanıtımı:** sorun, çözüm, özellikler, fiyat, satın alma düğmesi ve logo.
2. **Bilgileri yazın.** İki dönüştürme yolu var:
   - **Sahnelere dönüştür:** metni anında, kurallara göre böler.
   - **Yapay zekâ ile yaz:** bilgilerinizi kısa, vurucu bir senaryoya çevirir. Seslendirme metnini, çekim arama ipuçlarını, YouTube başlığını, açıklamayı ve etiketleri de yazar. Bunun için yerel Ollama gerekir.
3. **Sahneleri düzenleyin.** Her sahnede şunlar ayrı ayrı ayarlanabilir:
   - Tür, üst etiket, başlık ve açıklama.
   - Numara ya da simge (1, ✓, ★).
   - Düğme yazısı ve alt imza.
   - Seslendirme metni ve çekim arama ipucu.
4. **Çekimler**, **ses** ve **platform** seçip videoyu üretin.

## Özellikler

- **Profesyonel yazı düzenleri:** büyük başlık, numara rozeti, vurgu çizgisi, üst etiket, nabız atan çağrı düğmesi ve logo. Her kelime ayrı canlanır.
- **Format stilleri:** Modern bilgi, Neon liste, Marka tanıtımı ve Gerçek çekim. Bunların yanında sinematik stiller ve 14 efekt var.
- **Gerçek video çekimleri (Pixabay, ücretsiz anahtar):**
  - Arama yapıp önizleyerek seçersiniz.
  - Seçilen çekimler **tek akış** hâlinde sırayla oynar.
  - Geçişler örtüşen yumuşak karışımla yapılır, çekimlerin renkleri birbirine eşitlenir ve arka plan kesintisiz hareket eder.
  - İsterseniz her sahneye ayrı çekim de verebilirsiniz.
- **Türkçe seslendirme (Piper):** tarayıcıda, ücretsiz çalışır. Her sahnenin süresi seslendirmeye göre ayarlanır, müzik konuşmada kendiliğinden kısılır.
- **Ses kütüphanesi:**
  - **Hazır müzikler:** sakin ambiyans, lo-fi, kurumsal, sinematik ve enerjik. Program bunları kendisi sentezler, telif sorunu yoktur.
  - **Gömülü efektler:** hışırtı, vurgu, pop, yükselen ses, zil ve tık. Sahne türüne göre otomatik yerleşir. Her biri açılıp kapatılabilir ve dinlenebilir.
  - **Freesound araması (ücretsiz anahtar):** müzik ve efekt aranıp dinlenebilir. Bulunan bir müzik film müziği yapılabilir, bir efekt de herhangi bir gömülü efektin yerine kullanılabilir. CC BY lisanslı seslerin kaynak bilgisi Üretim sekmesinde listelenir.
- **Kelime kelime altyazı:** TikTok ve Reels tarzında, seslendirmeyle senkron. Konuşulan kelime renkli ya da kutulu gösterilir.
- **Kendi medyanız:** fotoğraf ve videolarınızı çekim akışına ya da tek bir sahneye ekleyebilirsiniz.
- **Ses ayarları:** seslendirme hızı, tonu ve cümle arası durak ayarlanır. Sahne başına kendi sesinizi kaydedebilirsiniz.
- **Marka kiti:** renkler, yazı tipi, logo, logolu giriş ve kapanış kartı ve köşede filigran bir kez kaydedilir, bütün videolara uygulanır.
- **Sahne düzenleri:** ortada, sola dayalı, alt bant paneli, sayaçlı büyük istatistik ve fotoğraf kartı.
- **Kapak görseli:** her platform için PNG olarak üretilir.
- **Otomatik müzik ve çekim:** formata uygun müzik (Freesound ya da hazır müzik) ve her sahneye uygun Pixabay çekimi tek tıkla seçilir.
- **Şablon galerisi:** 10 sektör için hazır örnek video var. Seçip kendi bilginizi yazıyorsunuz.
- **İçerik takvimi:** yapay zekâ bir konu için 5–30 videoluk plan yazar ve plan toplu üretime aktarılır.
- **Proje kütüphanesi:** projeler tarayıcıda saklanır ve otomatik kaydedilir. Açılabilir, kopyalanabilir, yeniden adlandırılabilir, dosyaya aktarılabilir.
- **Çok dilli:** video İngilizce, Almanca, Fransızca, İspanyolca, Rusça ya da Arapçaya çevrilir ve o dilin sesiyle seslendirilir.
- **Kalite kontrolü:** üretimden önce süreyi, yazı uzunluğunu, tempoyu ve ses seviyesini denetler, tek tıkla düzeltir.
- **Sürükle-bırak kurgu:** zaman çizelgesinde sahne sırası ve sahne süresi sürükleyerek değiştirilir.
- **SRT altyazı dosyası ve GIF önizleme.**
- **Hızlı çekim çözme (deneysel):** gerçek çekimleri WebCodecs ile sırayla çözer.
- **Toplu üretim:** bir konu listesinden çok sayıda video üretilir.
- **Sahne görselleri (ComfyUI, yerel):** çekim kullanılmayan sahneler için yapay zekâ görseli üretilebilir.
- **Yönetmen:**
  - Kamera hareketlerini ve geçişleri dağıtır. Kesmeleri müziğin ritmine oturtabilir.
  - Hedef süre verilebilir.
  - Referans bir videonun kurgusu kopyalanabilir.
  - Zaman çizelgesinde her çekim elle düzenlenebilir.
- **Platformlar:** YouTube (16:9), Shorts ve Reels (9:16), Instagram gönderi (4:5) ve Kare (1:1). Her platform ayrı dosya olarak, MP4 (H.264 + AAC) biçiminde çıkar. Yazılar platform arayüzünün kapladığı alanların dışında tutulur.

## Yerel yapay zekâ kurulumu (Mac)

Terminal'de:

```
curl -fsSL https://dogankku.github.io/studioai/kurulum/mac.sh | bash
```

- **Kurulanlar:** Ollama ve qwen2.5:7b (senarist), ComfyUI ve SD-Turbo (görseller). Yaklaşık 12 GB indirilir, yönetici şifresi gerekmez.
- **Masaüstüne eklenenler:** **Video Stüdyosu** simgesi ve görsel motorunu kapatan simge.
- **Intel Mac'ler:** PyTorch 2.2.2 ile uyumlu ComfyUI sürümü (v0.3.77) ve gereken uyumluluk düzeltmesi otomatik kurulur.

## Dosyalar

```
index.html            Arayüz
css/                  Stiller ve gömülü yazı tipleri
js/film-app.js        Uygulama mantığı
js/formats.js         Format motoru (kural tabanlı + yapay zekâ)
js/sfx.js             Gömülü efektler ve müzik sentezi, efekt yerleşimi
js/audio.js           Ses karışımı (müzik, seslendirme, efektler, kısma)
js/encoder.js         MP4 kaydı (WebCodecs + mp4-muxer)
js/film/              Yönetmen, oynatıcı, 3D sahneler, çekim sahnesi, yazı, son işlem, stiller
js/ai/                Pixabay, Freesound, Ollama/ComfyUI, Piper seslendirme
kurulum/mac.sh        Yerel yapay zekâ kurulumu
vendor/               three.js paketi, mp4-muxer, jszip, Piper
```

## Lisans

Kod: MIT. Yazı tipleri: SIL OFL. Pixabay videoları Pixabay İçerik Lisansı'na, Freesound sesleri her sesin kendi lisansına (CC0 / CC BY) tabidir.
