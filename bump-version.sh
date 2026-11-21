#!/bin/sh
# Her güncellemede çalıştırın: tarayıcı önbelleğinin eski dosya kullanmasını önler.
V=$(date +%Y%m%d%H%M)
sed -i -E "s#(css/[a-z]+\.css|js/app\.js|vendor/jszip\.min\.js)(\?v=[0-9]+)?\"#\1?v=$V\"#g" index.html
sed -i -E "s#from '(\./[a-z]+\.js|\.\./vendor/mp4-muxer\.mjs)(\?v=[0-9]+)?'#from '\1?v=$V'#g" js/*.js
echo "Sürüm: $V"
