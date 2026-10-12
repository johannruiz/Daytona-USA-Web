# Included by original repository's top-level CMakeLists.txt only for Emscripten.
# runtime, softfloat, i960, ymfm, etc are defined by that root CMake project.
set(WEB_GEN_DIR "${M2_GEN_ROOT}/${M2_ROMSET}")
set(WEB_TGP "${M2_GEN_ROOT}/${M2_ROMSET}_tgp/tgp_gen.cpp")
set(WEB_SND "${M2_GEN_ROOT}/${M2_ROMSET}_snd/snd_gen.cpp")
if(NOT EXISTS "${WEB_GEN_DIR}/gen_table.cpp" OR NOT EXISTS "${WEB_TGP}" OR NOT EXISTS "${WEB_SND}")
    message(FATAL_ERROR "Faltan los C++ generados. Ejecuta recompile.py --set daytona --build-dir build-daytona en el host")
endif()
file(GLOB WEB_GEN_SOURCES CONFIGURE_DEPENDS "${WEB_GEN_DIR}/*.cpp")
add_executable(daytona_web platform/web/daytona_web.cpp platform/web/daytona_gpu.cpp ${WEB_GEN_SOURCES} ${WEB_TGP} ${WEB_SND})
target_include_directories(daytona_web PRIVATE "${CMAKE_SOURCE_DIR}/src")
target_link_libraries(daytona_web PRIVATE runtime)
# Exceptions are used by the ROM importer and the game runtime.
# Emscripten otherwise disables them and rejects throw/catch at build time.
target_compile_options(runtime PUBLIC -fexceptions)
target_compile_definitions(runtime PRIVATE M2_WEBGPU=1)
target_compile_options(ymfm PRIVATE -fexceptions)
target_compile_options(i960 PRIVATE -fexceptions)
target_compile_options(trace PRIVATE -fexceptions)
target_compile_options(daytona_web PRIVATE -O3 -fexceptions -fno-fast-math -ffp-contract=off)
# Catching exceptions is necessary: importer reports invalid ROM files.
set_target_properties(daytona_web PROPERTIES
    SUFFIX ".js"
    OUTPUT_NAME "daytona_engine"
    RUNTIME_OUTPUT_DIRECTORY "${CMAKE_BINARY_DIR}/web")
target_link_options(daytona_web PRIVATE
    -O3
    -fexceptions
    --no-entry
    -sMODULARIZE=1
    -sEXPORT_NAME=createDaytonaModule
    -sALLOW_MEMORY_GROWTH=1
    -sINITIAL_MEMORY=268435456
    -sMAXIMUM_MEMORY=1073741824
    -sSTACK_SIZE=16777216
    -sFILESYSTEM=1
    -sENVIRONMENT=web
    "-sEXPORTED_FUNCTIONS=['_daytona_set_display','_daytona_load','_daytona_error','_daytona_close','_daytona_ready','_daytona_width','_daytona_height','_daytona_frame_ptr','_daytona_step','_daytona_audio_frames','_daytona_audio_ptr','_daytona_total_frames','_daytona_eeprom_ptr','_daytona_eeprom_size','_daytona_backup_ptr','_daytona_backup_size','_daytona_eeprom_dirty','_daytona_vertices_ptr','_daytona_vertices_count','_daytona_batches_ptr','_daytona_batches_count','_daytona_background_ptr','_daytona_foreground_ptr','_daytona_tex0_ptr','_daytona_tex1_ptr','_daytona_texture_generation','_daytona_luma_ptr','_daytona_xlat_ptr','_daytona_rumble_strong','_daytona_rumble_weak','_daytona_rumble_centring','_daytona_set_draw_distance','_daytona_draw_distance']"
    "-sEXPORTED_RUNTIME_METHODS=['FS','ccall','HEAPU8','HEAPF32']")

foreach(WEB_ASSET index.html main.js style.css renderer.js model2.wgsl nvram.js touch.js haptics.js preferences.js steering.js wheel.js wheel-controls.js daytona-logo.png)
    configure_file("${CMAKE_SOURCE_DIR}/platform/web/${WEB_ASSET}" "${CMAKE_BINARY_DIR}/web/${WEB_ASSET}" COPYONLY)
endforeach()
