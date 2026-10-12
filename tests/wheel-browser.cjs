const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const url=process.env.TEST_URL || 'http://127.0.0.1:8081';
function fakeDevices(){
 const make=(id,index,axes,mapping='')=>({id,index,axes,mapping,connected:true,buttons:Array.from({length:16},()=>({pressed:false,value:0}))});
 window.testPads=[make('Test USB racing wheel',0,[0,1]),make('Test separate USB pedals',2,[1,-1]),make('Test standard controller',5,[0,0],'standard')];
 Object.defineProperty(navigator,'getGamepads',{configurable:true,value:()=>testPads});
}
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:720}}),page=await context.newPage(),errors=[];
  page.on('pageerror',error=>errors.push(error.message));await page.addInitScript(fakeDevices);
  await page.goto(url);await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.evaluate(async()=>window.arcadeState=(await import('/main.js')).getArcadeState);
  await page.click('#settingsBtn');await page.click('#experimentalTab');
  await page.locator('#experimentalTab').focus();await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.id),'wheelDevice');
  await page.keyboard.press('Tab');assert.equal(await page.evaluate(()=>document.activeElement.tagName),'SUMMARY');
  await page.waitForFunction(()=>document.querySelector('#wheelDevice').options.length>=4);
  await page.selectOption('#wheelDevice','Test USB racing wheel');
  assert.equal(await page.locator('#wheelEnabled').isDisabled(),true);
  await page.click('#wheel-steering-learn');await page.evaluate(()=>testPads[0].axes[0]=0.4);
  await page.waitForFunction(()=>document.querySelector('#wheel-steering-binding').value.includes('"index":0'));
  await page.evaluate(()=>testPads[0].axes[0]=0);await page.click('#wheel-steering-center');
  await page.evaluate(()=>testPads[0].axes[0]=-0.8);await page.click('#wheel-steering-left');
  await page.evaluate(()=>testPads[0].axes[0]=0.6);await page.click('#wheel-steering-right');
  assert.equal(await page.locator('#wheelEnabled').isDisabled(),false);await page.check('#wheelEnabled');
  await page.locator('#wheelControls summary').filter({hasText:/^Pedals$/}).click();
  await page.click('#wheel-accel-learn');await page.evaluate(()=>testPads[1].axes[0]=-0.8);
  await page.waitForFunction(()=>document.querySelector('#wheel-accel-binding').value.includes('Test separate USB pedals'));
  await page.evaluate(()=>testPads[1].axes[0]=1);await page.click('#wheel-accel-rest');
  await page.evaluate(()=>testPads[1].axes[0]=-1);await page.click('#wheel-accel-full');
  await page.click('#wheel-brake-learn');await page.evaluate(()=>testPads[1].axes[1]=0.8);
  await page.waitForFunction(()=>document.querySelector('#wheel-brake-binding').value.includes('"index":1'));
  await page.evaluate(()=>testPads[1].axes[1]=-1);await page.click('#wheel-brake-rest');
  await page.evaluate(()=>testPads[1].axes[1]=1);await page.click('#wheel-brake-full');
  await page.waitForFunction(()=>arcadeState().wheel.accel===100 && arcadeState().wheel.brake===100);
  fs.mkdirSync('build',{recursive:true});await page.screenshot({path:'build/wheel-pedals-desktop.png'});
  await page.locator('#wheelControls summary').filter({hasText:/^Gears & buttons$/}).click();
  await page.click('#wheel-gear4-learn');await page.evaluate(()=>testPads[0].buttons[3]={pressed:true,value:1});
  await page.waitForFunction(()=>document.querySelector('#wheel-gear4-binding').value.includes('"index":3'));
  await page.evaluate(()=>testPads[0].buttons[3]={pressed:false,value:0});
  await page.click('#wheel-view1-learn');await page.evaluate(()=>testPads[0].axes[1]=-1);
  await page.waitForFunction(()=>document.querySelector('#wheel-view1-binding').value.includes('axis-button'));
  for(const [action,index] of [['coin',0],['start',9]])await page.selectOption(`#wheel-${action}-binding`,JSON.stringify({deviceId:'Test USB racing wheel',deviceIndex:0,type:'button',index}));
  await page.click('#wheel-shiftUp-learn');await page.keyboard.press('Escape');
  assert.equal(await page.locator('#experimentalPanel').isVisible(),true);
  assert.equal(await page.locator('#wheelCancel').isVisible(),false);
  assert.equal(await page.locator('#wheel-shiftUp-binding').inputValue(),'');
  await page.screenshot({path:'build/wheel-buttons-desktop.png'});
  await page.locator('#wheelControls summary').filter({hasText:/^Gears & buttons$/}).click();
  await page.locator('#wheelControls summary').filter({hasText:/^Pedals$/}).click();
  await page.evaluate(()=>document.querySelector('#overlay').scrollTop=0);
  fs.mkdirSync('build',{recursive:true});await page.screenshot({path:'build/wheel-experimental-desktop.png'});
  await page.reload();await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await page.evaluate(async()=>window.arcadeState=(await import('/main.js')).getArcadeState);
  assert.equal(await page.evaluate(()=>arcadeState().wheel.active),true);
  await page.click('#settingsBtn');await page.click('#experimentalTab');
  assert.equal(await page.locator('#wheelDevice').inputValue(),'Test USB racing wheel');
  assert.equal(await page.locator('#wheelEnabled').isChecked(),true);
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.querySelector('.launcher-content').scrollWidth<=document.querySelector('.launcher-content').clientWidth),true);
  await page.screenshot({path:'build/wheel-experimental-mobile.png'});
  assert.deepEqual(errors,[]);

  // Spy on the WASM host boundary, with no ROM/physics simulation. Production
  // main.js and all wheel UI/normalisation code remain real in this page.
  const host=await page.context().newPage();await host.addInitScript(fakeDevices);
  await host.route('**/renderer.js',route=>route.fulfill({contentType:'text/javascript',body:'export async function createRenderer(){return {prepare(){},draw(){},setDrawDistance(){},reset(){}};}'}));
  await host.route('**/daytona_engine.js',route=>route.fulfill({contentType:'text/javascript',body:`
    window.hostInputs=[];window.createDaytonaModule=async()=>{
      let frames=0,distance=2;const engine={HEAPU8:new Uint8Array(1024)};
      for(const name of ['set_display','vertices_ptr','vertices_count','batches_ptr','batches_count','background_ptr','foreground_ptr','tex0_ptr','tex1_ptr','texture_generation','luma_ptr','xlat_ptr','rumble_strong','rumble_weak','rumble_centring','eeprom_dirty','eeprom_ptr','eeprom_size','backup_ptr','backup_size'])engine['_daytona_'+name]=()=>0;
      engine._daytona_ready=()=>1;engine._daytona_total_frames=()=>frames;
      engine._daytona_width=()=>496;engine._daytona_height=()=>384;
      engine._daytona_set_draw_distance=value=>distance=value;engine._daytona_draw_distance=()=>distance;
      engine._daytona_step=(...input)=>{frames++;hostInputs.push(input);if(hostInputs.length>300)hostInputs.shift();return 1;};return engine;
    };` }));
  await host.goto(url);await host.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
  await host.evaluate(()=>document.querySelector('#startBtn').disabled=false);await host.click('#startBtn');
  await host.evaluate(()=>{testPads[0].axes[0]=0.6;testPads[1].axes=[-1,1];testPads[2].axes[0]=-1;});
  await host.waitForFunction(()=>hostInputs.some(input=>input[0]===100 && input[1]===100 && input[2]===100));
  await host.evaluate(()=>{hostInputs.length=0;testPads[0].buttons[3]={pressed:true,value:1};testPads[0].axes[1]=-1;testPads[0].buttons[0]={pressed:true,value:1};testPads[0].buttons[9]={pressed:true,value:1};});
  await host.waitForFunction(()=>hostInputs.some(input=>input[3]===4 && input[4]===19));
  await host.keyboard.down('ArrowLeft');await host.waitForFunction(()=>hostInputs.at(-1)?.[0]===-100);await host.keyboard.up('ArrowLeft');
  await host.evaluate(()=>{hostInputs.length=0;testPads=testPads.filter(pad=>pad.index!==2);});
  await host.waitForFunction(()=>hostInputs.some(input=>input[0]===100 && input[1]===0 && input[2]===0));
  await host.evaluate(()=>{hostInputs.length=0;testPads=testPads.filter(pad=>pad.index!==0);testPads[0].axes[0]=0;});
  await host.waitForFunction(()=>hostInputs.some(input=>input[0]===0 && input[1]===0 && input[2]===0 && input[4]===0));
  await host.close();
  console.log('Wheel checks passed: live assignment, asymmetric calibration, separate/reversed pedals, hats/gears, Escape cancellation, saved profiles, mobile layout and production input routing into a WASM boundary spy. Devices and game boundary were simulated; no physical wheel/ROM was used.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
