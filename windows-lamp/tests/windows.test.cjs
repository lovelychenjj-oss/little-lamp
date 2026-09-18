const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),{EventEmitter}=require('node:events');
const core=require('../core.cjs'),catalog=require('../catalog.json');
test('four modes and reverse cycle map to correct system appearance',()=>{assert.deepEqual(core.modes.map(core.appearance),[1,1,0,0]);assert.equal(core.next('light',-1),'dim');assert.equal(core.next('dim',1),'light');assert.throws(()=>core.appearance('invalid'));});
test('pendants and floor anchors fit negative-coordinate displays',()=>{const a={x:-1920,y:0,width:1920,height:1040};assert.deepEqual(core.origin(catalog.petal,a),{x:-128,y:0});assert.deepEqual(core.origin(catalog.floor,a),{x:-164,y:722});assert.deepEqual(core.clamp({x:500,y:-20},a,catalog.floor),{x:-144,y:0});});
function harness(){
 const windows=[],calls=[],errors=[];let fail=false;
 class Window extends EventEmitter{
  constructor(opts){super();this.opts=opts;this.bounds={x:0,y:0,width:opts.width,height:opts.height,...opts};this.visible=false;this.opacity=opts.opacity;this.webContents=new EventEmitter();Object.assign(this.webContents,{mainFrame:{},session:{setPermissionRequestHandler(){}},setWindowOpenHandler(){},send:(...v)=>calls.push(v)});windows.push(this);}
  setOpacity(v){this.opacity=v;}getOpacity(){return this.opacity;}setAlwaysOnTop(v){this.top=v;}setBounds(v){this.bounds=v;}getBounds(){return this.bounds;}getPosition(){return [this.bounds.x,this.bounds.y];}setPosition(x,y){this.bounds.x=x;this.bounds.y=y;}show(){this.visible=true;}showInactive(){this.visible=true;}hide(){this.visible=false;}moveTop(){}isVisible(){return this.visible;}isDestroyed(){return !!this.dead;}destroy(){this.dead=true;}loadFile(){return Promise.resolve();}setIgnoreMouseEvents(v){this.passThrough=v;}
 }
 const app=new EventEmitter();Object.assign(app,{requestSingleInstanceLock:()=>true,whenReady:()=>Promise.resolve(),getPath:()=>'/prefs',setPath(){},quit(){}});
 const nativeTheme=new EventEmitter();nativeTheme.shouldUseDarkColors=false;
 const screen=new EventEmitter();Object.assign(screen,{getPrimaryDisplay:()=>({workArea:{x:0,y:0,width:1920,height:1040}}),getAllDisplays:()=>[{bounds:{x:0,y:0,width:1920,height:1080}},{bounds:{x:-1280,y:0,width:1280,height:800}}],getDisplayNearestPoint:()=>screen.getPrimaryDisplay(),getDisplayMatching:()=>screen.getPrimaryDisplay(),getCursorScreenPoint:()=>({x:0,y:0})});
 const electron={app,BrowserWindow:Window,Menu:{buildFromTemplate:x=>x},Tray:class{setToolTip(){}setContextMenu(m){this.menu=m;}on(){}popUpContextMenu(){}destroy(){}},nativeImage:{createFromPath:x=>x},ipcMain:new EventEmitter(),nativeTheme,screen,dialog:{showErrorBox:(...x)=>errors.push(x)},shell:{openExternal(){}}};
 const context={require:name=>name==='electron'?electron:name==='./catalog.json'?catalog:name==='./core.cjs'?core:name==='node:fs'?{...fs,readFileSync:(file,encoding)=>file==='/prefs/settings.json'?'{}':fs.readFileSync(file,encoding),mkdirSync(){},writeFileSync(){}}:name==='node:child_process'?{execFile:(_exe,args,_opts,cb)=>{calls.push(['theme',Buffer.from(args.at(-1),'base64').toString('utf16le')]);if(fail){fail=false;cb(new Error('denied'),'','denied');}else cb(null,'OK','');}}:require(name),__dirname:path.resolve(__dirname,'..'),process:{platform:'win32',env:{SystemRoot:'C:\\Windows'}},Buffer,console,setTimeout,clearTimeout};
 vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(__dirname,'../main.cjs'),'utf8')+'\nglobalThis.api={setMode,setSkin,action,getLamp:()=>lamp,getMode:()=>mode,getFilters:()=>filters};',context);
 return {context,windows,calls,errors,electron,fail:()=>{fail=true;}};
}
const settle=()=>new Promise(resolve=>setImmediate(resolve));
test('startup is read-only, tray names are clean, and all skins resize',async()=>{const h=harness();await settle();assert.equal(h.calls.filter(x=>x[0]==='theme').length,0);for(const [key,value]of Object.entries(catalog)){assert(!/^(C\d|L\d)|朝左/.test(value.name));h.context.api.setSkin(key);assert.equal(h.context.api.getLamp().bounds.width,value.w);}assert.equal(h.errors.length,0);});
test('warm overlays pass clicks on all screens and hiding retains them; exiting clears them',async()=>{const h=harness();await settle();await h.context.api.setMode('warm');assert.equal(h.context.api.getMode(),'warm');const filters=[...h.context.api.getFilters()];assert.equal(filters.length,2);assert(filters.every(w=>w.passThrough&&w.opts.focusable===false));const lamp=h.context.api.getLamp();h.context.api.action({sender:lamp.webContents,senderFrame:lamp.webContents.mainFrame},{action:'hide'});assert.equal(lamp.visible,false);assert.equal(h.context.api.getFilters().length,2);h.electron.app.emit('before-quit');assert(filters.every(w=>w.dead));});
test('failed theme change rolls back and does not report requested mode',async()=>{const h=harness();await settle();h.fail();await h.context.api.setMode('dark');assert.equal(h.context.api.getMode(),'light');assert.equal(h.errors.length,1);assert.equal(h.calls.filter(x=>x[0]==='theme').length,2);});
test('untrusted renderer cannot hide or change lamp',async()=>{const h=harness();await settle();h.context.api.action({sender:{},senderFrame:{}},{action:'hide'});assert.equal(h.context.api.getLamp().visible,true);});

test('warm and dim apply low window opacity with unambiguous RGB colours',async()=>{
 const h=harness();await settle();
 for(const [mode,color,opacity] of [['warm','#ffb04d',0.13],['dim','#000000',0.23]]){
  await h.context.api.setMode(mode);
  assert(h.context.api.getFilters().every(w=>w.opts.backgroundColor===color&&w.opts.opacity===opacity&&w.getOpacity()===opacity));
 }
});
test('opaque filter is destroyed before it can cover the desktop',async()=>{
 const h=harness();await settle();h.electron.BrowserWindow.prototype.getOpacity=()=>1;
 await h.context.api.setMode('warm');
 const overlays=h.windows.filter(w=>w.opts.focusable===false);
 assert(overlays.length>0);assert(overlays.every(w=>w.dead&&!w.visible));
 assert.equal(h.context.api.getMode(),'light');assert.equal(h.errors.length,1);
});

test('pendant position is saved and restored independently',async()=>{const h=harness();await settle();const api=h.context.api;api.setSkin('petal');api.getLamp().setPosition(300,240);api.setSkin('paper');api.setSkin('petal');assert.equal(api.getLamp().bounds.x,300);assert.equal(api.getLamp().bounds.y,240);});
