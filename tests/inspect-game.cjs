const {chromium}=require(process.env.PLAYWRIGHT_PATH || 'playwright');
const readline=require('node:readline/promises');
(async()=>{
 const browser=await chromium.launch({channel:'chrome',headless:true,args:['--enable-unsafe-webgpu']});
 const page=await browser.newPage();
 await page.goto('http://localhost:8080');
 await page.waitForFunction(()=>document.querySelector('#status').textContent==='Engine ready');
 await page.setInputFiles('#romInput',process.env.TEST_ROM);
 await page.waitForFunction(()=>!document.querySelector('#startBtn').disabled);
 await page.click('#startBtn');
 await page.evaluate(async()=>{const host=await import('/main.js');window.inspectState=host.getArcadeState;});
 await page.waitForFunction(()=>inspectState().frames>400);
 const key=async(k,ms=180)=>{await page.keyboard.down(k);await page.waitForTimeout(ms);await page.keyboard.up(k);await page.waitForTimeout(400);};
 await key('F2');
 await page.screenshot({path:'build/test-menu.png'});
 console.log('Ready: JSON commands key/ms, wait, shot, close');
 const input=readline.createInterface({input:process.stdin,output:process.stdout,terminal:false});
 for await(const line of input){
  const cmd=JSON.parse(line);
  if(cmd.close)break;
  if(cmd.key)await key(cmd.key,cmd.ms);
  if(cmd.wait)await page.waitForTimeout(cmd.wait);
  await page.screenshot({path:cmd.shot || 'build/test-menu.png'});
  console.log(await page.locator('#status').innerText(),await page.evaluate(()=>inspectState().frames));
 }
 await browser.close();input.close();
})().catch(e=>{console.error(e);process.exit(1)});
