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
