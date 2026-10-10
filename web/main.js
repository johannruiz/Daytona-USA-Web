// Daytona USA browser host. The wasm module is the original recomp game's
// native game loop, not a JavaScript reconstruction of Daytona.
const $ = (id) => document.getElementById(id);
const ui = {
  input: $('romInput'), dropzone: $('dropzone'), metadata: $('romMeta'),
  start: $('startBtn'), sound: $('soundBtn'), soundToggle: $('enableAudio'),
  fullscreen: $('fullscreenBtn'), canvas: $('screen'), overlay: $('overlay'),
  message: $('message'), status: $('status'), dot: $('statusDot'),
  frames: $('frames'), fps: $('fps'), resolution: $('resolution')
};
let wasm = null, renderer = null, started = false, running = false;
let ctxAudio = null, audioNext = 0;
let lastTime = 0, lagMs = 0, statTime = performance.now(), rendered = 0;
const FIXED_MS = 1000 / (16000000 / (656 * 424));
const held = new Set();
let currentGear = 1;
let padStartPrev = false, padSelectPrev = false;
let audioLoaded = false;
const STORAGE_ID = 'daytona-web-rev-a-nvram-v1';
function saveNVRAM() {
  if(!wasm?._daytona_ready())return;
  try {
    const read=(fnPtr,fnLen)=>Array.from(wasm.HEAPU8.subarray(wasm[fnPtr](),wasm[fnPtr]()+wasm[fnLen]()));
    const eeprom=read('_daytona_eeprom_ptr','_daytona_eeprom_size');
    const backup=read('_daytona_backup_ptr','_daytona_backup_size');
    localStorage.setItem(STORAGE_ID,JSON.stringify({eeprom,backup}));
  }catch(e){console.warn('NVRAM: no se pudo guardar',e);}
}
function restoreNVRAM() {
  try {
    const value=JSON.parse(localStorage.getItem(STORAGE_ID)||'null');
    if(!value)return;
    for(const [key,fnPtr,fnLen] of [
      ['eeprom','_daytona_eeprom_ptr','_daytona_eeprom_size'],
      ['backup','_daytona_backup_ptr','_daytona_backup_size']]) {
      const bytes=value[key];
      if(!Array.isArray(bytes) || bytes.length!==wasm[fnLen]())continue;
      wasm.HEAPU8.set(Uint8Array.from(bytes),wasm[fnPtr]());
    }
  }catch(e){console.warn('NVRAM: no se pudo recuperar',e);}
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
  ui.overlay.hidden = false;
  ui.message.textContent = message;
  console.error(message);
}
function createRenderer(canvas) {
  const gl = canvas.getContext('webgl2', { alpha: false, antialias: false, preserveDrawingBuffer: false });
  if (gl) {
    const shader = (type, code) => {
      const s = gl.createShader(type);
      gl.shaderSource(s, code); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      return s;
    };
    const vert = shader(gl.VERTEX_SHADER, `#version 300 es
      precision highp float;
      out vec2 uv;
      void main() {
        vec2 p[6] = vec2[6](vec2(-1,-1),vec2(1,-1),vec2(-1,1),vec2(-1,1),vec2(1,-1),vec2(1,1));
        vec2 xy=p[gl_VertexID];
        gl_Position=vec4(xy,0.,1.);
        uv=vec2((xy.x+1.)*.5,1.-(xy.y+1.)*.5);
      }`);
    const frag = shader(gl.FRAGMENT_SHADER, `#version 300 es
      precision mediump float;
      in vec2 uv;
      uniform sampler2D tex;
      out vec4 pixel;
      void main(){ vec4 rgba=texture(tex,uv); pixel=rgba.bgra; }`);
    const prg = gl.createProgram(); gl.attachShader(prg,vert); gl.attachShader(prg,frag);gl.linkProgram(prg);
    if (!gl.getProgramParameter(prg, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(prg));
    const tex=gl.createTexture();gl.bindTexture(gl.TEXTURE_2D,tex);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MIN_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_MAG_FILTER,gl.NEAREST);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_S,gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D,gl.TEXTURE_WRAP_T,gl.CLAMP_TO_EDGE);
    const vao=gl.createVertexArray();gl.bindVertexArray(vao);
    gl.useProgram(prg);gl.uniform1i(gl.getUniformLocation(prg,'tex'),0);
    gl.pixelStorei(gl.UNPACK_ALIGNMENT,1);
    let w=0,h=0;
    return {
      draw(bytes,width,height) {
        gl.viewport(0,0,canvas.width,canvas.height);
        gl.bindTexture(gl.TEXTURE_2D,tex);
        if(w!==width || h!==height) {
          w=width; h=height;
          gl.texImage2D(gl.TEXTURE_2D,0,gl.RGBA,width,height,0,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        } else gl.texSubImage2D(gl.TEXTURE_2D,0,0,0,width,height,gl.RGBA,gl.UNSIGNED_BYTE,bytes);
        gl.drawArrays(gl.TRIANGLES,0,6);
      }
    };
  }
  // Basic Canvas 2D fallback: BGRA memory => RGBA pixels.
  const cx=canvas.getContext('2d',{alpha:false});
  const image=cx.createImageData(canvas.width,canvas.height);
  const ints=new Uint32Array(image.data.buffer);
  return { draw(bytes,w,h) {
    const words=new Uint32Array(bytes.buffer,bytes.byteOffset,w*h);
    for(let i=0;i<words.length;i++) {
      const c=words[i]; ints[i]=(c&0xff00ff00)|((c&0xff)<<16)|((c>>>16)&0xff);
    }
    cx.putImageData(image,0,0);
  }};
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
  const steerKey=Number(held.has('ArrowRight'))-Number(held.has('ArrowLeft'));
  let buttons=pad.buttons;
  if(held.has('Digit5')) buttons|=1;
  if(held.has('Enter')) buttons|=2;
  if(held.has('F2')) buttons|=4;
  if(held.has('F3')) buttons|=8;
  for(let i=0;i<4;i++)if(held.has('Key'+('ASDF'[i]))) buttons|=(1<<(4+i));
  return {steer:steerKey?steerKey*100:pad.steer,
    accel:held.has('ArrowUp')?100:pad.accel,
    brake:held.has('ArrowDown')?100:pad.brake,
    gear:currentGear,buttons};
}
const keyActions = new Set(['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space','Enter','Digit5','KeyQ','KeyW','F2','F3','Digit1','Digit2','Digit3','Digit4','KeyA','KeyS','KeyD','KeyF']);
window.addEventListener('keydown',(event)=>{
  if(!keyActions.has(event.code)||event.target?.tagName==='INPUT')return;
  if(started)event.preventDefault();
  if((event.code==='KeyQ'||event.code==='KeyW')&&!held.has(event.code))currentGear=Math.max(1,Math.min(4,currentGear+(event.code==='KeyW'?1:-1)));
  if(/^Digit[1-4]$/.test(event.code))currentGear=Number(event.code.at(-1));
  held.add(event.code);
});
window.addEventListener('keyup',(event)=>held.delete(event.code));
window.addEventListener('blur',()=>held.clear());

