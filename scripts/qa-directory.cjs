const {chromium}=require(process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES ? process.env.CODEX_PRIMARY_RUNTIME_NODE_MODULES+'/playwright' : 'playwright');
(async()=>{
const fs=require("fs"),http=require("http"),path=require("path");const server=http.createServer((req,res)=>{try{let f=path.join(process.cwd(),new URL(req.url,"http://localhost").pathname);if(fs.statSync(f).isDirectory())f=path.join(f,"index.html");res.setHeader("Content-Type",f.endsWith(".js")?"text/javascript":f.endsWith(".css")?"text/css":f.endsWith(".json")?"application/json":"text/html");res.end(fs.readFileSync(f))}catch{res.statusCode=404;res.end()}});await new Promise(r=>server.listen(8765,r));
const browser=await chromium.launch({headless:true, ...(process.env.DIRECTORY_QA_BROWSER ? {executablePath:process.env.DIRECTORY_QA_BROWSER} : {}),args:["--no-sandbox","--disable-gpu","--disable-dev-shm-usage"]}); const context=await browser.newContext({permissions:['clipboard-read','clipboard-write']}); const page=await context.newPage({viewport:{width:1440,height:1050}}); let errors=[];page.on('pageerror',e=>errors.push(e.message));
const assert=(v,msg)=>{if(!v)throw Error(msg);console.log('PASS',msg)};
await page.setViewportSize({width:1440,height:1050});await page.goto('http://localhost:8765');await page.waitForSelector('.card');const total=await page.locator('.card').count();assert(total>0,'profiles load');
await page.screenshot({path:'/tmp/directory-desktop.png',fullPage:false});
await page.getByRole('button',{name:/Engineering \(/,exact:false}).click();assert((await page.locator('.card').count())<total,'function chips filter');
await page.getByRole('button',{name:'Share results',exact:true}).click(); const copied=await page.evaluate(()=>navigator.clipboard.readText());assert(copied.includes('function=Engineering'),'filtered URL copied');await page.goto(copied);await page.waitForSelector('.card');assert(await page.locator('#functionFilter').inputValue()==='Engineering','shared filter restores');
await page.locator('#clearFilters').click();assert(await page.locator('.card').count()===total,'clear restores all');
await page.locator('.share-candidate').first().click();const profile=await page.evaluate(()=>navigator.clipboard.readText());await page.goto(profile);await page.waitForSelector('.card');assert(await page.locator('.card').count()===1,'candidate link opens one profile');
await page.locator('#search').fill('<img src=x onerror=alert(1)>');await page.waitForTimeout(400);assert(await page.locator('#filterBreadcrumb img').count()===0,'search breadcrumb escapes markup');assert(await page.locator('.card').count()===0,'empty results');await page.locator('.empty-state-link').click();assert(await page.locator('.card').count()===total,'empty-state clear works');
await page.setViewportSize({width:390,height:844});await page.screenshot({path:'/tmp/directory-mobile.png',fullPage:false});assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'mobile has no horizontal page overflow');assert(errors.length===0,'no browser errors');
await page.setViewportSize({width:1440,height:1050});await page.goto('http://localhost:8765');await page.waitForSelector('.card');
await page.getByRole('button',{name:/Engineering \(/}).focus();await page.keyboard.press('Space');assert(await page.locator('#functionFilter').inputValue()==='Engineering','Space activates function chip');
assert(await page.getByRole('button',{name:/Engineering \(/}).evaluate(el=>el===document.activeElement),'chip retains focus after rendering');
await page.getByRole('button',{name:'Remove Function: Engineering filter'}).focus();await page.keyboard.press('Space');assert(await page.locator('#functionFilter').inputValue()==='','Space removes active filter');
await page.locator('#search').focus();await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement.getAttribute('aria-label'))==='Search tips','Tab moves from search to help');
await page.keyboard.press('Tab');assert(await page.evaluate(()=>document.activeElement.classList.contains('function-chip')),'Tab reaches function chips');
await page.getByRole('button',{name:/Engineering \(/}).focus();await page.keyboard.press('Enter');assert(await page.locator('#functionFilter').inputValue()==='Engineering','Enter activates function chip');
await page.locator('#functionFilter').selectOption('Operations');await page.locator('#locationFilter').focus();await page.keyboard.press('ArrowDown');await page.keyboard.press('Enter');assert(await page.locator('#locationFilter').inputValue()!=='','location filter accepts keyboard selection');
const before=page.url();const count=await page.locator('.card').count();await page.goto('http://localhost:8765/about.html');await page.goBack();await page.waitForSelector('.card');assert(page.url()===before && await page.locator('.card').count()===count,'back navigation restores search state');
await page.evaluate(()=>{navigator.clipboard.writeText=async()=>{throw Error('clipboard denied')}});await page.locator('#shareSearch').click();await page.waitForSelector('#shareStatus input');assert(await page.locator('#shareStatus input').inputValue()===page.url(),'clipboard denied provides manual copy');
for(const [width,height] of [[1440,1050],[1024,768],[768,1024],[390,844],[320,740]]){
 await page.setViewportSize({width,height});await page.goto('http://localhost:8765');await page.waitForSelector('.card');await page.screenshot({path:`/tmp/directory-${width}.png`,fullPage:false});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`${width}px no page overflow`);
 assert(await page.locator('#search').evaluate(el=>{const r=el.getBoundingClientRect();return r.top>=0&&r.bottom<innerHeight}),`${width}px search visible on arrival`);
 assert(await page.locator('#search').evaluate(el=>{el.focus();return getComputedStyle(el).boxShadow!=='none'}),`${width}px visible search focus styling`);
 const grid=await page.locator('#directory').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);console.log('LAYOUT',width,grid,'columns');
 if(width<=640){
  assert(!await page.locator('#functionChips').isVisible(),`${width}px redundant chips hidden`);
  const f=await page.locator('#functionFilter').boundingBox(),l=await page.locator('#locationFilter').boundingBox();
  assert(Math.abs(f.y-l.y)<2 && l.x>f.x,`${width}px pickers side by side`);
  await page.locator('#functionFilter').selectOption('Engineering');await page.locator('#locationFilter').selectOption('Chicago');
  assert(await page.locator('.card').count()>0,`${width}px mobile filter results`);
  await page.screenshot({path:`/tmp/directory-filtered-${width}.png`});
  assert(await page.locator('.results-toolbar').evaluate(el=>el.getBoundingClientRect().height<=52),`${width}px compact result actions`);
  assert(await page.locator('#directory-section').evaluate(el=>el.getBoundingClientRect().height<330),`${width}px filtered panel under 330px`);
  await page.locator('#search').focus();await page.keyboard.press('Tab');await page.keyboard.press('Tab');assert(await page.locator('#functionFilter').evaluate(el=>el===document.activeElement),`${width}px keyboard skips hidden chips`);
  await page.getByRole('button',{name:'Remove Function: Engineering filter'}).focus();await page.keyboard.press('Space');assert(await page.locator('#functionFilter').inputValue()==='',`${width}px remove active filter`);
  await page.locator('#clearFilters').click();assert(await page.locator('.card').count()===total,`${width}px clear restores all`);
 } else assert(await page.locator('#functionChips').isVisible(),`${width}px desktop chips retained`);
 await page.locator('.card').first().scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/directory-cards-${width}.png`,fullPage:false});
}
for(const width of [1440,390]) {await page.setViewportSize({width,height:900});await page.locator('.site-footer').scrollIntoViewIfNeeded();await page.screenshot({path:`/tmp/directory-footer-${width}.png`});}
assert(errors.length===0,'no browser errors after extended checks');
await browser.close();server.close();
})();
