// 小灯当家 for macOS — JavaScript for Automation + native AppKit/WebKit.
// Compiled as a stay-open applet by macOS osacompile. No Electron or Node runtime.
ObjC.import('Cocoa');
ObjC.import('WebKit');
var panel=null, web=null, controller=null, tray=null, trayIcon=null, menu=null, shown=true;
var dragStart=null, busy=false, lastMode=null, ready=false;
var defaults=$.NSUserDefaults.standardUserDefaults;
var app=$.NSApplication.sharedApplication;
var WIDTH=112, HEIGHT=140;

function unwrap(value) { try{return ObjC.unwrap(value);}catch(e){return null;} }
// Read global preference, not this app's potentially overridden appearance.
function currentMode() {
  var global=ObjC.deepUnwrap(defaults.persistentDomainForName($.NSGlobalDomain))||{};
  return global.AppleInterfaceStyle==='Dark'?'dark':'light';
}
var modes=['light','warm','dark','dim'];
var modeNames={light:'日间',warm:'暖光',dark:'夜读',dim:'微光'};
var selectedMode=null, overlays=[], overlayGeometry='';
var skinCatalog={"mushroom":{"name":"蘑菇灯","w":112,"h":140,"kind":"classic","control":"knob"},"fabric":{"name":"布罩灯","w":112,"h":140,"kind":"classic","control":"pull"},"globe":{"name":"球形灯","w":112,"h":140,"kind":"classic","control":"touch"},"petal":{"name":"花瓣吊灯","w":108,"h":156,"kind":"pendant","control":"pull","col":0,"row":0},"gingham":{"name":"格纹吊灯","w":108,"h":156,"kind":"pendant","control":"touch","col":1,"row":0},"enamel":{"name":"复古搪瓷吊灯","w":108,"h":156,"kind":"pendant","control":"pull","col":2,"row":0},"paper":{"name":"纸月灯笼","w":108,"h":156,"kind":"pendant","control":"touch","col":3,"row":0},"ufo":{"name":"奶油飞碟吊灯","w":108,"h":156,"kind":"pendant","control":"touch","col":0,"row":1},"bell":{"name":"铃兰吊灯","w":108,"h":156,"kind":"pendant","control":"pull","col":1,"row":1},"floor":{"name":"折叶落地灯","w":144,"h":300,"kind":"floor","control":"pull","col":2,"row":1}};
var skins=Object.keys(skinCatalog),skinNames={},skinItems={};
skins.forEach(function(key){skinNames[key]=skinCatalog[key].name;});
var lampSkin='mushroom';
function loadSkin(){var saved=unwrap(defaults.stringForKey($('lampSkin')));lampSkin=skins.indexOf(saved)!==-1?saved:'mushroom';WIDTH=skinCatalog[lampSkin].w;HEIGHT=skinCatalog[lampSkin].h;}
function setSkin(skin){
  if(skins.indexOf(skin)===-1)return;
  if(panel)savePosition();
  dragStart=null;lampSkin=skin;WIDTH=skinCatalog[skin].w;HEIGHT=skinCatalog[skin].h;
  if(panel){panel.setContentSize($.NSMakeSize(WIDTH,HEIGHT));if(web)web.frame=$.NSMakeRect(0,0,WIDTH,HEIGHT);restorePosition();showLamp();}
  defaults.setObjectForKey($(skin),$('lampSkin'));
  Object.keys(skinItems).forEach(function(key){skinItems[key].state=key===skin?1:0;});
  sendState({message:skinNames[skin]});
}
function configureTray(resources){
  // Keep a stable slot and strong references for the lifetime of the applet.
  tray=$.NSStatusBar.systemStatusBar.statusItemWithLength(28);
  tray.visible=true;
  tray.button.title=$('灯');
  try{
    trayIcon=$.NSImage.alloc.initWithContentsOfFile($(resources+'/ui/menu-lamp.png'));
    if(trayIcon && trayIcon.isValid){
      trayIcon.size=$.NSMakeSize(18,18);trayIcon.template=true;
      tray.button.image=trayIcon;
      tray.button.title=$('');
    }
  }catch(e){trayIcon=null;}
  tray.button.toolTip=$('小灯当家 · 灯具与退出');
  tray.menu=menu;
}

