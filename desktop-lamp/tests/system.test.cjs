const test=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const source=fs.readFileSync(require('node:path').join(__dirname,'../src/main.js'),'utf8');
function setup(deny=false){
 let dark=false,writes=0,alerts=0;const messages=[],registrations=[],windows=[],saved={};
 const application={effectiveAppearance:{bestMatchFromAppearancesWithNames:()=>dark?'dark':'light'}};
 const $=x=>x;$.NSUserDefaults={standardUserDefaults:{stringForKey:key=>saved[key]||null,setObjectForKey:(value,key)=>{saved[key]=value},persistentDomainForName:()=>dark?{AppleInterfaceStyle:'Dark'}:{}}};$.NSGlobalDomain='NSGlobalDomain';$.NSApplication={sharedApplication:application};$.NSAppearanceNameAqua='light';$.NSAppearanceNameDarkAqua='dark';
 $.NSAlert={alloc:{get init(){alerts++;return {addButtonWithTitle(){},get runModal(){return 1;}};}}};
 const prefs={};Object.defineProperty(prefs,'darkMode',{get:()=>()=>dark,set:v=>{if(deny)throw new Error('Not authorized -1743');dark=v;writes++;}});
 const context={ObjC:{import(){},unwrap:x=>x,deepUnwrap:x=>x,registerSubclass:x=>registrations.push(x)},$,Application:()=>({appearancePreferences:prefs}),console};
 $.NSScreen={screens:{count:2,objectAtIndex:i=>({frame:{origin:{x:i*1000,y:0},size:{width:1000,height:800}}})}};
 $.NSColor={colorWithCalibratedRedGreenBlueAlpha:(r,g,b,a)=>({r,g,b,a})};
 $.ReadingLampOverlay={alloc:{initWithContentRectStyleMaskBackingDefer:frame=>{const w={frame,orderOut(){this.hidden=true;},get close(){this.closed=true;},get orderFrontRegardless(){this.visible=true;}};windows.push(w);return w;}}};
 $.NSStatusWindowLevel=25;
 vm.createContext(context);vm.runInContext(source,context);context.web={evaluateJavaScriptCompletionHandler:js=>messages.push(js)};context.ready=true;
 return {context,messages,registrations,windows,saved,get dark(){return dark},get writes(){return writes},get alerts(){return alerts}};
}
test('initialization does not change system appearance',()=>{const f=setup();assert.equal(f.writes,0);assert.equal(f.context.currentMode(),'light');});
test('explicit mode requests change and verify system state',()=>{const f=setup();f.context.setMode('dark');assert.equal(f.dark,true);assert.equal(f.writes,1);assert(f.messages.at(-1).includes('夜读'));f.context.setMode('light');assert.equal(f.dark,false);});
test('invalid mode cannot reach system setting',()=>{const f=setup();f.context.setMode('anything');assert.equal(f.writes,0);});
test('permission refusal surfaces an error and does not fake success',()=>{const f=setup(true);f.context.setMode('dark');assert.equal(f.writes,0);assert.equal(f.dark,false);assert.equal(f.context.busy,false);assert.equal(f.alerts,1);assert(f.messages.at(-1).includes('error'));});
test('busy guard blocks overlapping requests',()=>{const f=setup();f.context.busy=true;f.context.setMode('dark');assert.equal(f.writes,0);});

test('WebKit completion is callable asynchronously with null native values',async()=>{
 const f=setup();let completion,script;
 f.context.web={evaluateJavaScriptCompletionHandler:(js,callback)=>{script=js;completion=callback;}};
 f.context.sendState();
 assert.equal(typeof completion,'function');
 const page={updateLamp:data=>assert.equal(data.mode,'light')};
 assert.equal(vm.runInNewContext(script,{window:page}),true);
 await new Promise((resolve,reject)=>setImmediate(()=>{try{completion(null,null);completion(null,{description:'evaluation failed'});resolve();}catch(e){reject(e);}}));
 assert.equal(f.writes,0);
});

