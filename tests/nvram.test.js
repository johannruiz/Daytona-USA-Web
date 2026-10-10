import {test} from 'node:test';
import assert from 'node:assert/strict';
import {restoreNVRAM,DEFAULT_EEPROM,STORAGE_ID} from '../web/nvram.js';
function engine(){return {HEAPU8:new Uint8Array(256),_daytona_eeprom_ptr:()=>0,_daytona_eeprom_size:()=>128,_daytona_backup_ptr:()=>128,_daytona_backup_size:()=>128};}
test('first run uses the original Single / Export preset and blank backup RAM',()=>{
 const m=engine();assert.equal(restoreNVRAM(m,{getItem:()=>null}),false);
 assert.deepEqual(m.HEAPU8.slice(0,128),DEFAULT_EEPROM);
 assert.ok(m.HEAPU8.slice(128).every(n=>n===255));
});
test('existing saved settings and credits are preserved byte for byte',()=>{
 const m=engine(),saved={eeprom:Array(128).fill(17),backup:Array(128).fill(42)};
 assert.equal(restoreNVRAM(m,{getItem:key=>{assert.equal(key,STORAGE_ID);return JSON.stringify(saved);}}),true);
 assert.deepEqual(Array.from(m.HEAPU8.slice(0,128)),saved.eeprom);
 assert.deepEqual(Array.from(m.HEAPU8.slice(128)),saved.backup);
});
test('unusable or inaccessible storage falls back to clean first-run settings',()=>{
 for(const getItem of [()=>'{',()=>JSON.stringify({eeprom:[-1],backup:[]}),()=>{throw Error('disabled')}]){
  const m=engine();assert.equal(restoreNVRAM(m,{getItem}),false);
  assert.deepEqual(m.HEAPU8.slice(0,128),DEFAULT_EEPROM);
 }
});
