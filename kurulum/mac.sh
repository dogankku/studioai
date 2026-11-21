#!/bin/bash
# Film Stüdyosu — yerel yapay zekâ kurulumu (macOS, Intel ya da Apple Silicon)
# Kurar: Ollama + qwen2.5:7b (senarist), ComfyUI + SD-Turbo (sahne görselleri)
# Her şey kullanıcı klasörüne kurulur; yönetici şifresi istemez. Tekrar çalıştırılabilir.
set -uo pipefail
ORIGIN="https://dogankku.github.io"
DIR="$HOME/FilmStudyosu"
MODEL="${FS_MODEL:-qwen2.5:7b}"
say()  { printf "\n\033[1;33m==> %s\033[0m\n" "$1"; }
ok()   { printf "\033[1;32m✓ %s\033[0m\n" "$1"; }
fail() { printf "\n\033[1;31m✗ %s\033[0m\n" "$1"; echo "Bu ekranın görüntüsünü Claude'a gönderin."; exit 1; }

# Betiğin tamamı önce okunur, sonra çalışır (curl | bash ile yapıştırıldığında alt komutlar betiğin geri kalanını yutamasın)
main() {

mkdir -p "$DIR" && cd "$DIR" || fail "Klasör oluşturulamadı: $DIR"
say "Film Stüdyosu yerel AI kurulumu başlıyor (klasör: $DIR)"
FREE=$(df -g "$HOME" | awk 'NR==2{print $4}')
[ "${FREE:-0}" -ge 15 ] || fail "En az 15 GB boş disk gerekli, şu an ${FREE} GB var."
ok "Boş disk: ${FREE} GB · İşlemci: $(uname -m) · macOS $(sw_vers -productVersion)"

# ---------------- 1) Ollama ----------------
APP=""
for p in /Applications/Ollama.app "$HOME/Applications/Ollama.app"; do [ -d "$p" ] && APP="$p"; done
if [ -z "$APP" ]; then
  say "1/5 Ollama indiriliyor"
  curl -fL --progress-bar -o /tmp/Ollama-darwin.zip https://ollama.com/download/Ollama-darwin.zip || fail "Ollama indirilemedi."
  rm -rf /tmp/fs_ollama && mkdir -p /tmp/fs_ollama && unzip -q -o /tmp/Ollama-darwin.zip -d /tmp/fs_ollama || fail "Ollama arşivi açılamadı."
  if [ -w /Applications ]; then APP=/Applications/Ollama.app; else mkdir -p "$HOME/Applications"; APP="$HOME/Applications/Ollama.app"; fi
  rm -rf "$APP"; mv /tmp/fs_ollama/Ollama.app "$APP" || fail "Ollama uygulaması taşınamadı."
fi
ok "Ollama: $APP"
OLLAMA="$APP/Contents/Resources/ollama"
[ -x "$OLLAMA" ] || OLLAMA="$(command -v ollama || true)"

say "Film Stüdyosu'nun Ollama'ya bağlanmasına izin veriliyor"
launchctl setenv OLLAMA_ORIGINS "$ORIGIN"
PL="$HOME/Library/LaunchAgents/com.filmstudyosu.ollama-origins.plist"
mkdir -p "$HOME/Library/LaunchAgents"
cat > "$PL" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>Label</key><string>com.filmstudyosu.ollama-origins</string>
<key>ProgramArguments</key><array><string>/bin/launchctl</string><string>setenv</string><string>OLLAMA_ORIGINS</string><string>$ORIGIN</string></array>
<key>RunAtLoad</key><true/>
</dict></plist>
PLIST
launchctl unload "$PL" 2>/dev/null; launchctl load "$PL" 2>/dev/null
ok "İzin kalıcı olarak ayarlandı (her açılışta geçerli)"

osascript -e 'quit app "Ollama"' >/dev/null 2>&1; sleep 3
open -a "$APP"
for i in $(seq 1 60); do curl -fs http://127.0.0.1:11434/api/version >/dev/null && break; sleep 2; done
curl -fs http://127.0.0.1:11434/api/version >/dev/null || fail "Ollama başlatılamadı. Uygulamalar'dan Ollama'yı açıp komutu yeniden çalıştırın."
ok "Ollama çalışıyor: $(curl -fs http://127.0.0.1:11434/api/version)"

say "2/5 Dil modeli indiriliyor: $MODEL (yaklaşık 4,7 GB)"
"$OLLAMA" pull "$MODEL" || fail "Model indirilemedi."
ok "Model hazır: $MODEL"

# ---------------- 2) Python (uv ile, yönetici şifresi gerekmez) ----------------
say "3/5 Python hazırlanıyor"
export PATH="$HOME/.local/bin:$PATH"
if ! command -v uv >/dev/null 2>&1; then curl -LsSf https://astral.sh/uv/install.sh | sh || fail "uv kurulamadı."; export PATH="$HOME/.local/bin:$PATH"; fi
ok "uv: $(uv --version)"

# ---------------- 3) ComfyUI ----------------
say "4/5 ComfyUI kuruluyor"
ARCH=$(uname -m)
TORCH_PIN=""
if [ "$ARCH" = "x86_64" ]; then TORCH_PIN='torch==2.2.2 torchvision==0.17.2 torchaudio==2.2.2 numpy<2 transformers<5'; fi
install_compat() { # PyTorch 2.2 uyumluluk yaması (yalnızca Intel Mac)
  [ -n "$TORCH_PIN" ] || return 0
  local sp; sp=$("$DIR/ComfyUI/.venv/bin/python" -c "import sysconfig;print(sysconfig.get_paths()['purelib'])") || return 1
  cat > "$sp/fs_torch_compat.py" <<'PYEOF'
# Film Stüdyosu: Intel Mac'te PyTorch 2.2 ile yeni ComfyUI kodu arasındaki küçük farkları kapatır.
# torch içe aktarıldığı anda eksik fonksiyonları ekler; torch'u erkenden yüklemez.
import sys, importlib.abc, importlib.machinery

def _patch(torch):
    try:
        if not hasattr(torch.compiler, "is_compiling"):
            torch.compiler.is_compiling = lambda: False
    except Exception:
        pass

class _TorchHook(importlib.abc.MetaPathFinder):
    def find_spec(self, name, path, target=None):
        if name != "torch":
            return None
        # kendini kaldırmıyoruz: importlib.util.find_spec("torch") gibi denetimler asıl içe aktarmadan önce de buraya düşer
        spec = importlib.machinery.PathFinder.find_spec(name, path)
        if spec is None or spec.loader is None:
            return spec
        orig = spec.loader.exec_module
        def exec_module(module):
            orig(module)
            _patch(module)
            try:
                sys.meta_path.remove(self)
            except ValueError:
                pass
        spec.loader.exec_module = exec_module
        return spec

if "torch" in sys.modules:
    _patch(sys.modules["torch"])
else:
    sys.meta_path.insert(0, _TorchHook())
PYEOF
  echo "import fs_torch_compat" > "$sp/fs_torch_compat.pth"
  # ayrıca ComfyUI kodunu doğrudan düzelt (yama yüklenmese bile çalışsın)
  "$DIR/ComfyUI/.venv/bin/python" - "$DIR/ComfyUI" <<'PYEOF' || return 1
import pathlib, sys
root = pathlib.Path(sys.argv[1]); n = 0
for f in list(root.glob("comfy/**/*.py")) + list(root.glob("comfy_extras/**/*.py")):
    t = f.read_text(encoding="utf-8")
    if "torch.compiler.is_compiling()" in t:
        f.write_text(t.replace("torch.compiler.is_compiling()", 'getattr(torch.compiler, "is_compiling", lambda: False)()'), encoding="utf-8"); n += 1
print(f"ComfyUI kodunda {n} dosya düzeltildi")
PYEOF
  "$DIR/ComfyUI/.venv/bin/python" -c "import torch; assert hasattr(torch.compiler, 'is_compiling')" || return 1
}
install_comfy() { # $1: sürüm (master ya da etiket)
  local ref="$1" url
  if [ "$ref" = "master" ]; then url="https://github.com/comfyanonymous/ComfyUI/archive/refs/heads/master.zip"; else url="https://github.com/comfyanonymous/ComfyUI/archive/refs/tags/$ref.zip"; fi
  echo "ComfyUI sürümü deneniyor: $ref"
  rm -rf /tmp/fs_comfy && mkdir -p /tmp/fs_comfy
  curl -fL --progress-bar -o /tmp/fs_comfy/c.zip "$url" || return 1
  unzip -q /tmp/fs_comfy/c.zip -d /tmp/fs_comfy || return 1
  local src; src=$(find /tmp/fs_comfy -maxdepth 1 -type d -name 'ComfyUI-*' | head -1)
  [ -n "$src" ] || return 1
  # eski kodu temizle, indirilen modelleri koru
  mkdir -p "$DIR/ComfyUI/models/checkpoints"
  find "$DIR/ComfyUI" -mindepth 1 -maxdepth 1 ! -name models -exec rm -rf {} +
  cp -R "$src/." "$DIR/ComfyUI/" || return 1
  cd "$DIR/ComfyUI" || return 1
  uv venv -q --python 3.11 .venv || return 1
  # comfy-angle zorunlu değil ve Intel Mac için hazır paketi yok
  grep -viE '^(torch|torchvision|torchaudio|comfy-angle)([<>=~! ]|$)' requirements.txt > /tmp/fs_req.txt
  echo requests >> /tmp/fs_req.txt
  if [ -n "$TORCH_PIN" ]; then
    printf '%s\n' $TORCH_PIN > /tmp/fs_constraints.txt
    # yalnızca hazır paketler: hiçbir şey kaynaktan derlenmez
    uv pip install --python .venv/bin/python --only-binary :all: -r /tmp/fs_constraints.txt -r /tmp/fs_req.txt -c /tmp/fs_constraints.txt || return 1
  else
    uv pip install --python .venv/bin/python torch torchvision torchaudio || return 1
    uv pip install --python .venv/bin/python -r /tmp/fs_req.txt || return 1
  fi
  install_compat || return 1
  echo "Açılış testi yapılıyor…"
  .venv/bin/python main.py --cpu --quick-test-for-ci > /tmp/fs_comfy/test.log 2>&1
  if grep -q "Traceback" /tmp/fs_comfy/test.log; then tail -3 /tmp/fs_comfy/test.log; return 1; fi
  echo "$ref" > "$DIR/ComfyUI/.fs_version"
  return 0
}
# Intel Mac'te PyTorch en fazla 2.2.2 olabiliyor; v0.3.77 bununla çalışan son ComfyUI sürümü (denendi).
if [ "$ARCH" = "x86_64" ]; then REFS="v0.3.77 v0.3.60 v0.3.40"; else REFS="master v0.3.77"; fi
DONE=0
if [ -f "$DIR/ComfyUI/.fs_version" ] && [ -x "$DIR/ComfyUI/.venv/bin/python" ]; then DONE=1; ok "ComfyUI zaten kurulu ($(cat "$DIR/ComfyUI/.fs_version"))"; fi
if [ $DONE -eq 0 ]; then
  for ref in $REFS; do
    if install_comfy "$ref"; then DONE=1; ok "ComfyUI kuruldu ($ref)"; break; fi
    echo "Bu sürüm bu Mac'te kurulamadı, sıradaki deneniyor…"
  done
fi
[ $DONE -eq 1 ] || fail "ComfyUI kurulamadı."
install_compat || fail "Uyumluluk yaması kurulamadı."
ok "PyTorch uyumluluk yaması hazır"
cd "$DIR/ComfyUI"

say "5/5 Görsel modeli indiriliyor: SD-Turbo (yaklaşık 5 GB)"
CK="$DIR/ComfyUI/models/checkpoints/sd_turbo.safetensors"
if [ ! -s "$CK" ] || [ "$(stat -f%z "$CK")" -lt 1000000000 ]; then
  curl -fL -C - --progress-bar -o "$CK" "https://huggingface.co/stabilityai/sd-turbo/resolve/main/sd_turbo.safetensors" \
    || fail "SD-Turbo indirilemedi. Hugging Face sayfasında lisans onayı isteniyorsa https://huggingface.co/stabilityai/sd-turbo adresinden onaylayıp dosyayı $DIR/ComfyUI/models/checkpoints klasörüne elle koyun."
fi
ok "Görsel modeli hazır"

# ---------------- başlatıcılar ----------------
cat > "$DIR/ComfyUI-Baslat.command" <<CMD
#!/bin/bash
cd "$DIR/ComfyUI" && exec .venv/bin/python main.py --cpu --listen 127.0.0.1 --port 8188 --enable-cors-header "$ORIGIN"
CMD
chmod +x "$DIR/ComfyUI-Baslat.command"
ok "Başlatıcı: $DIR/ComfyUI-Baslat.command (Finder'da çift tıklayarak açılır)"

say "ComfyUI başlatılıyor (yeni bir Terminal penceresi açılacak)"
pkill -f "main.py --cpu --listen 127.0.0.1 --port 8188" 2>/dev/null && { echo "Açık olan eski ComfyUI kapatıldı."; sleep 3; }
open "$DIR/ComfyUI-Baslat.command"
for i in $(seq 1 90); do curl -fs http://127.0.0.1:8188/system_stats >/dev/null && break; sleep 2; done
if curl -fs http://127.0.0.1:8188/system_stats >/dev/null; then ok "ComfyUI çalışıyor"; else echo "ComfyUI henüz açılmadı; yeni Terminal penceresindeki mesajlara bakın."; fi

printf "\n\033[1;32m══════════════════════════════════════════\n  Kurulum tamamlandı.\n  Film Stüdyosu → Yapay zekâ → Bağlantılar → \"Bağlan\"\n  ComfyUI'ı sonraki açılışlarda: ~/FilmStudyosu/ComfyUI-Baslat.command\n══════════════════════════════════════════\033[0m\n"
}
main "$@" < /dev/null