test('four modes apply verified appearance and noninteractive filters on both screens',()=>{
 const f=setup();f.context.setMode('warm');assert.equal(f.dark,false);assert.equal(f.context.selected(),'warm');
 assert.equal(f.context.overlays.length,2);assert(f.windows.every(w=>w.ignoresMouseEvents&&w.visible));
 assert.equal(f.windows[0].backgroundColor.a,0.13);
 f.context.setMode('dim');assert.equal(f.dark,true);assert.equal(f.context.selected(),'dim');
 assert(f.windows.slice(0,2).every(w=>w.closed));assert.equal(f.context.overlays[0].backgroundColor.a,0.23);
 f.context.setMode('dark');assert.equal(f.context.overlays.length,0);assert(f.windows.every(w=>w.closed));
 f.context.setMode('light');assert.equal(f.dark,false);
});
test('cycle visits all four modes in either direction',()=>{
 const f=setup();let visited=[];for(let i=0;i<4;i++){f.context.setMode(f.context.nextMode(1));visited.push(f.context.selected());}
 assert.deepEqual(visited,['warm','dark','dim','light']);assert.equal(f.context.nextMode(-1),'dim');
});
test('global appearance read ignores app-specific override',()=>{
 const f=setup();f.context.app.effectiveAppearance.bestMatchFromAppearancesWithNames=()=> 'dark';
 assert.equal(f.context.currentMode(),'light');f.context.setMode('dark');assert.equal(f.context.currentMode(),'dark');
});
test('overlay failure rolls back system and keeps prior mode',()=>{
 const f=setup();f.context.applyOverlay=()=>{throw Error('native window failed')};f.context.setMode('dim');
 assert.equal(f.dark,false);assert.equal(f.context.selected(),'light');assert.equal(f.context.busy,false);assert.equal(f.alerts,1);
 assert(f.messages.at(-1).includes('error'));
});
test('closing filters keeps current system appearance',()=>{
 const f=setup();f.context.setMode('dim');const writes=f.writes;f.context.removeFilter();
 assert.equal(f.context.overlays.length,0);assert.equal(f.context.selected(),'dark');assert.equal(f.writes,writes);
});
test('diagnostic shell paths preserve apostrophes without substitution',()=>{
 const f=setup();assert.equal(f.context.shellQuote("a'b"),"'a'\\''b'");
});

test('skin persists independently of reading mode and rejects unknown skins',()=>{
 const f=setup();f.context.setMode('dark');const writes=f.writes;
 f.context.skinItems={mushroom:{},fabric:{},globe:{}};
 f.context.setSkin('fabric');assert.equal(f.saved.lampSkin,'fabric');assert.equal(f.context.skinItems.fabric.state,1);
 assert.equal(f.context.selected(),'dark');assert.equal(f.writes,writes);
 f.context.lampSkin='mushroom';f.context.loadSkin();assert.equal(f.context.lampSkin,'fabric');
 f.context.setSkin('invalid');assert.equal(f.context.lampSkin,'fabric');
});
test('menu-bar icon exposes the full native menu without a direct button action',()=>{
 const f=setup(),c=f.context,icon={isValid:true};c.$.NSImage={alloc:{initWithContentsOfFile:file=>{assert(file.endsWith('/ui/menu-lamp.png'));return icon}}};
 c.$.NSMakeSize=(w,h)=>({width:w,height:h});
 c.$.NSStatusBar={systemStatusBar:{statusItemWithLength:length=>{assert.equal(length,28);return {button:{}}}}};
 c.menu={};c.configureTray('/resources');assert.equal(c.tray.button.title,'');assert.equal(c.tray.button.action,undefined);assert.equal(c.tray.menu,c.menu);assert.equal(icon.template,true);
 c.panel={frame:{origin:{x:0,y:0}},setFrameOrigin(){},get orderFrontRegardless(){this.visible=true}};c.fittedOrigin=()=>({x:0,y:0});
 const controller=f.registrations.find(r=>r.name==='ReadingLampController');controller.methods['show:'].implementation();
 assert.equal(c.panel.visible,true);assert.equal(f.writes,0);
});

