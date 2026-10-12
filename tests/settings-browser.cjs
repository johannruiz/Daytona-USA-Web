const {chromium,devices}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try{
  const page=await browser.newPage({viewport:{width:1280,height:720}}),errors=[];
  page.on('pageerror',error=>errors.push(error.message));
  await page.addInitScript(()=>{
   const NativeContext=window.AudioContext;
   window.audioProbe={};
   window.AudioContext=class extends NativeContext {
    constructor(...args){super(...args);audioProbe.context=this;}
    createGain(){const gain=super.createGain();audioProbe.gain=gain;return gain;}
    createBufferSource(){const source=super.createBufferSource(),connect=source.connect.bind(source);
     source.connect=(target,...args)=>{if(target===audioProbe.gain)audioProbe.hostUsesGain=true;return connect(target,...args);};return source;}
   };
  });
  await page.goto(process.env.TEST_URL || 'http://127.0.0.1:8081');
  await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.evaluate(async()=>window.arcadeState=(await import('/main.js')).getArcadeState);
  assert.equal(await page.locator('#rumbleIntensity').isVisible(),false);
  assert.equal(await page.locator('#vibrationEnabled').isChecked(),true);
  assert.equal(await page.evaluate(()=>arcadeState().drawDistance),2);
  await page.click('#settingsBtn');
  assert.equal(await page.locator('#graphicsTab').getAttribute('aria-selected'),'true');
  await page.click('#controllerTab');
  assert.equal(await page.locator('#mainMenu').isVisible(),false);
  assert.equal(await page.locator('#rumbleIntensity').inputValue(),'100');
  assert.equal(await page.locator('#centringIntensity').inputValue(),'5');
  assert.equal(await page.locator('#joystickSensitivity').inputValue(),'100');
  assert.equal(await page.locator('#menuDialog').getAttribute('aria-labelledby'),'settingsTitle');
  await page.locator('#settingsBack').focus();await page.keyboard.press('Shift+Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'joystickSensitivity');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsBack');
  fs.mkdirSync('build',{recursive:true});
  assert.equal(await page.evaluate(()=>document.querySelector('.settings-footer').getBoundingClientRect().bottom<=innerHeight),true);
  await page.screenshot({path:'build/settings-controller-desktop.png'});
  await page.locator('#controllerTab').focus();await page.keyboard.press('ArrowLeft');
  assert.equal(await page.locator('#graphicsTab').getAttribute('aria-selected'),'true');
  await page.check('#distance2');assert.equal(await page.evaluate(()=>arcadeState().drawDistance),2);
  await page.check('#distanceClassic');
  assert.equal(await page.evaluate(()=>arcadeState().drawDistance),0);
  assert.equal(await page.evaluate(()=>arcadeState().enhanced),false);
  await page.locator('#distanceClassic').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsBack');
  await page.check('#distance2');
  await page.screenshot({path:'build/settings-graphics-desktop.png'});
  await page.click('#soundTab');await page.locator('#volumeIntensity').fill('25');
  // Instantiate the actual host Web Audio graph without importing a ROM.
  // These synthetic samples check the gain wiring, not game audio content.
  await page.evaluate(()=>{const sound=document.querySelector('[data-sound]');sound.click();sound.click();});
  await page.waitForFunction(()=>audioProbe.context?.state==='running');
  assert.equal(await page.evaluate(()=>audioProbe.hostUsesGain),true);
  await page.evaluate(()=>{
   const context=audioProbe.context,analyser=context.createAnalyser();analyser.fftSize=2048;
   audioProbe.gain.connect(analyser);
   const buffer=context.createBuffer(1,4096,context.sampleRate);buffer.getChannelData(0).fill(0.5);
   const source=context.createBufferSource();source.buffer=buffer;source.loop=true;source.connect(audioProbe.gain);source.start();
   audioProbe.source=source;audioProbe.level=()=>{const samples=new Float32Array(analyser.fftSize);analyser.getFloatTimeDomainData(samples);return Math.sqrt(samples.reduce((sum,x)=>sum+x*x,0)/samples.length);};
  });
  await page.waitForFunction(()=>Math.abs(audioProbe.level()-0.125)<0.005);
  await page.locator('#volumeIntensity').fill('50');
  await page.waitForFunction(()=>Math.abs(audioProbe.level()-0.25)<0.005);
  await page.locator('#volumeIntensity').fill('0');
  await page.waitForFunction(()=>audioProbe.level()<0.005);
  await page.locator('#volumeIntensity').fill('70');
  await page.waitForFunction(()=>Math.abs(audioProbe.level()-0.35)<0.005);
  await page.evaluate(()=>audioProbe.source.stop());
  await page.evaluate(()=>document.querySelector('[data-sound]').click());
  await page.waitForFunction(()=>arcadeState().soundMuted&&arcadeState().audioState==='suspended');
  assert.equal(await page.evaluate(()=>arcadeState().volume),0.7);
  await page.evaluate(()=>document.querySelector('[data-sound]').click());
  await page.waitForFunction(()=>arcadeState().audioState==='running');
  await page.screenshot({path:'build/settings-sound-desktop.png'});
  await page.keyboard.press('Escape');
  assert.equal(await page.locator('#mainMenu').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.activeElement.id),'settingsBtn');
  await page.uncheck('#vibrationEnabled');await page.click('#settingsBtn');await page.click('#controllerTab');
  assert.equal(await page.locator('#rumbleIntensity').isDisabled(),true);
  assert.equal(await page.locator('#joystickSensitivity').isDisabled(),false);
  assert.equal(await page.locator('#rumbleIntensity').inputValue(),'100');
  await page.check('#settingsVibrationEnabled');assert.equal(await page.locator('#rumbleIntensity').isDisabled(),false);
  await page.locator('#rumbleIntensity').fill('85');await page.locator('#centringIntensity').fill('10');
  await page.locator('#joystickSensitivity').fill('50');
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.evaluate(async()=>window.arcadeState=(await import('/main.js')).getArcadeState);
  assert.equal(await page.evaluate(()=>arcadeState().drawDistance),2);
  await page.click('#settingsBtn');
  assert.equal(await page.locator('#rumbleIntensity').inputValue(),'85');
  assert.equal(await page.locator('#centringIntensity').inputValue(),'10');
  assert.equal(await page.locator('#joystickSensitivity').inputValue(),'50');
  await page.click('#soundTab');assert.equal(await page.locator('#volumeIntensity').inputValue(),'70');
  await page.setViewportSize({width:390,height:844});
  for(const category of ['controller','graphics','sound']){
   await page.click(`#${category}Tab`);
   const fits=await page.evaluate(()=>document.querySelector('.launcher-content').scrollWidth<=document.querySelector('.launcher-content').clientWidth);
   assert.equal(fits,true);await page.screenshot({path:`build/settings-${category}-mobile.png`,fullPage:true});
  }
  assert.deepEqual(errors,[]);
  const mobile=await browser.newPage({...devices['iPhone 13']});
  await mobile.goto(process.env.TEST_URL || 'http://127.0.0.1:8081');
  await mobile.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await mobile.evaluate(async()=>window.arcadeState=(await import('/main.js')).getArcadeState);
  assert.equal(await mobile.evaluate(()=>arcadeState().drawDistance),1);
  await mobile.click('#settingsBtn');
  assert.equal(await mobile.locator('#distance1').isChecked(),true);
  assert.equal(await mobile.locator('#distance1Default').isVisible(),true);
  assert.equal(await mobile.locator('#distance2Default').isVisible(),false);
  await mobile.click('#controllerTab');assert.equal(await mobile.locator('#joystickSensitivity').inputValue(),'100');
  await mobile.screenshot({path:'build/settings-fresh-mobile.png',fullPage:true});await mobile.close();
  console.log('Settings checks passed: categories, keyboard/focus, native distance 0/1/2, defaults, persistence, toggle retention, mobile layout and measured Web Audio volume/mute. No real ROM/controller was used.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
