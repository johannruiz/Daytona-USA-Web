import { createRenderer } from './renderer.js';
import { restoreNVRAM, STORAGE_ID } from './nvram.js';
import { createTouchControls } from './touch.js';
// Daytona USA browser host. The wasm module is the original recomp game's
// native game loop, not a JavaScript reconstruction of Daytona.
const $ = (id) => document.getElementById(id);
const ui = {
  input: $('romInput'), dropzone: $('dropzone'), metadata: $('romMeta'),
  start: $('startBtn'), sound: $('soundBtn'), mode: $('enhancedMode'), modeDescription: $('modeDescription'),
  fullscreen: $('fullscreenBtn'), canvas: $('screen'), overlay: $('overlay'),
  message: $('message'), status: $('status'), fps: $('fps'),
  menu: $('menuBtn'), close: $('closeBtn'), fileLabel: $('fileLabel'), startLabel: $('startLabel')
};
let wasm = null, renderer = null, started = false, running = false;
let ctxAudio = null, audioNext = 0;
let soundMuted = false;
let lastTime = 0, lagMs = 0, statTime = performance.now(), rendered = 0;
const FIXED_MS = 1000 / (16000000 / (656 * 424));
const held = new Set();
let currentGear = 1;
let padStartPrev = false, padSelectPrev = false;
let audioLoaded = false;
let enhanced = true;
const touch=createTouchControls($('touchControls'),{
  isRunning:()=>running,
  shift:amount=>{currentGear=Math.max(1,Math.min(4,currentGear+amount));$('touchGear').textContent=currentGear;},
  menu:()=>openMenu(),
  settings:()=>{const panel=$('touchControls').querySelector('.touch-service');panel.hidden=!panel.hidden;}
});
document.documentElement.classList.toggle('touch-device',navigator.maxTouchPoints>0 || matchMedia('(any-pointer:coarse)').matches);
function saveNVRAM() {
  if(!wasm?._daytona_ready())return;
  try {
    const read=(fnPtr,fnLen)=>Array.from(wasm.HEAPU8.subarray(wasm[fnPtr](),wasm[fnPtr]()+wasm[fnLen]()));
    const eeprom=read('_daytona_eeprom_ptr','_daytona_eeprom_size');
    const backup=read('_daytona_backup_ptr','_daytona_backup_size');
    localStorage.setItem(STORAGE_ID,JSON.stringify({eeprom,backup}));
  }catch(e){console.warn('Could not save arcade settings',e);}
}
function setStatus(text, ok = false) {
  ui.status.textContent = text;
  document.documentElement.classList.toggle('ready', ok);
}
function cString(pointer) {
  const mem = wasm.HEAPU8;
  let end = pointer;
  while (end < mem.length && mem[end]) end++;
  return new TextDecoder().decode(mem.subarray(pointer, end));
}
function failure(message) {
  running = false;
  setStatus('Error');
  openMenu();
  ui.start.disabled=true;
  ui.message.textContent = message;
  console.error(message);
}
function pollGamepad() {
  const pad=[...(navigator.getGamepads?.() ?? [])].find(p=>p&&p.connected);
  if(!pad) return {steer:0,accel:0,brake:0,buttons:0};
  const btn=(i)=>pad.buttons[i]?.pressed ?? false;
  const axis=(i)=>pad.axes[i] ?? 0;
  let buttons=0;
  if(btn(8)) buttons|=1;
  if(btn(9)) buttons|=2;
  if(btn(0)) buttons|=1<<4;
  if(btn(1)) buttons|=1<<5;
  if(btn(2)) buttons|=1<<6;
  if(btn(3)) buttons|=1<<7;
  if(btn(5)&&!padStartPrev)currentGear=Math.min(4,currentGear+1);
  if(btn(4)&&!padSelectPrev)currentGear=Math.max(1,currentGear-1);
  padStartPrev=btn(5);padSelectPrev=btn(4);
  return {
    steer:Math.round(axis(0)*100),
    accel:Math.round(Math.max(0,pad.buttons[7]?.value??0)*100),
    brake:Math.round(Math.max(0,pad.buttons[6]?.value??0)*100),
    buttons
  };
}
function inputs() {
  const pad=pollGamepad();
  const phone=touch.read();
  const steerKey=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft'));
  let buttons=pad.buttons|phone.buttons;
  if(held.has('Digit5')) buttons|=1;
  if(held.has('Enter')) buttons|=2;
  if(held.has('F2')) buttons|=4;
  if(held.has('F3')) buttons|=8;
  for(let i=0;i<4;i++)if(held.has('Key'+('ASDF'[i]))) buttons|=(1<<(4+i));
  $('touchGear').textContent=currentGear;
  return {steer:steerKey?steerKey*100:(phone.steer || pad.steer),
    accel:held.has('ArrowUp')?100:Math.max(pad.accel,phone.accel),
    brake:held.has('ArrowDown')?100:Math.max(pad.brake,phone.brake),
    gear:currentGear,buttons};
}
const keyActions = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Digit5','KeyQ','KeyW','F2','F3','Digit1','Digit2','Digit3','Digit4','KeyA','KeyS','KeyD','KeyF']);
window.addEventListener('keydown',(event)=>{
  if(event.code==='Escape' && started){event.preventDefault();ui.overlay.hidden?openMenu():resumeGame();return;}
  if(!running || !keyActions.has(event.code)||event.target?.tagName==='INPUT')return;
  if(started)event.preventDefault();
  if((event.code==='KeyQ'||event.code==='KeyW')&&!held.has(event.code))currentGear=Math.max(1,Math.min(4,currentGear+(event.code==='KeyW'?1:-1)));
  if(/^Digit[1-4]$/.test(event.code))currentGear=Number(event.code.at(-1));
  held.add(event.code);
});
window.addEventListener('keyup',(event)=>held.delete(event.code));
window.addEventListener('blur',()=>held.clear());

