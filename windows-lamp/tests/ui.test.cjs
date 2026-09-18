const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'../ui');
function element(){let capture=null;return {style:{setProperty(){}},setPointerCapture(id){capture=id},hasPointerCapture(id){return capture===id},releasePointerCapture(){capture=null},dataset:{mode:'light'},attrs:{},handlers:{},classList:{toggle(){},add(){},remove(){}},setAttribute(k,v){this.attrs[k]=v},addEventListener(k,v){this.handlers[k]=v}};}
function lamp(){const html=fs.readFileSync(path.join(root,'index.html'),'utf8'),nodes={};for(const m of html.matchAll(/id="([^"]+)"/g))nodes[m[1]]=element();const sent=[];const window={lampHost:{post:m=>sent.push(m),onState:callback=>{}}};vm.runInNewContext(fs.readFileSync(path.join(root,'catalog.js'),'utf8')+'\n'+fs.readFileSync(path.join(root,'lamp.js'),'utf8'),{window,document:{getElementById:id=>nodes[id]},setTimeout:()=>1,clearTimeout(){}});return {nodes,sent,window};}
test('lamp initializes without removed more button and still offers context menu',()=>{const f=lamp();assert.equal(f.nodes.menu,undefined);assert.equal(f.sent[0].action,'ready');let prevented=false;f.nodes.lamp.handlers.contextmenu({preventDefault(){prevented=true}});assert(prevented);assert.equal(f.sent.at(-1).action,'menu');});
test('four states produce distinct labels and accessible next mode; keyboard cycles',()=>{const f=lamp();for(const [mode,label,next] of [['light','日间','暖光'],['warm','暖光','夜读'],['dark','夜读','微光'],['dim','微光','日间']]){f.window.updateLamp({mode,busy:false});assert.equal(f.nodes.lamp.dataset.mode,mode);assert.equal(f.nodes.label.textContent,label);assert(f.nodes.knob.attrs['aria-label'].includes(next));}f.nodes.knob.handlers.keydown({key:'ArrowLeft',preventDefault(){}});assert.equal(f.sent.at(-1).direction,-1);f.nodes.knob.handlers.click();assert.equal(f.sent.at(-1).action,'toggle');});
test('Chrome diagnostic observes media changes without assuming OS state',()=>{const nodes={status:element(),report:element(),browser:element(),copy:element(),'copy-status':element()};let change;const query={matches:false,addEventListener:(event,fn)=>{change=fn}};vm.runInNewContext(fs.readFileSync(path.join(root,'chrome-check.js'),'utf8'),{document:{getElementById:id=>nodes[id]},window:{matchMedia:()=>query},navigator:{userAgent:'Test Chrome'},Date});assert(nodes.status.textContent.includes('浅色'));query.matches=true;change();assert(nodes.status.textContent.includes('深色'));assert(nodes.report.value.includes('不代表系统设置读取结果'));});

test('all skins update independently while preserving current reading mode',()=>{
 const f=lamp();f.window.updateLamp({mode:'warm'});
 for(const skin of ['mushroom','fabric','globe']){f.window.updateLamp({skin});assert.equal(f.nodes.lamp.dataset.skin,skin);assert.equal(f.nodes.lamp.dataset.mode,'warm');}
 f.window.updateLamp({skin:'unknown'});assert.equal(f.nodes.lamp.dataset.skin,'globe');
});

test('secondary pointer click cannot initiate a native window drag',()=>{
 const f=lamp();f.nodes.body.setPointerCapture=()=>{throw Error('secondary click captured')};
 f.nodes.body.handlers.pointerdown({button:2,pointerId:1});assert.equal(f.sent.at(-1).action,'ready');
});

function pointer(x,y){return {button:0,pointerId:1,clientX:x,clientY:y,preventDefault(){}};}
test('cord needs a downward pull and switches exactly once on release',()=>{
 const f=lamp();f.window.updateLamp({skin:'fabric'});const el=f.nodes.pull;
 el.handlers.pointerdown(pointer(0,0));el.handlers.pointermove(pointer(0,20));assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);
 el.handlers.pointerup(pointer(0,20));el.handlers.click({detail:1});assert.equal(f.sent.filter(m=>m.action==='toggle').length,1);
 el.handlers.pointerdown(pointer(0,0));el.handlers.pointerup(pointer(0,-20));assert.equal(f.sent.filter(m=>m.action==='toggle').length,1);
});
test('sphere swipe switches once; tap and canceled gestures do not',()=>{
 const f=lamp();f.window.updateLamp({skin:'globe'});const el=f.nodes['sphere-touch'];
 el.handlers.pointerdown(pointer(0,0));el.handlers.pointerup(pointer(1,1));assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);
 el.handlers.pointerdown(pointer(0,0));el.handlers.pointermove(pointer(25,0));el.handlers.pointercancel();el.handlers.pointerup(pointer(25,0));assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);
 el.handlers.pointerdown(pointer(0,0));el.handlers.pointerup(pointer(25,0));el.handlers.click({detail:1});assert.equal(f.sent.filter(m=>m.action==='toggle').length,1);
});
test('busy and skin changes cancel gestures; one wheel burst changes one mode',()=>{
 const f=lamp();f.window.updateLamp({skin:'globe'});const el=f.nodes['sphere-touch'];
 el.handlers.pointerdown(pointer(0,0));f.window.updateLamp({busy:true});el.handlers.pointerup(pointer(25,0));assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);
 f.window.updateLamp({busy:false});for(let i=0;i<10;i++)el.handlers.wheel({deltaY:10,deltaMode:0,preventDefault(){}});
 assert.equal(f.sent.filter(m=>m.action==='toggle').length,1);
});

test('minimize sends hide without a mode change',()=>{const f=lamp();f.nodes.minimize.handlers.click();assert.equal(f.sent.at(-1).action,'hide');assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);});

test('all seven new skins map to an atlas cell and their proper gestures',()=>{
 const f=lamp();
 for(const [skin,control] of [['petal','pull'],['gingham','touch'],['enamel','pull'],['paper','touch'],['ufo','touch'],['bell','pull'],['floor','pull']]){
  f.window.updateLamp({skin});assert.equal(f.nodes.lamp.dataset.control,control);assert.equal(f.nodes.lamp.dataset.kind,skin==='floor'?'floor':'pendant');
  const el=f.nodes[control==='pull'?'pull':'sphere-touch'],before=f.sent.filter(m=>m.action==='toggle').length;
  el.handlers.pointerdown(pointer(0,0));el.handlers.pointerup(pointer(0,20));assert.equal(f.sent.filter(m=>m.action==='toggle').length,before+1);
 }
});
test('hanging fixture can be dragged',()=>{const f=lamp();f.window.updateLamp({skin:'petal'});f.nodes.body.handlers.pointerdown(pointer(0,0));assert.equal(f.sent.filter(m=>m.action==='drag-start').length,1);});

test('move handle moves touch and pull lamps without changing mode',()=>{const f=lamp();for(const skin of ['paper','petal','globe']){f.window.updateLamp({skin});const handle=f.nodes['drag-handle'];handle.handlers.pointerdown(pointer(0,0));handle.handlers.pointermove(pointer(30,20));handle.handlers.pointerup(pointer(30,20));}assert.equal(f.sent.filter(m=>m.action==='drag-end').length,3);assert.equal(f.sent.filter(m=>m.action==='toggle').length,0);});