test('desktop context click avoids nested native menu call and keeps application running',()=>{
 const f=setup();f.context.menu={popUpMenuPositioningItemAtLocationInView(){throw Error('must not run')}};
 const c=f.registrations.find(r=>r.name==='ReadingLampController');
 c.methods['userContentController:didReceiveScriptMessage:'].implementation(null,{frameInfo:{isMainFrame:true},body:{action:'menu'}});
 assert(f.messages.at(-1).includes('请点顶部台灯图标'));assert.equal(f.writes,0);
 for(const mode of ['light','warm','dark','dim'])assert.equal(typeof c.methods[mode+':'].implementation,'function');
});

test('minimize hides lamp without changing mode or removing screen filters',()=>{const f=setup();f.context.setMode('warm');const writes=f.writes;let hidden=false;f.context.panel={orderOut(){hidden=true}};f.context.hideLamp();assert(hidden);assert.equal(f.context.shown,false);assert.equal(f.context.selected(),'warm');assert.equal(f.context.overlays.length,2);assert.equal(f.writes,writes);});

test('new skins have native selectors and matching UI catalogue',()=>{
 const f=setup(),c=f.registrations.find(r=>r.name==='ReadingLampController'),ui={window:{}};
 vm.runInNewContext(fs.readFileSync(require('node:path').join(__dirname,'../src/ui/catalog.js'),'utf8'),ui);
 assert.equal(f.context.skins.length,10);
 assert.equal(JSON.stringify(f.context.skinCatalog),JSON.stringify(ui.window.LAMP_CATALOG));
 for(const skin of f.context.skins)assert.equal(typeof c.methods[skin+':'].implementation,'function');
});
test('switching hanging and floor lamps resizes, anchors, preserves mode and restores floor position',()=>{
 const f=setup(),c=f.context,d=c.defaults,frame={origin:{x:-1600,y:0},size:{width:1600,height:900}};
 Object.assign(d,{setDoubleForKey:(v,k)=>f.saved[k]=v,doubleForKey:k=>f.saved[k]||0,setBoolForKey:(v,k)=>f.saved[k]=v,boolForKey:k=>!!f.saved[k]});
 c.$.NSMakeSize=(w,h)=>({width:w,height:h});c.$.NSMakeRect=(x,y,w,h)=>({origin:{x,y},size:{width:w,height:h}});c.$.NSMakePoint=(x,y)=>({x,y});
 c.$.NSScreen={mainScreen:{visibleFrame:frame},screens:{count:1,objectAtIndex:()=>({visibleFrame:frame})}};
 c.panel={frame:{origin:{x:-200,y:30}},setFrameOrigin(p){this.frame.origin=p},setContentSize(s){this.size=s},get orderFrontRegardless(){return true}};
 c.setMode('dark');const writes=f.writes;c.setSkin('petal');
 assert.equal(c.WIDTH,108);assert.equal(c.HEIGHT,156);assert.equal(c.panel.frame.origin.x,-128);assert.equal(c.panel.frame.origin.y,744);
 c.panel.frame.origin={x:-300,y:300};c.savePosition();c.setSkin('paper');c.setSkin('petal');assert.equal(c.panel.frame.origin.x,-300);assert.equal(c.panel.frame.origin.y,300);
 c.setSkin('floor');assert.equal(c.HEIGHT,300);assert.equal(c.panel.frame.origin.y,18);
 c.panel.frame.origin={x:-400,y:40};c.setSkin('paper');c.setSkin('floor');
 assert.equal(c.panel.frame.origin.x,-400);assert.equal(c.panel.frame.origin.y,40);assert.equal(c.selected(),'dark');assert.equal(f.writes,writes);
});

test('missing menu icon retains a visible menu entry',()=>{
 const c=setup().context;
 c.$.NSImage={alloc:{initWithContentsOfFile:()=>null}};
 c.$.NSStatusBar={systemStatusBar:{statusItemWithLength:()=>({button:{}})}};
 c.menu={};c.configureTray('/missing');
 assert.equal(c.tray.button.title,'灯');assert.equal(c.tray.visible,true);assert.equal(c.tray.menu,c.menu);
});
