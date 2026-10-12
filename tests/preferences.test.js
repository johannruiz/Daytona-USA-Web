import test from 'node:test';
import assert from 'node:assert/strict';
import {DEFAULT_SETTINGS,SETTINGS_ID,loadSettings,saveSettings} from '../web/preferences.js';

test('fresh settings choose desktop 2x or mobile 1x, retaining the established joystick response',()=>{
  assert.deepEqual(loadSettings({getItem:()=>null}),{vibrationEnabled:true,rumble:1,centring:0.05,drawDistance:2,volume:1,joystickSensitivity:1});
  assert.deepEqual(loadSettings({getItem:()=>null},{mobile:true}),{...DEFAULT_SETTINGS,drawDistance:1});
});
test('off retains the player intensities and every category survives saving/reloading',()=>{
  let stored;
  const storage={setItem(key,value){assert.equal(key,SETTINGS_ID);stored=value;},getItem(){return stored;}};
  const settings={vibrationEnabled:false,rumble:0.8,centring:0.1,drawDistance:2,volume:0.35,joystickSensitivity:0.5};
  saveSettings(storage,settings);assert.deepEqual(loadSettings(storage),settings);
  assert.deepEqual(loadSettings(storage,{mobile:true}),settings);
});

test('sensitivity is bounded and older settings receive the existing response by default',()=>{
  assert.equal(loadSettings({getItem:()=>JSON.stringify({joystickSensitivity:20})}).joystickSensitivity,1.75);
  assert.equal(loadSettings({getItem:()=>JSON.stringify({joystickSensitivity:-1})}).joystickSensitivity,0.25);
  assert.equal(loadSettings({getItem:()=>JSON.stringify({drawDistance:0})}).joystickSensitivity,1);
});
test('invalid or inaccessible preferences fall back, and bounded values cannot exceed their limits',()=>{
  assert.deepEqual(loadSettings({getItem(){throw Error('denied');}}),DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings({getItem:()=>'{invalid'}),DEFAULT_SETTINGS);
  assert.deepEqual(loadSettings({getItem:()=>JSON.stringify({volume:3,rumble:-1,centring:'5%',drawDistance:7,vibrationEnabled:'false'})}),{...DEFAULT_SETTINGS,volume:1,rumble:0});
  assert.doesNotThrow(()=>saveSettings({setItem(){throw Error('denied');}},DEFAULT_SETTINGS));
});
