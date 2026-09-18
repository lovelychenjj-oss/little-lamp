'use strict';
const {app,BrowserWindow,Menu,Tray,nativeImage,ipcMain,nativeTheme,screen,dialog,shell}=require('electron');
const fs=require('node:fs'),path=require('node:path'),{execFile}=require('node:child_process');
// Retain the previous product's preferences after the display-name change.
app.setPath('userData',path.join(app.getPath('appData'),'Reading Lamp'));
const catalog=require('./catalog.json'),core=require('./core.cjs');
let lamp,tray,menu,settings={},skin='mushroom',mode='light',busy=false,drag=null,filters=[],quitting=false;
const info=()=>catalog[skin];
const pref=()=>path.join(app.getPath('userData'),'settings.json');
function save(){try{fs.mkdirSync(path.dirname(pref()),{recursive:true});fs.writeFileSync(pref(),JSON.stringify({...settings,skin}));}catch(e){console.error(e);}}
function state(extra={}){if(lamp&&!lamp.isDestroyed())lamp.webContents.send('lamp-state',{skin,mode,busy,...extra});}
function savePosition(){if(lamp){const [x,y]=lamp.getPosition();settings.positions=settings.positions||{};settings.positions[skin]={x,y};save();}}
function place(reset=false){
 const size=info(),area=screen.getPrimaryDisplay().workArea;
 const saved=!reset&&settings.positions&&settings.positions[skin];
 let p=core.origin(size,area);
 if(saved&&Number.isFinite(saved.x)&&Number.isFinite(saved.y))p=core.clamp(saved,screen.getDisplayNearestPoint(saved).workArea,size);
 lamp.setBounds({...p,width:size.w,height:size.h});
}
function show(){lamp.show();lamp.moveTop();}
function setSkin(value){if(!Object.hasOwn(catalog,value))return;savePosition();drag=null;skin=value;place();save();rebuildMenu();state();show();}
function clearFilters(){filters.forEach(w=>{if(!w.isDestroyed())w.destroy();});filters=[];}
async function applyFilters(value){
 const filter=core.overlay(value);clearFilters();if(!filter)return;
 try{
  for(const display of screen.getAllDisplays()){
   const w=new BrowserWindow({...display.bounds,frame:false,transparent:true,backgroundColor:filter.color,opacity:filter.opacity,hasShadow:false,focusable:false,skipTaskbar:true,show:false,resizable:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});
   filters.push(w);w.setIgnoreMouseEvents(true);w.setAlwaysOnTop(true,'screen-saver');
   await w.loadFile(path.join(__dirname,'overlay.html'));
   if(!w.isDestroyed()){
    w.setOpacity(filter.opacity);
    const actual=w.getOpacity();
    if(!Number.isFinite(actual)||Math.abs(actual-filter.opacity)>0.02)throw new Error('滤色透明度设置失败，已关闭覆盖层');
    w.showInactive();
   }
  }
  if(lamp.isVisible())lamp.moveTop();
 }catch(e){clearFilters();throw e;}
}
function writeTheme(value){
 const source='$lampThemeValue = '+core.appearance(value)+'\n'+fs.readFileSync(path.join(__dirname,'theme.ps1'),'utf8');
 return new Promise((resolve,reject)=>execFile(path.join(process.env.SystemRoot||'C:\\Windows','System32','WindowsPowerShell','v1.0','powershell.exe'),['-NoProfile','-NonInteractive','-EncodedCommand',Buffer.from(source,'utf16le').toString('base64')],{windowsHide:true,timeout:60000},(error,stdout,stderr)=>error?reject(new Error(stderr||error.message)):stdout.trim()==='OK'?resolve():reject(new Error('系统外观未返回成功结果'))));
}
async function setMode(value){
 if(busy||!core.modes.includes(value))return;
 busy=true;drag=null;state();const previous=mode;
 try{await writeTheme(value);await applyFilters(value);mode=value;}
 catch(e){
  let rollback='';try{await writeTheme(previous);await applyFilters(previous);}catch(r){clearFilters();mode=nativeTheme.shouldUseDarkColors?'dark':'light';rollback='\n恢复原模式失败，请在 Windows 设置中检查外观。';}
  dialog.showErrorBox('灯光切换失败',String(e.message)+rollback);state({error:'切换失败，请检查系统设置'});
 }finally{busy=false;state();}
}
function rebuildMenu(){
 const items=[{label:'显示小台灯',click:show},{type:'separator'}];
 for(const [key,value] of Object.entries(catalog)){if(key==='petal'||key==='floor')items.push({type:'separator'});items.push({label:value.name,type:'checkbox',checked:skin===key,click:()=>setSkin(key)});}
 items.push({type:'separator'},{label:'隐藏 / 显示',click:()=>lamp.isVisible()?lamp.hide():show()},
 {label:'重置台灯位置',click:()=>{place(true);savePosition();show();}},
 {label:'始终置顶',type:'checkbox',checked:settings.pinned!==false,click:item=>{settings.pinned=item.checked;lamp.setAlwaysOnTop(item.checked,'screen-saver');save();}},
 {type:'separator'},{label:'打开系统颜色设置',click:()=>shell.openExternal('ms-settings:colors')},
 {label:'退出小灯当家',click:()=>app.quit()});
 menu=Menu.buildFromTemplate(items);tray.setContextMenu(menu);
}
function secure(window){window.webContents.setWindowOpenHandler(()=>({action:'deny'}));window.webContents.on('will-navigate',e=>e.preventDefault());window.webContents.session.setPermissionRequestHandler((_w,_p,callback)=>callback(false));}
function action(event,data){
 if(!lamp||event.sender!==lamp.webContents||event.senderFrame!==lamp.webContents.mainFrame||!data||typeof data.action!=='string')return;
 switch(data.action){
 case 'ready':state();break;
 case 'toggle':void setMode(core.next(mode,data.direction));break;
 case 'hide':drag=null;lamp.hide();break;
 case 'menu':tray.popUpContextMenu(menu);break;
 case 'drag-start':if(!busy)drag={mouse:screen.getCursorScreenPoint(),bounds:lamp.getBounds()};break;
 case 'drag-move':if(drag){const p=screen.getCursorScreenPoint(),pos=core.clamp({x:drag.bounds.x+p.x-drag.mouse.x,y:drag.bounds.y+p.y-drag.mouse.y},screen.getDisplayNearestPoint(p).workArea,info());lamp.setPosition(pos.x,pos.y);}break;
 case 'drag-end':drag=null;savePosition();break;
 case 'move':if(Number.isFinite(data.dx)&&Number.isFinite(data.dy)){const b=lamp.getBounds(),pos=core.clamp({x:b.x+Math.max(-30,Math.min(30,data.dx)),y:b.y+Math.max(-30,Math.min(30,data.dy))},screen.getDisplayMatching(b).workArea,info());lamp.setPosition(pos.x,pos.y);savePosition();}break;
 }
}
if(!app.requestSingleInstanceLock())app.quit();else{
 app.on('second-instance',()=>{if(lamp)show();});
 app.whenReady().then(async()=>{
  if(process.platform!=='win32'){dialog.showErrorBox('小灯当家','此版本仅支持 Windows。');app.quit();return;}
  try{settings=JSON.parse(fs.readFileSync(pref(),'utf8'));if(!settings||typeof settings!=='object')settings={};}catch{settings={};}
  if(Object.hasOwn(catalog,settings.skin))skin=settings.skin;
  mode=nativeTheme.shouldUseDarkColors?'dark':'light';
  lamp=new BrowserWindow({width:info().w,height:info().h,frame:false,transparent:true,backgroundColor:'#00000000',hasShadow:false,resizable:false,maximizable:false,minimizable:false,skipTaskbar:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),contextIsolation:true,sandbox:true,nodeIntegration:false}});
  lamp.setAlwaysOnTop(settings.pinned!==false,'screen-saver');secure(lamp);place();
  lamp.on('close',e=>{if(!quitting){e.preventDefault();lamp.hide();}});
  tray=new Tray(nativeImage.createFromPath(path.join(__dirname,'ui','tray-lamp.png')));tray.setToolTip('小灯当家');rebuildMenu();tray.on('click',()=>tray.popUpContextMenu(menu));
  ipcMain.on('lamp-action',action);
  await lamp.loadFile(path.join(__dirname,'ui','index.html'));state();show();
  nativeTheme.on('updated',()=>{const target=nativeTheme.shouldUseDarkColors?'dark':'light';if(!busy&&core.appearance(target)!==core.appearance(mode)){mode=target;clearFilters();state();}});
  let displayTimer;const displaysChanged=()=>{clearTimeout(displayTimer);displayTimer=setTimeout(()=>{place();if(!busy)void applyFilters(mode).catch(e=>dialog.showErrorBox('滤色更新失败',e.message));},300);};
  screen.on('display-added',displaysChanged);screen.on('display-removed',displaysChanged);screen.on('display-metrics-changed',displaysChanged);
 }).catch(e=>{dialog.showErrorBox('小灯当家启动失败',e.stack||e.message);app.quit();});
 app.on('before-quit',()=>{quitting=true;if(lamp&&!lamp.isDestroyed())savePosition();clearFilters();if(tray)tray.destroy();});
 app.on('window-all-closed',()=>{});
}
