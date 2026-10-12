#!/usr/bin/env python3
"""Install the separate web frontend into a checked-out daytona-arcade-recomp.
Installs platform/web, patches CMake and keeps CPU tile composition for WebGPU.
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
video = repo / "src/runtime/video.cpp"
video_text = video.read_text(encoding="utf-8")
old_skip = "if (external_3d_ && !desktop_ && system24_gpu_compatible()) {"
if old_skip in video_text and "#ifndef M2_WEBGPU" not in video_text:
    video_text = video_text.replace(old_skip, "#ifndef M2_WEBGPU\n    " + old_skip, 1)
    end_skip = "return;\n    }\n#endif\n#ifdef M2_DC_SPEED"
    if end_skip not in video_text:
        raise SystemExit("No encuentro el cierre de la ruta GXM en video.cpp")
    video_text = video_text.replace(end_skip, "return;\n    }\n#endif // M2_WEBGPU\n#endif\n#ifdef M2_DC_SPEED", 1)
    video.write_text(video_text, encoding="utf-8")
# The web host supplies composed tile layers, while widening the real geometry.
video_text = video.read_text(encoding="utf-8")
wide_guard = "    if (external_3d_ && !desktop_) margin = 0;"
if "#if !defined(M2_WEBGPU)" not in video_text:
    video_text = video_text.replace(wide_guard, "#if !defined(M2_WEBGPU)\n" + wide_guard + "\n#endif", 1)
wide_backdrop = "    if (external_3d_) {\n        // Save the exact two System-24 layers"
if "// WebGPU widened backdrop" not in video_text:
    video_text = video_text.replace(wide_backdrop, """    if (external_3d_) {
#ifdef M2_WEBGPU
        // WebGPU widened backdrop: retain the original 2D art and fill its sides.
        if (margin_) {
            coverage_ = polys.empty() ? 0 : raster_.coverage_estimate(polys, windows, crtc_x_ + margin_, crtc_y_);
            fill_margins();
        }
#endif
        // Save the exact two System-24 layers""", 1)
video.write_text(video_text, encoding="utf-8")
for name in ("daytona_web.cmake", "daytona_web.cpp", "daytona_gpu.cpp", "daytona_gpu.h", "daytona_haptics.h"):
    shutil.copy2(SOURCE / "bridge" / name, out / name)
for name in ("index.html", "main.js", "style.css", "renderer.js", "model2.wgsl", "nvram.js", "touch.js", "haptics.js", "preferences.js", "steering.js", "wheel.js", "wheel-controls.js", "daytona-logo.png"):
    shutil.copy2(SOURCE / "web" / name, out / name)
print("Web frontend instalado en", out)
print("La compilación debe utilizar M2_ROMSET=daytona y los sources generados desde daytona (1994).")
