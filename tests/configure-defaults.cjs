// Derive settings using the original arcade's test menu, without inserting coins.
const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const fs=require('node:fs');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 try {
 const page=await browser.newPage();await page.goto('http://localhost:8080');
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');await page.setInputFiles('#romInput',process.env.TEST_ROM);
 await page.waitForFunction(()=>typeof createDaytonaModule==='function');
 await page.evaluate(async()=>{
  window.configModule=await createDaytonaModule();const m=configModule;
  m.FS.mkdir('/roms');m.FS.writeFile('/roms/game.zip',new Uint8Array(await document.querySelector('#romInput').files[0].arrayBuffer()));
  if(!m.ccall('daytona_load','number',['string','number'],['/roms/game.zip',0]))throw Error('ROM rejected');
  window.stepConfig=(n,buttons=0)=>{for(let i=0;i<n;i++)if(!m._daytona_step(0,0,0,1,buttons))throw Error('Step failed');};
  window.pressConfig=buttons=>{stepConfig(25,buttons);stepConfig(25);};
  stepConfig(600);
  pressConfig(4);pressConfig(8);pressConfig(8);pressConfig(2); // test / game system
  pressConfig(8);pressConfig(64);pressConfig(64); // link = single
  pressConfig(8);pressConfig(8);pressConfig(8); // country
  pressConfig(64); // country = Export
  const {createRenderer}=await import('/renderer.js');window.configRenderer=await createRenderer(document.querySelector('#screen'),console.error);configRenderer.draw(m);
 });
 await page.evaluate(()=>{document.querySelector('#overlay').hidden=true;document.documentElement.classList.add('playing');});
 await page.screenshot({path:'build/default-settings.png'});
 const eeprom=await page.evaluate(()=>{
  pressConfig(128);pressConfig(128);pressConfig(128);pressConfig(128); // country -> cabinet -> car -> link -> exit
  pressConfig(2);pressConfig(128);pressConfig(128);pressConfig(2);
  stepConfig(400);
  const m=configModule;configRenderer.draw(m);
  return Array.from(m.HEAPU8.subarray(m._daytona_eeprom_ptr(),m._daytona_eeprom_ptr()+m._daytona_eeprom_size()));
 });
 fs.writeFileSync('build/default-eeprom.json',JSON.stringify(eeprom));
 await page.screenshot({path:'build/default-attract.png'});
 console.log(eeprom);
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