function pushAudio() {
  if(soundMuted || !ctxAudio || ctxAudio.state!=='running' || !audioLoaded)return;
  const frames=wasm._daytona_audio_frames();
  const ptr=wasm._daytona_audio_ptr();
  if(!ptr||frames<=0)return;
  const samples=wasm.HEAPF32.subarray(ptr/4,ptr/4+frames*2);
  const buffer=ctxAudio.createBuffer(2,frames,48000);
  const left=buffer.getChannelData(0),right=buffer.getChannelData(1);
  for(let i=0;i<frames;i++){left[i]=samples[i*2];right[i]=samples[i*2+1];}
  const source=ctxAudio.createBufferSource();source.buffer=buffer;source.connect(ctxAudio.destination);
  const now=ctxAudio.currentTime;
  if(audioNext<now)audioNext=now+0.05;
  if(audioNext>now+0.25)audioNext=now+0.05;
  source.start(audioNext);
  audioNext+=frames/48000;
}
function frame(now) {
  requestAnimationFrame(frame);
  if(!running || !wasm)return;
  renderer.prepare(wasm);
  if(!lastTime)lastTime=now;
  lagMs+=Math.min(120,now-lastTime);lastTime=now;
  // Never block the browser rendering dozens of late game frames.
  for(let n=0;n<2&&lagMs>=FIXED_MS;n++) {
    const i=inputs();
    if(!wasm._daytona_step(i.steer,i.accel,i.brake,i.gear,i.buttons)) {
      failure(cString(wasm._daytona_error()));return;
    }
    pushAudio();
    if(wasm._daytona_eeprom_dirty() || (wasm._daytona_total_frames()%600===0))saveNVRAM();
    lagMs-=FIXED_MS;
  }
  if(lagMs>100)lagMs=FIXED_MS;
  if(wasm._daytona_total_frames()>0){try{renderer.draw(wasm);rendered++;}catch(err){failure(err.message);}}
  if(now-statTime>1000){ui.fps.textContent=String(Math.round(rendered*1000/(now-statTime)));rendered=0;statTime=now;}
}

