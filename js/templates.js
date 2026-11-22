// Hazır şablon galerisi: sektörlere göre örnek senaryolar. Seçince format, stil ve metin dolar; kullanıcı kendi bilgisini yazar.
export const TEMPLATES = [
  { id: 'kafe', icon: '☕', name: 'Kafe / restoran', fmt: 'urun', style: 'marka', title: 'Köşe Kahve', brand: 'Köşe Kahve', cta: 'Bugün uğra',
    text: 'Sabah kahven sıradan mı?\n\nKöşe Kahve, her gün taze kavrulmuş çekirdeklerle demlenir.\n- Taze kavrulmuş çekirdek\n- El yapımı tatlılar\n- Sessiz çalışma alanı\nİlk kahve sadece 49 TL' },
  { id: 'emlak', icon: '🏡', name: 'Emlak ilanı', fmt: 'urun', style: 'marka', title: 'Deniz manzaralı 3+1', brand: 'Mavi Emlak', cta: 'Hemen ara',
    text: 'Hayalindeki ev bu mu?\n\nDeniz manzaralı, yeni yapılmış 3+1 daire satışta.\n- 145 m² net kullanım\n- Site içinde havuz ve otopark\n- Metroya 5 dakika\nFiyat: 6.450.000 TL' },
  { id: 'egitim', icon: '🎓', name: 'Eğitim / kurs', fmt: 'bilgi', style: 'modern', title: 'İngilizce öğrenmenin en hızlı yolu', cta: 'Daha fazlası için takip et',
    text: 'Her gün 20 dakika yeterli. Düzenli kısa çalışma, haftada bir uzun çalışmadan daha etkilidir.\n\nDuyduğunu tekrar et. Gölgeleme tekniği telaffuzu hızla geliştirir.\n\nKelimeleri cümle içinde öğren. Tek başına ezberlenen kelime çabuk unutulur.' },
  { id: 'spor', icon: '💪', name: 'Spor / sağlık', fmt: 'liste', style: 'neonliste', title: 'Evde yapabileceğin 5 egzersiz', cta: 'Hangisini deneyeceksin? Yorumlara yaz',
    text: 'Squat: Bacak ve kalçayı güçlendirir\nŞınav: Göğüs, omuz ve kollar için\nPlank: Karın kaslarını sıkılaştırır\nLunge: Dengeyi ve bacak gücünü artırır\nBurpee: Tüm vücut kardiyo' },
  { id: 'motivasyon', icon: '✨', name: 'Motivasyon', fmt: 'soz', style: 'gercek', title: '',
    text: 'Başlamak için mükemmel olmak zorunda değilsin, ama mükemmel olmak için başlamak zorundasın.\n— Zig Ziglar' },
  { id: 'teknoloji', icon: '📱', name: 'Teknoloji ipuçları', fmt: 'liste', style: 'neonliste', title: 'Telefonunda bilmediğin 5 özellik', cta: 'Kaydet, sonra dene',
    text: 'Tek elle klavye: Büyük ekranda yazmayı kolaylaştırır\nEkran kaydı: Hızlı ayarlardan tek dokunuşla\nAkıllı şarj: Pil ömrünü uzatır\nOdak modu: Bildirimleri susturur\nMetin tarama: Kamerayla yazıyı kopyala' },
  { id: 'mahalle', icon: '🛠️', name: 'Yerel hizmet', fmt: 'urun', style: 'marka', title: 'Usta Tesisat', brand: 'Usta Tesisat', cta: 'WhatsApp\'tan yaz',
    text: 'Musluk mu damlatıyor, gider mi tıkalı?\n\nUsta Tesisat aynı gün kapınızda.\n- 7/24 acil servis\n- Ücretsiz keşif\n- İşçilik garantisi\nKeşif ücretsiz' },
  { id: 'gezi', icon: '🧭', name: 'Gezi / turizm', fmt: 'liste', style: 'gercek', title: 'Kapadokya\'da yapılacak 5 şey', cta: 'Hangisi listende? Yorumlara yaz',
    text: 'Balon turu: Gün doğumunda gökyüzünden peri bacaları\nGöreme Açık Hava Müzesi: Kaya kiliseleri\nYeraltı şehri: Derinkuyu\'nun gizemli tünelleri\nGüvercinlik Vadisi: Gün batımı yürüyüşü\nÇömlek atölyesi: Avanos\'ta kendi çömleğini yap' },
  { id: 'saglik', icon: '🥗', name: 'Beslenme', fmt: 'bilgi', style: 'modern', title: 'Su içmek neden bu kadar önemli?', cta: 'Daha fazlası için takip et',
    text: 'Vücudumuzun yaklaşık %60\'ı sudur.\n\nYeterli su içmek odaklanmayı ve enerjiyi artırır.\n\nGünde 8 bardak su çoğu yetişkin için iyi bir başlangıçtır.' },
  { id: 'ecommerce', icon: '🛍️', name: 'E-ticaret kampanyası', fmt: 'urun', style: 'marka', title: 'Hafta sonu indirimi', brand: 'ModaPlus', cta: 'Şimdi alışverişe başla',
    text: 'Gardırobunu yenileme zamanı geldi mi?\n\nModaPlus hafta sonu kampanyası başladı.\n- Tüm ürünlerde %40\'a varan indirim\n- 300 TL üzeri ücretsiz kargo\n- 30 gün koşulsuz iade\nKampanya pazar gece bitiyor' }
];
