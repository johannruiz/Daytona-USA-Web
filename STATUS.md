# Estado comprobable

| Subsystem | Resultado | Evidencia |
|---|---|---|
| Selección ZIP local | Implementación JS | `web/main.js`: `FS.writeFile` |
| Validación CRC y extracción ROM | Enlazado al original | `bridge/daytona_web.cpp`: `rt::import_rom_set` |
| Lógica i960 y TGP | Reutilizada por enlace | Generados `build-daytona/gen`; sin extracción sintética |
| Renderizador | Salida `rt::GameLoop::screen()` | CPU original; WebGL2 solo presenta píxeles |
| Audio | Re-muestreo implementado | No verificado a oído |
| Controles | Mapeo con códigos del original | Comparado con `src/app/controls.cpp` |
| Guardado | Copia EEPROM + backup a localStorage | Requiere prueba real |
| WASM binario | **NO COMPILADO** | Sin Emscripten ni checkout completo en el entorno |
| Jugabilidad/nivel de fidelidad | **NO VALIDADO** | Falta ejecutarlo |

**Nota:** este paquete es fuente de un port, no un resultado jugable verificable.