async function activateAudio() {
  if(soundMuted)return;
  try {
    // Safari's ambient audio session obeys the iPhone silent switch.
    try {if(navigator.audioSession)navigator.audioSession.type='playback';}catch(err){console.warn(err);}
    // Use the device's output rate; the original 48 kHz buffers are resampled.
    if(!ctxAudio || ctxAudio.state==='closed')ctxAudio=new (window.AudioContext||window.webkitAudioContext)();
    // Both calls must occur inside the trusted tap, before awaiting anything.
    const resumed=ctxAudio.resume();
    const unlock=ctxAudio.createBufferSource();
    unlock.buffer=ctxAudio.createBuffer(1,1,ctxAudio.sampleRate);
    unlock.connect(ctxAudio.destination);unlock.onended=()=>unlock.disconnect();unlock.start();
    await resumed;audioNext=ctxAudio.currentTime+0.05;
    updateSoundControls();
  }catch(err){updateSoundControls('Tap to retry sound');console.warn(err);}
}
function updateSoundControls(label=soundMuted?'Unmute sound':'Mute sound') {
  for(const button of [ui.sound,document.querySelector('[data-sound]')]){
    button.setAttribute('aria-label',label);button.title=label;
    button.setAttribute('aria-pressed',String(soundMuted));
    button.textContent=soundMuted?'♪̸':'♫';
  }
}
async function toggleSound() {
  soundMuted=!soundMuted;updateSoundControls();
  if(soundMuted)await ctxAudio?.suspend();
  else await activateAudio();
}
const gameSurface=document.querySelector('.arcade');
// Keep Safari pinch, double-tap zoom, selection and long-press menus off the
// driving surface. The separate launcher retains its normal reading gestures.
for(const name of ['gesturestart','gesturechange','gestureend','contextmenu','selectstart']){
  gameSurface.addEventListener(name,event=>{if(running)event.preventDefault();},{passive:false});
}
gameSurface.addEventListener('pointerdown',()=>{
  if(running && audioLoaded && !soundMuted && ctxAudio?.state!=='running')void activateAudio();
},{capture:true});
async function loadROM(file) {
  if(!wasm){failure('The arcade engine is still loading. Please try again in a moment.');return;}
  if(!/\.zip$/i.test(file.name)){failure('Choose a Daytona USA Revision A (1994) ROM ZIP.');return;}
  running=false;started=false;held.clear();touch.clear();ui.close.hidden=true;ui.start.disabled=true;ui.startLabel.textContent='Enter arcade';
  await ctxAudio?.suspend();
  ui.metadata.textContent=`Reading ${file.name} (${(file.size/1048576).toFixed(1)} MB)…`;
  setStatus('Checking ROM…');
  try {
    const binary=new Uint8Array(await file.arrayBuffer());
    try{wasm.FS.mkdir('/roms');}catch{}
    const path='/roms/user_daytona.zip';
    try{wasm.FS.unlink(path);}catch{}
    wasm.FS.writeFile(path,binary);
    audioLoaded=true;
    const loaded=wasm.ccall('daytona_load','number',['string','number'],[path,Number(audioLoaded)]);
    if(!loaded)throw Error(cString(wasm._daytona_error()));
    renderer.reset();
    restoreNVRAM(wasm);
    ui.metadata.textContent=`✓ ${file.name} · ROM verified · Ready to play`;
    ui.start.disabled=false;ui.sound.disabled=!audioLoaded;
    openMenu();ui.message.textContent='Your arcade is ready. Enter to watch attract mode or play.';
    setStatus('ROM ready',true);
    ui.fileLabel.textContent=file.name;
  }catch(err){failure(err.message||String(err));ui.metadata.textContent=err.message||String(err);}
}
ui.input.addEventListener('change',(event)=>{const f=event.target.files?.[0];if(f)loadROM(f);});
for(const name of ['dragenter','dragover'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.add('drag');});
for(const name of ['dragleave','drop'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.remove('drag');});
ui.dropzone.addEventListener('drop',(event)=>{const f=event.dataTransfer?.files?.[0];if(f)loadROM(f);});
function openMenu() {
  running=false;held.clear();touch.clear();ui.overlay.hidden=false;
  document.documentElement.classList.add('launcher-open');
  ui.close.hidden=!started;
  ui.startLabel.textContent=started?'Resume arcade':'Enter arcade';
  ctxAudio?.suspend().catch(console.warn);
  (started?ui.start:ui.dropzone).focus();
}
async function resumeGame() {
  if(!wasm?._daytona_ready() || ui.start.disabled)return;
  started=true;running=true;held.clear();touch.clear();lastTime=0;lagMs=FIXED_MS;statTime=performance.now();rendered=0;
  ui.overlay.hidden=true;document.documentElement.classList.remove('launcher-open');
  document.documentElement.classList.add('playing');ui.canvas.focus();
  setStatus('Arcade running',true);
  if(audioLoaded)await activateAudio();
}
ui.start.addEventListener('click',resumeGame);
ui.mode.addEventListener('click',()=>{
  enhanced=!enhanced;ui.mode.setAttribute('aria-checked',String(enhanced));
  $('classicLabel').classList.toggle('selected',!enhanced);
  $('enhancedLabel').classList.toggle('selected',enhanced);
  ui.modeDescription.textContent=enhanced?'Native window resolution · Widescreen view':'Original arcade resolution · Original aspect ratio';
  renderer?.setEnhanced(enhanced);
});
ui.menu.addEventListener('click',openMenu);
ui.close.addEventListener('click',resumeGame);
ui.sound.addEventListener('click',toggleSound);
document.querySelector('[data-sound]').addEventListener('click',toggleSound);
ui.fullscreen.addEventListener('click',async()=>{
  if(document.fullscreenElement)await document.exitFullscreen();
  else await document.documentElement.requestFullscreen?.();
});
ui.dropzone.addEventListener('keydown',e=>{
  if(e.key==='Enter'||e.key===' '){e.preventDefault();ui.input.click();}
});
ui.overlay.addEventListener('keydown',e=>{
  if(e.key!=='Tab')return;
  const targets=[...ui.overlay.querySelectorAll('button:not([disabled]):not([hidden]),[tabindex="0"],input[type="checkbox"]')];
  const first=targets[0],last=targets.at(-1);
  if(e.shiftKey && document.activeElement===first){e.preventDefault();last.focus();}
  else if(!e.shiftKey && document.activeElement===last){e.preventDefault();first.focus();}
});
let hudTimer;
function showHUD(){
  document.documentElement.classList.add('hud-visible');clearTimeout(hudTimer);
  hudTimer=setTimeout(()=>document.documentElement.classList.remove('hud-visible'),2200);
}
window.addEventListener('pointermove',showHUD);
window.addEventListener('pointerdown',showHUD);
window.addEventListener('pagehide',saveNVRAM);
document.addEventListener('visibilitychange',()=>{
  if(document.hidden){saveNVRAM();held.clear();if(started)openMenu();}
});
export function getArcadeState(){return {running,enhanced,audioState:ctxAudio?.state||'uninitialized',soundMuted,touch:touch.read(),gear:currentGear,ready:!!wasm?._daytona_ready(),frames:wasm?._daytona_total_frames()||0,width:wasm?._daytona_width(),height:wasm?._daytona_height()};}
document.documentElement.classList.add('launcher-open');
ui.dropzone.focus();