function appearanceFor(mode){return mode==='dark'||mode==='dim'?'dark':'light';}
function selected(){return selectedMode||currentMode();}
function nextMode(direction){return modes[(modes.indexOf(selected())+(direction===-1?3:1))%4];}
function overlaySpec(mode){
  if(mode==='warm')return {red:1,green:0.69,blue:0.30,alpha:0.13};
  if(mode==='dim')return {red:0,green:0,blue:0,alpha:0.23};
  return null;
}
function displayFrames(){var a=$.NSScreen.screens,r=[];for(var i=0;i<Number(a.count);i++)r.push(a.objectAtIndex(i).frame);return r;}
function clearOverlays(){overlays.forEach(function(w){w.orderOut(null);w.close;});overlays=[];overlayGeometry='';}
function applyOverlay(mode){
  var spec=overlaySpec(mode);
  if(!spec){clearOverlays();return;}
  var frames=displayFrames(),replacement=[];
  try {
    frames.forEach(function(frame){
      var w=$.ReadingLampOverlay.alloc.initWithContentRectStyleMaskBackingDefer(frame,$.NSWindowStyleMaskBorderless|$.NSWindowStyleMaskNonactivatingPanel,$.NSBackingStoreBuffered,false);
      replacement.push(w);w.releasedWhenClosed=false;w.opaque=false;w.hasShadow=false;
      w.backgroundColor=$.NSColor.colorWithCalibratedRedGreenBlueAlpha(spec.red,spec.green,spec.blue,spec.alpha);
      w.ignoresMouseEvents=true;w.hidesOnDeactivate=false;
      w.level=Number($.NSStatusWindowLevel)+1;
      w.collectionBehavior=$.NSWindowCollectionBehaviorCanJoinAllSpaces|$.NSWindowCollectionBehaviorFullScreenAuxiliary;
      w.orderFrontRegardless;
    });
  } catch(e){replacement.forEach(function(w){w.orderOut(null);w.close;});throw e;}
  clearOverlays();overlays=replacement;overlayGeometry=JSON.stringify(frames);
}
function removeFilter(){clearOverlays();selectedMode=currentMode();sendState({message:'屏幕滤色已关闭'});}
function shellQuote(value){return "'"+value.replace(/'/g,"'\\''")+"'";}
function diagnoseChrome(){
  try {
    var actual=Application('System Events').appearancePreferences.darkMode()?'深色':'浅色';
    var alert=$.NSAlert.alloc.init;alert.messageText=$('Chrome 外观检查');
    alert.informativeText=$('系统事件读取：'+actual+'；全局设置读取：'+(currentMode()==='dark'?'深色':'浅色')+'。\n\n接下来在 Chrome 打开本地检查页。若系统值正确但 Chrome 不变，请将 Chrome 新标签页 → 自定义 Chrome → 外观设为「设备」。');
    alert.addButtonWithTitle($('打开检查页'));alert.runModal;
    var host=Application.currentApplication();host.includeStandardAdditions=true;
    var file=unwrap($.NSBundle.mainBundle.resourcePath)+'/ui/chrome-check.html';
    host.doShellScript('/usr/bin/open -a '+shellQuote('Google Chrome')+' '+shellQuote(file));
  }catch(e){sendState({error:'检查未完成，请查看安装包内的 Chrome 排查说明。'});}
}
// Keep a real callable block alive for the JXA / WebKit asynchronous bridge.
// Passing JS null here caused an uncaught JSOCForwardInvocation exception on Mac.
var stateCompletionHandler=function(result,error) {
  // Do not dereference nullable native callback arguments.
};
function sendState(extra) {
  if(!web||!ready)return;
  var data={mode:selected(),systemMode:currentMode(),skin:lampSkin,busy:busy};
  if(extra)Object.keys(extra).forEach(function(key){data[key]=extra[key];});
  web.evaluateJavaScriptCompletionHandler($('window.updateLamp('+JSON.stringify(data)+'); true;'),stateCompletionHandler);
}
function setMode(mode) {
  if(busy||modes.indexOf(mode)===-1)return;
  var previousMode=selected(),previousSystem=null;
  busy=true;sendState();
  try {
    var system=Application('System Events');
    previousSystem=system.appearancePreferences.darkMode();
    var target=appearanceFor(mode);
    system.appearancePreferences.darkMode=(target==='dark');
    var actual=system.appearancePreferences.darkMode()?'dark':'light';
    if(actual!==target)throw new Error('系统外观未切换，请重试。');
    applyOverlay(mode);
    selectedMode=mode;lastMode=actual;busy=false;
    sendState({mode:mode,systemMode:actual,message:modeNames[mode]});
  } catch(e) {
    // Best effort rollback if filter construction fails after the OS changed.
    if(previousSystem!==null){try{Application('System Events').appearancePreferences.darkMode=previousSystem;}catch(ignored){}}
    selectedMode=previousMode;busy=false;
    sendState({error:'切换失败，请查看提示'});
    var alert=$.NSAlert.alloc.init;alert.messageText=$('阅读档位未能切换');
    alert.informativeText=$('如果详情包含未授权（-1743），请在「系统设置 → 隐私与安全性 → 自动化」中允许 小灯当家 控制 System Events。其他错误请将详情发给开发者。\n\n详情：'+String(e.message||e));
    alert.addButtonWithTitle($('好'));alert.runModal;
  }
}
function screens(){var result=[];var all=$.NSScreen.screens;for(var i=0;i<Number(all.count);i++)result.push(all.objectAtIndex(i).visibleFrame);return result;}
function fittedOrigin(x,y){
  var frames=screens(),chosen=frames[0],best=Infinity;
  frames.forEach(function(f){var cx=f.origin.x+f.size.width/2,cy=f.origin.y+f.size.height/2;var d=Math.pow(x+WIDTH/2-cx,2)+Math.pow(y+HEIGHT/2-cy,2);if(d<best){best=d;chosen=f;}});
  return $.NSMakePoint(Math.max(chosen.origin.x,Math.min(x,chosen.origin.x+chosen.size.width-WIDTH)),Math.max(chosen.origin.y,Math.min(y,chosen.origin.y+chosen.size.height-HEIGHT)));
}
function pendant(){return skinCatalog[lampSkin].kind==='pendant';}
function defaultOrigin(f){return $.NSMakePoint(f.origin.x+f.size.width-WIDTH-20,pendant()?f.origin.y+f.size.height-HEIGHT:f.origin.y+18);}
function savePosition(){if(!panel)return;var p=panel.frame.origin;defaults.setDoubleForKey(p.x,$('lampX_'+lampSkin));defaults.setDoubleForKey(p.y,$('lampY_'+lampSkin));defaults.setBoolForKey(true,$('hasPosition_'+lampSkin));}
function resetPosition(){panel.setFrameOrigin(defaultOrigin($.NSScreen.mainScreen.visibleFrame));savePosition();}
function restorePosition(){
 if(defaults.boolForKey($('hasPosition_'+lampSkin)))panel.setFrameOrigin(fittedOrigin(defaults.doubleForKey($('lampX_'+lampSkin)),defaults.doubleForKey($('lampY_'+lampSkin))));
 else if(skinCatalog[lampSkin].kind==='classic'&&defaults.boolForKey($('hasLampPosition')))panel.setFrameOrigin(fittedOrigin(defaults.doubleForKey($('lampX')),defaults.doubleForKey($('lampY'))));
 else resetPosition();
}
function showLamp(){var p=panel.frame.origin;panel.setFrameOrigin(fittedOrigin(p.x,p.y));panel.orderFrontRegardless;shown=true;}
function hideLamp(){dragStart=null;panel.orderOut(controller);shown=false;}
function toggleVisible(){if(shown)hideLamp();else showLamp();}
function openAppearance(){ $.NSWorkspace.sharedWorkspace.openURL($.NSURL.URLWithString($('x-apple.systempreferences:com.apple.Appearance-Settings.extension'))); }
function addItem(title,selector,key){var item=$.NSMenuItem.alloc.initWithTitleActionKeyEquivalent($(title),selector,$(key||''));item.target=controller;menu.addItem(item);return item;}

ObjC.registerSubclass({name:'ReadingLampOverlay',superclass:'NSPanel',methods:{
  'canBecomeKeyWindow':{types:['bool',[]],implementation:function(){return false;}},
  'canBecomeMainWindow':{types:['bool',[]],implementation:function(){return false;}}
}});

ObjC.registerSubclass({name:'ReadingLampPanel',superclass:'NSPanel',methods:{
  'canBecomeKeyWindow':{types:['bool',[]],implementation:function(){return true;}},
  'canBecomeMainWindow':{types:['bool',[]],implementation:function(){return false;}}
}});

ObjC.registerSubclass({name:'ReadingLampController',superclass:'NSObject',protocols:['WKScriptMessageHandler'],methods:{
  'userContentController:didReceiveScriptMessage:':{types:['void',['id','id']],implementation:function(contentController,message){
    if(!message.frameInfo.isMainFrame)return;
    var data=ObjC.deepUnwrap(message.body);
    if(!data||typeof data.action!=='string')return;
    switch(data.action){
      case 'ready':ready=true;sendState();break;
      case 'toggle':setMode(nextMode(data.direction));break;
      case 'mode':setMode(data.mode);break;
      case 'hide':hideLamp();break;
      case 'menu':sendState({message:'请点顶部台灯图标'});break;
      case 'drag-start':var p=$.NSEvent.mouseLocation;var o=panel.frame.origin;dragStart={mx:p.x,my:p.y,x:o.x,y:o.y};break;
      case 'drag-move':if(dragStart){var q=$.NSEvent.mouseLocation;panel.setFrameOrigin(fittedOrigin(dragStart.x+q.x-dragStart.mx,dragStart.y+q.y-dragStart.my));}break;
      case 'drag-end':dragStart=null;savePosition();break;
      case 'move':var dx=Number(data.dx),dy=Number(data.dy);if(isFinite(dx)&&isFinite(dy)&&Math.abs(dx)<=30&&Math.abs(dy)<=30){var pos=panel.frame.origin;panel.setFrameOrigin(fittedOrigin(pos.x+dx,pos.y-dy));savePosition();}break;
    }
  }},
  'light:':{types:['void',['id']],implementation:function(){setMode('light');}},
  'warm:':{types:['void',['id']],implementation:function(){setMode('warm');}},
  'dark:':{types:['void',['id']],implementation:function(){setMode('dark');}},
  'dim:':{types:['void',['id']],implementation:function(){setMode('dim');}},
  'mushroom:':{types:['void',['id']],implementation:function(){setSkin('mushroom');}},
  'fabric:':{types:['void',['id']],implementation:function(){setSkin('fabric');}},
  'globe:':{types:['void',['id']],implementation:function(){setSkin('globe');}},
  'petal:':{types:['void',['id']],implementation:function(){setSkin('petal');}},
  'gingham:':{types:['void',['id']],implementation:function(){setSkin('gingham');}},
  'enamel:':{types:['void',['id']],implementation:function(){setSkin('enamel');}},
  'paper:':{types:['void',['id']],implementation:function(){setSkin('paper');}},
  'ufo:':{types:['void',['id']],implementation:function(){setSkin('ufo');}},
  'bell:':{types:['void',['id']],implementation:function(){setSkin('bell');}},
  'floor:':{types:['void',['id']],implementation:function(){setSkin('floor');}},
  'chrome:':{types:['void',['id']],implementation:function(){diagnoseChrome();}},
  'show:':{types:['void',['id']],implementation:function(){showLamp();}},
  'hide:':{types:['void',['id']],implementation:function(){toggleVisible();}},
  'reset:':{types:['void',['id']],implementation:function(){resetPosition();showLamp();}},
  'pin:':{types:['void',['id']],implementation:function(sender){var pinned=panel.level!==$.NSFloatingWindowLevel;panel.level=pinned?$.NSFloatingWindowLevel:$.NSNormalWindowLevel;sender.state=pinned?1:0;defaults.setBoolForKey(!pinned,$('unpinLamp'));}},
  'appearance:':{types:['void',['id']],implementation:function(){openAppearance();}},
  'quitLamp:':{types:['void',['id']],implementation:function(){savePosition();clearOverlays();app.terminate(null);}}
}});

function run(){
  if(panel){showLamp();return;}
  loadSkin();
  app.setActivationPolicy($.NSApplicationActivationPolicyAccessory);
  controller=$.ReadingLampController.alloc.init;
  panel=$.ReadingLampPanel.alloc.initWithContentRectStyleMaskBackingDefer($.NSMakeRect(0,0,WIDTH,HEIGHT),$.NSWindowStyleMaskBorderless,$.NSBackingStoreBuffered,false);
  panel.opaque=false;panel.backgroundColor=$.NSColor.clearColor;panel.hasShadow=false;
  panel.hidesOnDeactivate=false;panel.releasedWhenClosed=false;panel.title=$('小灯当家');
  panel.level=defaults.boolForKey($('unpinLamp'))?$.NSNormalWindowLevel:$.NSFloatingWindowLevel;
  panel.collectionBehavior=$.NSWindowCollectionBehaviorCanJoinAllSpaces|$.NSWindowCollectionBehaviorFullScreenAuxiliary;
  var config=$.WKWebViewConfiguration.alloc.init;
  config.userContentController.addScriptMessageHandlerName(controller,$('lamp'));
  web=$.WKWebView.alloc.initWithFrameConfiguration($.NSMakeRect(0,0,WIDTH,HEIGHT),config);
  web.setValueForKey($(false),$('drawsBackground'));
  panel.contentView=web;
  var resources=unwrap($.NSBundle.mainBundle.resourcePath);
  var html=$.NSURL.fileURLWithPath($(resources+'/ui/index.html'));
  web.loadFileURLAllowingReadAccessToURL(html,$.NSURL.fileURLWithPath($(resources+'/ui/')));
  menu=$.NSMenu.alloc.initWithTitle($('小灯当家'));
  addItem('显示小台灯','show:');menu.addItem($.NSMenuItem.separatorItem);
  skins.forEach(function(skin){if(skin==='petal'||skin==='floor')menu.addItem($.NSMenuItem.separatorItem);skinItems[skin]=addItem(skinNames[skin],skin+':');skinItems[skin].state=skin===lampSkin?1:0;});
  menu.addItem($.NSMenuItem.separatorItem);
  addItem('隐藏 / 显示','hide:');addItem('重置台灯位置','reset:');
  var pin=addItem('始终置顶','pin:');pin.state=defaults.boolForKey($('unpinLamp'))?0:1;
  menu.addItem($.NSMenuItem.separatorItem);addItem('检查 Chrome 外观…','chrome:');addItem('打开系统外观设置…','appearance:');addItem('退出小灯当家','quitLamp:','q');
  configureTray(resources);
  restorePosition();
  lastMode=currentMode();selectedMode=lastMode;showLamp();
}
function idle(){if(panel){var mode=currentMode();if(mode!==lastMode){lastMode=mode;selectedMode=mode;clearOverlays();sendState();}if(overlaySpec(selected())&&overlayGeometry!==JSON.stringify(displayFrames())){try{applyOverlay(selected());}catch(e){removeFilter();sendState({error:'屏幕变动，滤色已关闭'});}}var p=panel.frame.origin;var fit=fittedOrigin(p.x,p.y);if(p.x!==fit.x||p.y!==fit.y)panel.setFrameOrigin(fit);}return 2;}
function reopen(){if(panel)showLamp();else run();}
