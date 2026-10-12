// Run with PLAYWRIGHT_PATH set to an installed Playwright package.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('build',{recursive:true});
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try {
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push(e.message));
 page.on('console',msg=>{if(msg.type()==='error' && !msg.text().includes('404'))errors.push(msg.text());});
 await page.goto(process.env.TEST_URL || 'http://localhost:8080');
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
 await page.waitForFunction(()=>document.querySelector('.game-logo img').naturalWidth===1532);
 if(await page.locator('#enableAudio').count())throw Error('Old audio checkbox is still present');
 if(!await page.locator('#vibrationEnabled').isChecked())throw Error('Vibration is not enabled by default');
 if(await page.locator('#rumbleIntensity').isVisible())throw Error('Advanced sliders are visible in the main menu');
 await page.click('#settingsBtn');
 await page.click('#controllerTab');
 if(await page.locator('#rumbleIntensity').inputValue()!=='100')throw Error('Vibration is not at the requested default');
 if(await page.locator('#centringIntensity').inputValue()!=='5')throw Error('Centring is not at the requested default');
 await page.locator('#centringIntensity').fill('0');
 if(await page.locator('#centringValue').innerText()!=='Off')throw Error('Centring off is not reflected in the menu');
 await page.locator('#rumbleIntensity').fill('0');
 if(await page.locator('#rumbleValue').innerText()!=='Off')throw Error('Vibration off is not reflected in the menu');
 await page.reload();
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
 await page.click('#settingsBtn');
 await page.click('#controllerTab');
 if(await page.locator('#rumbleIntensity').inputValue()!=='0')throw Error('Vibration setting was not saved');
 if(await page.locator('#centringIntensity').inputValue()!=='0')throw Error('Centring setting was not saved');
 await page.locator('#rumbleIntensity').fill('100');
 await page.locator('#centringIntensity').fill('5');
 await page.click('#settingsBack');
 await page.waitForTimeout(450);
 await page.screenshot({path:'build/new-launcher-desktop.png'});
 const guideFits=await page.evaluate(()=>document.querySelector('.guide-footer').getBoundingClientRect().bottom<=innerHeight);
 if(!guideFits)throw Error('Desktop controls guide does not fit the viewport');
 await page.setViewportSize({width:390,height:844});
 await page.screenshot({path:'build/new-launcher-mobile.png',fullPage:true});
 const overflow=await page.evaluate(()=>document.querySelector('.launcher-content').scrollWidth>document.querySelector('.launcher-content').clientWidth);
 if(overflow)throw Error('Mobile launcher overflows horizontally');
 await page.evaluate(()=>{const overlay=document.querySelector('#overlay');overlay.scrollTop=overlay.scrollHeight;});
 await page.screenshot({path:'build/new-launcher-mobile-controls.png'});
 await page.evaluate(()=>document.querySelector('#overlay').scrollTop=0);
 await page.setViewportSize({width:1280,height:720});
 console.log('GPU:',await page.evaluate(async()=>{
  const adapter=await navigator.gpu.requestAdapter();
  return adapter ? {vendor:adapter.info.vendor,architecture:adapter.info.architecture,device:adapter.info.device,description:adapter.info.description} : null;
 }));
 if(process.env.TEST_ROM){
  await page.waitForFunction(()=>document.querySelector('#status').textContent.includes('Engine ready')||document.querySelector('#status').textContent==='Error',null,{timeout:120000});
  if(await page.locator('#status').innerText()==='Error')throw Error(await page.locator('#message').innerText());
  await page.setInputFiles('#romInput',process.env.TEST_ROM);
  await page.waitForFunction(()=>!document.querySelector('#startBtn').disabled||document.querySelector('#status').textContent==='Error',null,{timeout:120000});
  if(await page.locator('#startBtn').isDisabled())throw Error(await page.locator('#message').innerText());
  await page.evaluate(async()=>{const host=await import('/main.js');window.setInterval(()=>window.arcadeState=host.getArcadeState(),100);});
  await page.click('#startBtn');
  await page.waitForFunction(()=>window.arcadeState?.frames>=600||document.querySelector('#status').textContent==='Error',null,{timeout:180000});
  if(await page.locator('#status').innerText()==='Error')throw Error(await page.locator('#message').innerText());
  await page.screenshot({path:'build/new-attract.png'});
  const assertDisplay=async(width,height,logicalWidth)=>{
    await page.waitForFunction(([w,h,lw])=>{
      const canvas=document.querySelector('#screen');
      return canvas.width===w && canvas.height===h && window.arcadeState.width===lw;
    },[width,height,logicalWidth]);
  };
  await assertDisplay(1280,720,682);
  await page.setViewportSize({width:1920,height:1080});
  await assertDisplay(1920,1080,682);
  await page.screenshot({path:'build/enhanced-1080p.png'});
  await page.setViewportSize({width:2560,height:720});
  await assertDisplay(2560,720,1366);
  await page.screenshot({path:'build/enhanced-ultrawide.png'});
  await page.setViewportSize({width:1280,height:720});
  await assertDisplay(1280,720,682);
  const metrics=await page.context().newCDPSession(page);
  await metrics.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:2,mobile:false});
  await assertDisplay(2560,1440,682);
  await metrics.send('Emulation.setDeviceMetricsOverride',{width:1280,height:720,deviceScaleFactor:1,mobile:false});
  await assertDisplay(1280,720,682);
  await page.keyboard.press('Escape');
  if(!await page.locator('#overlay').isVisible())throw Error('Escape did not open the arcade menu');
  await page.click('#settingsBtn');await page.click('#graphicsTab');await page.check('#distanceClassic');await page.click('#settingsBack');
  await page.keyboard.press('Escape');
  await assertDisplay(496,384,496);
  await page.screenshot({path:'build/classic-attract.png'});
  await page.keyboard.press('Escape');await page.click('#settingsBtn');await page.click('#graphicsTab');await page.check('#distance1');await page.click('#settingsBack');await page.keyboard.press('Escape');
  await assertDisplay(1280,720,682);
  if(await page.locator('#overlay').isVisible())throw Error('Escape did not resume the game');
  if(await page.locator('#frames').count())throw Error('Frame counter is still in the UI');
  const saved=await page.evaluate(()=>JSON.parse(localStorage.getItem('daytona-web-rev-a-nvram-v1')));
  if(!saved?.eeprom?.length || !saved?.backup?.length)throw Error('NVRAM was not saved after 600 frames');
  console.log(await page.locator('#status').innerText(),await page.evaluate(()=>window.arcadeState.frames),await page.locator('#fps').innerText()+' FPS');
 }else{
  console.log(await page.evaluate(async()=>{
   const {createRenderer}=await import('/renderer.js');
   const canvas=document.querySelector('#screen');
   const renderer=await createRenderer(canvas,m=>{throw Error(m)});
   const mem=new Uint8Array(32768),words=new Uint32Array(mem.buffer);
   words.fill(0xff0000ff,0,1024); // BGRA: blue background
   words[1024+12*32+12]=0xff00ff00; // green foreground over the polygon
   const verts=new DataView(mem.buffer,8192,192);
   for(const [n,x,y] of [[0,4,4],[1,28,4],[2,4,28]]){
    for(const [i,v] of [x,y,0.5,1,0,0,1,0,0,1].entries())verts.setFloat32(n*64+i*4,v,true);
   }
   words.set([0,3,8,8,16,16],16384/4);
   renderer.draw({HEAPU8:mem,_daytona_width:()=>32,_daytona_height:()=>32,
    _daytona_background_ptr:()=>0,_daytona_foreground_ptr:()=>4096,
    _daytona_texture_generation:()=>0,_daytona_tex0_ptr:()=>0,_daytona_tex1_ptr:()=>0,
    _daytona_luma_ptr:()=>0,_daytona_xlat_ptr:()=>0,
    _daytona_vertices_count:()=>3,_daytona_vertices_ptr:()=>8192,
    _daytona_batches_ptr:()=>16384,_daytona_batches_count:()=>1});
   const copy=document.createElement('canvas');copy.width=32;copy.height=32;
   const ctx=copy.getContext('2d');ctx.drawImage(await createImageBitmap(canvas),0,0);
   const pixel=(x,y)=>Array.from(ctx.getImageData(x,y,1,1).data).join(',');
   const result=[pixel(5,5),pixel(10,10),pixel(12,12)];
   if(result.join('|')!=='0,0,255,255|255,0,0,255|0,255,0,255')throw Error('GPU color/clip/layer mismatch: '+result);
   return 'WGSL pipelines, BGRA colors, polygon clipping and foreground composition passed';
  }));
 }
 fs.mkdirSync('build',{recursive:true});
 fs.writeFileSync('build/browser-errors.json',JSON.stringify(errors,null,2));
 if(errors.length)throw Error(errors.join('\n'));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