function pushAudio() {
  if(!ctxAudio || ctxAudio.state!=='running' || !audioLoaded)return;
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
  const ptr=wasm._daytona_frame_ptr();
  const width=wasm._daytona_width(),height=wasm._daytona_height();
  if(ptr){renderer.draw(wasm.HEAPU8.subarray(ptr,ptr+width*height*4),width,height);rendered++;}
  if(now-statTime>1000){ui.fps.textContent=String(Math.round(rendered*1000/(now-statTime)));ui.frames.textContent=String(wasm._daytona_total_frames());rendered=0;statTime=now;}
}

async function activateAudio() {
  try {
    ctxAudio ??= new (window.AudioContext||window.webkitAudioContext)({sampleRate:48000});
    await ctxAudio.resume();audioNext=ctxAudio.currentTime+0.05;
    ui.sound.textContent='Audio activo';
  }catch(err){ ui.sound.textContent='Sin audio';console.warn(err); }
}
async function loadROM(file) {
  if(!wasm){failure('El motor WebAssembly todavía no está disponible.');return;}
  if(!/\.zip$/i.test(file.name)){failure('Selecciona un archivo ZIP compatible con Daytona Revision A (1994).');return;}
  running=false;started=false;ui.start.disabled=true;
  ui.metadata.textContent=`Leyendo ${file.name} (${(file.size/1048576).toFixed(1)} MB)…`;
  setStatus('Validando ROM original…');
  try {
    const binary=new Uint8Array(await file.arrayBuffer());
    try{wasm.FS.mkdir('/roms');}catch{}
    const path='/roms/user_daytona.zip';
    try{wasm.FS.unlink(path);}catch{}
    wasm.FS.writeFile(path,binary);
    audioLoaded=ui.soundToggle.checked;
    const loaded=wasm._daytona_load(path,Number(audioLoaded));
    if(!loaded)throw Error(cString(wasm._daytona_error()));
    restoreNVRAM();
    ui.metadata.textContent=`✓ ${file.name} · ROM validada por el motor original`;
    ui.start.disabled=false;ui.sound.disabled=!audioLoaded;
    ui.overlay.hidden=false;ui.message.textContent='ROM cargada. Pulsa Iniciar juego para encender el arcade.';
    setStatus('ROM lista',true);
    ui.resolution.textContent=wasm._daytona_width()+' × '+wasm._daytona_height();
  }catch(err){failure(err.message||String(err));ui.metadata.textContent=err.message||String(err);}
}
ui.input.addEventListener('change',(event)=>{const f=event.target.files?.[0];if(f)loadROM(f);});
for(const name of ['dragenter','dragover'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.add('drag');});
for(const name of ['dragleave','drop'])ui.dropzone.addEventListener(name,e=>{e.preventDefault();ui.dropzone.classList.remove('drag');});
ui.dropzone.addEventListener('drop',(event)=>{const f=event.dataTransfer?.files?.[0];if(f)loadROM(f);});
ui.start.addEventListener('click',async()=>{
  if(!wasm?._daytona_ready())return;
  started=true;running=true;lastTime=0;lagMs=FIXED_MS;ui.overlay.hidden=true;
  setStatus('Motor original en ejecución',true);
  if(audioLoaded)await activateAudio();
});
ui.sound.addEventListener('click',activateAudio);
ui.fullscreen.addEventListener('click',()=>ui.canvas.requestFullscreen?.());

requestAnimationFrame(frame);
async function main() {
  setStatus('Cargando WebAssembly…');
  const factory = typeof createDaytonaModule === 'function' ? createDaytonaModule : window.createDaytonaModule;
  if(typeof factory!=='function'){
    setStatus('Falta la compilación .wasm');
    ui.message.textContent='Este paquete incluye el frontend y el código para compilar el motor original. Ejecuta scripts/build_web.sh para generar daytona_engine.js y .wasm.';
    return;
  }
  try{
    wasm=await factory({locateFile:(path)=>path});
    renderer=createRenderer(ui.canvas);
    setStatus('Motor WebAssembly listo');
    ui.message.textContent='Motor preparado. Selecciona tu ZIP original para iniciar.';
  }catch(err){failure('No se pudo inicializar WebAssembly: '+(err.message||String(err)));}
}
main();