requestAnimationFrame(frame);
async function main() {
  setStatus('Loading engine…');
  const factory = typeof createDaytonaModule === 'function' ? createDaytonaModule : window.createDaytonaModule;
  if(typeof factory!=='function'){
    setStatus('Engine files missing');
    ui.message.textContent='The compiled arcade engine is missing. Run scripts/build_web.ps1, then serve the dist folder.';
    return;
  }
  try{
    wasm=await factory({locateFile:(path)=>path});
    for(const name of ['_daytona_set_display','_daytona_vertices_ptr','_daytona_vertices_count','_daytona_batches_ptr','_daytona_batches_count','_daytona_background_ptr','_daytona_foreground_ptr','_daytona_tex0_ptr','_daytona_tex1_ptr','_daytona_texture_generation','_daytona_luma_ptr','_daytona_xlat_ptr']) {
      if(typeof wasm[name]!=='function')throw Error('Incomplete engine build: missing '+name+'. Run scripts/build_web.ps1 again.');
    }
    renderer=await createRenderer(ui.canvas,failure);
    renderer.setEnhanced(enhanced);
    setStatus('Engine ready');
    ui.message.textContent='Choose your ROM to bring the arcade to life.';
  }catch(err){failure('Could not start the arcade engine: '+(err.message||String(err)));}
}
main();
