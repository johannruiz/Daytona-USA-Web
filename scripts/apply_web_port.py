#!/usr/bin/env python3
"""Install the separate web frontend into a checked-out daytona-arcade-recomp.
Keeps the original git state except for platform/web and a targeted CMake edit.
Never copies ROMs or generated game sources into the port package.
"""
from pathlib import Path
import shutil, sys

SOURCE = Path(__file__).resolve().parents[1]
repo = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path.cwd()
cmake = repo / "CMakeLists.txt"
if not cmake.is_file() or not (repo / "src/runtime/game_loop.h").is_file():
    raise SystemExit("Indica la ruta de la carpeta clonada daytona-arcade-recomp")

text = cmake.read_text(encoding="utf-8")
# Avoid SDL3's native GPU frontend during an Emscripten CMake configure.
old = "if(EXISTS ${CMAKE_SOURCE_DIR}/extern/sdl3/CMakeLists.txt)"
new = "if(NOT EMSCRIPTEN AND EXISTS ${CMAKE_SOURCE_DIR}/extern/sdl3/CMakeLists.txt)"
if old in text:
    text = text.replace(old, new, 1)
elif new not in text:
    raise SystemExit("No encuentro la sección SDL3 esperada en CMakeLists.txt: revisión manual requerida")

marker = "# DAYTONA_WEB_PORT_V1"
if marker not in text:
    text += "\n" + marker + "\nif(EMSCRIPTEN)\n    include(${CMAKE_SOURCE_DIR}/platform/web/daytona_web.cmake)\nendif()\n"
cmake.write_text(text, encoding="utf-8")
out = repo / "platform/web"
out.mkdir(parents=True, exist_ok=True)
for name in ("daytona_web.cmake", "daytona_web.cpp"):
    shutil.copy2(SOURCE / "bridge" / name, out / name)
for name in ("index.html", "main.js", "style.css"):
    shutil.copy2(SOURCE / "web" / name, out / name)
print("Web frontend instalado en", out)
print("La compilación debe utilizar M2_ROMSET=daytona y los sources generados desde daytona (1994).")
