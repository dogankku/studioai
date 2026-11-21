#!/bin/sh
# Her güncellemede çalıştırın: tarayıcı önbelleğinin eski dosya kullanmasını önler.
V=$(date +%Y%m%d%H%M)
for h in index.html basit.html; do
  sed -i -E "s#((css|js|vendor)/[a-zA-Z0-9_.-]+\.(css|js))(\?v=[0-9]+)?\"#\1?v=$V\"#g" "$h"
done
sed -i -E "s#from '((\.\.?/)+[a-zA-Z0-9/_.-]+\.m?js)(\?v=[0-9]+)?'#from '\1?v=$V'#g" js/*.js js/film/*.js
echo "Sürüm: $V"
