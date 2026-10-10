#!/usr/bin/env bash
set -euo pipefail
# Run this from any directory with the checked-out repository as argument.
REPO="$(cd "${1:-.}" && pwd)"
SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
if ! command -v emcmake >/dev/null; then
  echo 'Falta Emscripten: instala emsdk y ejecuta source emsdk_env.sh' >&2; exit 2
fi
if [[ ! -f "$REPO/build-daytona/gen/daytona/gen_table.cpp" ]]; then
  echo 'Primero ejecuta el setup y recompila la revisión 1994 en el host:' >&2
  echo '  python3 scripts/recompile.py --set daytona --build-dir build-daytona' >&2
  exit 2
fi
python3 "$SELF/scripts/apply_web_port.py" "$REPO"
emcmake cmake -S "$REPO" -B "$REPO/build-web" -G Ninja \
  -DCMAKE_BUILD_TYPE=Release \
  -DM2_ROMSET=daytona \
  -DM2_SOFTFLOAT_PORTABLE=ON \
  -DM2_GEN_ROOT="$REPO/build-daytona/gen"
cmake --build "$REPO/build-web" --target daytona_web --parallel 4
cp "$REPO/platform/web/index.html" "$REPO/build-web/web/index.html"
cp "$REPO/platform/web/main.js" "$REPO/build-web/web/main.js"
cp "$REPO/platform/web/style.css" "$REPO/build-web/web/style.css"
echo "Archivos web: $REPO/build-web/web"
echo "Sirve con: cd '$REPO/build-web/web' && python3 -m http.server 8080"
