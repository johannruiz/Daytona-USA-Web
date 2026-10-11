const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 if(!process.env.TEST_ROM)throw Error('Set TEST_ROM to the local Revision A ROM ZIP');
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:844,height:390},hasTouch:true,isMobile:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{
   // Exercise Safari's audio-session branch and interruption recovery while
   // retaining real browser audio buffers and the actual game engine.
   window.audioProbe={resumes:0,gestureResumes:0,nonzero:false};
   Object.defineProperty(navigator,'audioSession',{value:{type:'auto'}});
   const NativeContext=window.AudioContext;
   window.AudioContext=class extends NativeContext {
    constructor(...args){super(...args);audioProbe.context=this;audioProbe.options=args;}
    get state(){return this.testInterrupted?'interrupted':super.state;}
    resume(){this.testInterrupted=false;audioProbe.resumes++;if(navigator.userActivation.isActive)audioProbe.gestureResumes++;return super.resume();}
    createBufferSource(){const source=super.createBufferSource(),start=source.start.bind(source);
     source.start=(...args)=>{if(source.buffer?.numberOfChannels===2&&source.buffer.getChannelData(0).some(v=>v!==0))audioProbe.nonzero=true;return start(...args);};return source;}
   };
  });
  page.on('console',m=>{if(m.type()==='error'&&!m.text().includes('404'))errors.push(m.text());});
  await page.goto(process.env.TEST_URL || 'http://localhost:8080');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.setInputFiles('#romInput',process.env.TEST_ROM);
  await page.waitForFunction(()=>!document.querySelector('#startBtn').disabled);
  await page.evaluate(async()=>{window.mobileState=(await import('/main.js')).getArcadeState;});
  await page.click('#startBtn');
  await page.waitForFunction(()=>mobileState().frames>=600,null,{timeout:180000});
  assert.equal(await page.locator('#touchControls').isVisible(),true);
  await page.waitForFunction(()=>mobileState().audioState==='running');
  assert.equal(await page.evaluate(()=>navigator.audioSession.type),'playback');
  assert.equal(await page.evaluate(()=>audioProbe.options.length),0);
  assert.ok(await page.evaluate(()=>audioProbe.gestureResumes)>0);
  const suppressed=await page.evaluate(()=>{
   const canvas=document.querySelector('#screen'),gas=document.querySelector('[data-action=gas]');
   return {selection:getComputedStyle(gas).webkitUserSelect,touch:getComputedStyle(canvas).touchAction,
    canceled:['gesturestart','gesturechange','contextmenu','selectstart'].every(type=>!canvas.dispatchEvent(new Event(type,{bubbles:true,cancelable:true})))};
  });
  assert.deepEqual(suppressed,{selection:'none',touch:'none',canceled:true});
  const cdp=await page.context().newCDPSession(page);
  await cdp.send('Input.synthesizePinchGesture',{x:422,y:180,scaleFactor:1.8,gestureSourceType:'touch'});
  assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  await page.tap('[data-action=gas]');await page.tap('[data-action=gas]');
  assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  assert.equal(await page.evaluate(()=>audioProbe.nonzero),true,'The real engine must schedule non-silent stereo audio');
  const point=async(selector,id,xFraction=.5)=>{
   const b=await page.locator(selector).boundingBox();return {x:b.x+b.width*xFraction,y:b.y+b.height*.5,id};
  };
  const send=(type,points)=>cdp.send('Input.dispatchTouchEvent',{type,touchPoints:points});
  const steer=await point('[data-steering]',1,.8),gas=await point('[data-action=gas]',2);
  await send('touchStart',[steer]);await send('touchStart',[steer,gas]);
  await page.waitForFunction(()=>mobileState().touch.steer>50&&mobileState().touch.accel===100);
  await send('touchEnd',[gas]);
  await page.waitForFunction(()=>mobileState().touch.steer>50&&mobileState().touch.accel===0);
  await send('touchCancel',[]);
  assert.equal(await page.evaluate(()=>visualViewport.scale),1);
  assert.equal(await page.evaluate(()=>getSelection().toString()),'');
  assert.deepEqual(await page.evaluate(()=>mobileState().touch),{steer:0,accel:0,brake:0,buttons:0});
  const brake=await point('[data-action=brake]',3);await send('touchStart',[brake]);
  await page.waitForFunction(()=>mobileState().touch.brake===100);await send('touchEnd',[]);
  const up=await point('[data-action=up]',4);await send('touchStart',[up]);await send('touchEnd',[]);
  assert.equal(await page.evaluate(()=>mobileState().gear),2);
  const view=await point('[data-action=camera]',5);await send('touchStart',[view]);
  await page.waitForFunction(()=>mobileState().touch.buttons===32);await send('touchEnd',[]);
  await page.screenshot({path:'build/mobile-landscape-game.png'});
  await page.click('[data-settings]');assert.equal(await page.locator('.touch-service').isVisible(),true);
  await page.click('[data-settings]');
  await page.tap('[data-sound]');
  await page.waitForFunction(()=>mobileState().soundMuted&&mobileState().audioState==='suspended');
  await page.tap('[data-menu]');await page.tap('#startBtn');
  assert.equal(await page.evaluate(()=>mobileState().soundMuted),true);
  await page.tap('[data-sound]');
  await page.waitForFunction(()=>!mobileState().soundMuted&&mobileState().audioState==='running');
  const resumeCount=await page.evaluate(()=>{audioProbe.context.testInterrupted=true;return audioProbe.resumes;});
  await page.tap('[data-action=gas]');
  await page.waitForFunction(count=>audioProbe.resumes>count&&mobileState().audioState==='running',resumeCount);
  await send('touchStart',[gas]);await page.click('[data-menu]');
  assert.equal(await page.locator('#overlay').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.querySelector('#overlay').dispatchEvent(new Event('gesturestart',{bubbles:true,cancelable:true}))),true);
  assert.equal(await page.locator('#touchControls').isVisible(),false);
  assert.equal(await page.evaluate(()=>mobileState().touch.accel),0);
  await send('touchEnd',[]);await page.click('#startBtn');
  await page.setViewportSize({width:390,height:844});
  await page.waitForFunction(()=>document.querySelector('#screen').width===390&&document.querySelector('#screen').height===844&&mobileState().width===496);
  await page.screenshot({path:'build/mobile-portrait-game.png'});
  assert.equal(await page.locator('.rotate-hint').isVisible(),true);
  assert.deepEqual(errors,[]);fs.writeFileSync('build/mobile-errors.json',JSON.stringify(errors));
  console.log('Real-game mobile checks passed: multitouch, gesture/selection guards, audio unlock, mute persistence, simulated Safari session/interruption, pause and portrait/landscape.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
