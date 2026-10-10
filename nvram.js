// First-run settings saved by the original arcade menu: Single / Export.
// Credits are not part of this EEPROM preset; backup RAM starts blank.
export const DEFAULT_EEPROM = Uint8Array.from([83, 69, 71, 65, 64, 130, 2, 0, 186, 122, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 0, 1, 1, 0, 0, 0, 1, 2, 0, 0, 0, 0, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 2, 20, 28, 0, 1, 0, 1, 4, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 2, 0, 0, 0]);
export const STORAGE_ID = 'daytona-web-rev-a-nvram-v1';
export function restoreNVRAM(wasm, storage = localStorage) {
  let saved;
  try { saved = JSON.parse(storage.getItem(STORAGE_ID) || 'null'); } catch {}
  const regions = [['eeprom', '_daytona_eeprom_ptr', '_daytona_eeprom_size'], ['backup', '_daytona_backup_ptr', '_daytona_backup_size']];
  const valid = regions.every(([key,, size]) => Array.isArray(saved?.[key]) && saved[key].length === wasm[size]() && saved[key].every(n => Number.isInteger(n) && n >= 0 && n <= 255));
  if (valid) {
    for (const [key, ptr] of regions) wasm.HEAPU8.set(saved[key], wasm[ptr]());
    return true;
  }
  if (wasm._daytona_eeprom_size() !== DEFAULT_EEPROM.length) throw Error('The engine uses an unsupported settings format.');
  wasm.HEAPU8.set(DEFAULT_EEPROM, wasm._daytona_eeprom_ptr());
  const backup = wasm._daytona_backup_ptr();
  wasm.HEAPU8.fill(255, backup, backup + wasm._daytona_backup_size());
  return false;
}
