# Daytona USA WebAssembly — port en desarrollo (fase de integración)

El objetivo de este proyecto es trasladar al navegador **el motor original** de
[alphanu1/daytona-arcade-recomp](https://github.com/alphanu1/daytona-arcade-recomp),
no recrear Daytona USA en JavaScript. Se emplea el código recompilado del i960,
TGP y 68000, los recursos de la ROM del usuario y el renderizador de referencia
(`runtime/geo.cpp`, `raster.cpp`, `video.cpp`).

**Estado de esta entrega: puente C++ y frontend web implementados; NO es un
juego web listo para abrir.** Se necesita compilar el proyecto con Emscripten,
lo cual no fue posible en el entorno de entrega (sin emsdk ni clon completo).
Los tests aquí realizados NO sustituyen un arranque real en el navegador.

## Procedimiento de compilación (Linux, macOS o WSL2 en Windows)

1. Descarga las herramientas `git`, `cmake`, `ninja`, `python3`, `clang` y
   el SDK de [Emscripten](https://emscripten.org/docs/getting_started/downloads.html).
2. Clona el proyecto original y consigue sus dependencias ejecutando el setup oficial:

   ```sh
   git clone https://github.com/alphanu1/daytona-arcade-recomp.git
   cd daytona-arcade-recomp
   mkdir -p roms
   # Copia tu ZIP original: aunque tu archivo se llame daytona93.zip,
   # contiene los 30 chips válidos del set Revision A, así que nómbralo daytona.zip.
   cp /ruta/a/daytona93.zip roms/daytona.zip
   ./setup.sh
   python3 scripts/recompile.py --set daytona --build-dir build-daytona
   ```

3. Activa Emscripten en esa terminal:

   ```sh
   source /ruta/al/emsdk/emsdk_env.sh
   ```

4. Descomprime este paquete, y **desde su carpeta** ejecuta:

   ```sh
   ./scripts/build_web.sh /ruta/a/daytona-arcade-recomp
   ```

   El instalador añade `platform/web/` y una inclusión limitada a Emscripten
   en `CMakeLists.txt`. Si el upstream cambia, puede necesitar un ajuste.

5. Si compila, levanta un servidor HTTP local:

   ```sh
   cd /ruta/a/daytona-arcade-recomp/build-web/web
   python3 -m http.server 8080
   ```

   Abre http://localhost:8080 y selecciona en la página la misma ROM ZIP
   original. **No basta con abrir `index.html` con file://.**

Los ficheros esperados en `build-web/web/` son
`index.html`, `main.js`, `style.css`, `daytona_engine.js` y
`daytona_engine.wasm`. Si faltan los dos últimos, la interfaz informa
que todavía no dispone del motor compilado.

## Qué conserva del arcade

- Lógica original del juego generada desde la Revision A (`daytona`), no lógica inventada.
- Mapas, coches, física y cámaras originales, leídos de la ROM del usuario.
- Renderizador de referencia del recompilador, con la geometría de Sega Model 2;
  se muestra en 496 × 384 sin reducción previa.
- Entrada analógica en valores de la placa arcade, marchas y vista.
- Placa de sonido YM3438 + MultiPCM (habilitable al cargar), con mezcla
  experimental hacia WebAudio a 48 kHz.
- EEPROM y backup RAM guardados localmente en el navegador tras la carrera.

## Qué falta validar o mejorar

1. **Compilar en Emscripten** y corregir cualquier incompatibilidad entre la
   versión real del código y la toolchain web. Aquí solo se verificó el C++
   del puente contra dobles mínimos de sus APIs.
2. **Arranque real:** la web debe ejecutar al menos una carrera y mostrar la
   imagen con el renderizador de referencia sin errores.
3. **Rendimiento:** el renderizador fiel por CPU puede ser demasiado lento
   en WebAssembly. El primer objetivo es corrección, luego portar a WebGL2
   o WebGPU el renderizador SDL_GPU para llegar a ~57,52 FPS.
4. **Audio:** la aproximación de re-muestreo está implementada, pero no
   comprobada acústicamente ni contra una traza de referencia.
5. **Persistencia, mando y navegación:** probar uso prolongado, gamepads,
   pantallas de configuración y reinicio en varios navegadores.
6. **Multiplayer/link y opciones avanzadas** todavía no adaptadas al navegador.

Importante para la Revision A de 1994: sus ajustes originales pueden iniciar
como una pareja de cabinas enlazadas. En modo test (F2), GAME SYSTEM permite
seleccionar una cabina única. La EEPROM se guarda en localStorage para próximas
sesiones.

## Controles

- Flechas izquierda/derecha: volante; arriba/abajo: acelerador/freno.
- `5` moneda, Enter inicio, `1`–`4` marchas, `Q` / `W` reducir/subir marcha.
- `A`–`F`: vistas VR1–VR4; `F2` test; `F3` servicio.
- Gamepad estándar: stick izquierdo, gatillos, botones frontales y hombros.

## Licencias y ROM

El código del recompilador principal es BSD-3-Clause; los fragmentos tomados
originariamente de MAME mantienen sus avisos correspondientes, y algunas
bibliotecas externas tienen licencias propias. Consulta `THIRD_PARTY.md`
del repositorio original. Daytona USA y sus recursos pertenecen a SEGA.
Este paquete no contiene ninguna ROM, gráficos del juego ni código generado
procedente de sus ROMs; el usuario aporta el archivo localmente.

## Verificaciones de esta entrega

- ZIP adjuntado: 30/30 componentes Revision A con CRC esperado.
- Compilación nativa de prueba del puente C++ contra interfaces mínimas simuladas.
- Análisis sintáctico de `main.js`, scripts de instalación y CMake.
- **No** hay un `.wasm` ni un navegador mostrando el juego original en esta entrega.
