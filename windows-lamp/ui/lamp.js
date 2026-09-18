(function(){
'use strict';
var lamp=document.getElementById('lamp'),body=document.getElementById('body'),knob=document.getElementById('knob'),label=document.getElementById('label'),timer;
function post(action,extra){var value=Object.assign({action:action},extra||{});if(window.lampHost){window.lampHost.post(value);return;}if(window.webkit&&window.webkit.messageHandlers&&window.webkit.messageHandlers.lamp)window.webkit.messageHandlers.lamp.postMessage(value);}
var pull=document.getElementById('pull'),sphere=document.getElementById('sphere-touch');
var busy=false,activeGesture=null,wheelLocked=false,wheelSum=0,wheelTimer;
var catalog=window.LAMP_CATALOG;
function skinInfo(){return catalog[lamp.dataset.skin]||catalog.mushroom;}
function accepts(type){return skinInfo().control===type;}
var modes=['light','warm','dark','dim'],names={light:'日间',warm:'暖光',dark:'夜读',dim:'微光'};
window.updateLamp=function(data){
 if(data.skin&&data.skin!==lamp.dataset.skin)cancelGesture();
 if(Object.prototype.hasOwnProperty.call(catalog,data.skin)){
  lamp.dataset.skin=data.skin;var info=skinInfo();lamp.dataset.kind=info.kind;lamp.dataset.control=info.control;
  lamp.style.setProperty('--widget-width',info.w+'px');lamp.style.setProperty('--widget-height',info.h+'px');
  if(info.col!==undefined){lamp.style.setProperty('--sprite-x',(info.col*100/3)+'%');lamp.style.setProperty('--sprite-y',(info.row*100)+'%');}
  body.setAttribute('aria-label','拖动灯身移动；也可使用左上角移动手柄');
 }
 if(modes.indexOf(data.mode)!==-1)lamp.dataset.mode=data.mode;
 busy=!!data.busy;knob.disabled=busy;pull.disabled=busy;sphere.disabled=busy;
 if(busy)cancelGesture();
 var next=modes[(modes.indexOf(lamp.dataset.mode)+1)%4];
 knob.setAttribute('aria-label','当前'+names[lamp.dataset.mode]+'，点击切换到'+names[next]);
 pull.setAttribute('aria-label','当前'+names[lamp.dataset.mode]+'，向下拉绳切换到'+names[next]);
 sphere.setAttribute('aria-label','当前'+names[lamp.dataset.mode]+'，划动灯球切换到'+names[next]);
 lamp.classList.toggle('error',!!data.error);
 label.textContent=data.error||(data.busy?'正在切换…':(data.message||names[lamp.dataset.mode]));
 if(data.message||data.error){lamp.classList.add('notice');clearTimeout(timer);timer=setTimeout(function(){lamp.classList.remove('notice');},4000);}
};
knob.addEventListener('click',function(){post('toggle');});
knob.addEventListener('keydown',function(e){if(e.key==='ArrowLeft'||e.key==='ArrowRight'){e.preventDefault();post('toggle',{direction:e.key==='ArrowLeft'?-1:1});}});
function cancelGesture(){
 if(!activeGesture)return;
 var el=activeGesture.el,id=activeGesture.id;activeGesture=null;
 el.classList.remove('gesture-active');el.style.setProperty('--pull','0px');
 if(el.hasPointerCapture(id))el.releasePointerCapture(id);
}
function gesture(el,type){
 el.addEventListener('pointerdown',function(e){
  if(busy||e.button!==0||!accepts(type)||activeGesture)return;
  e.preventDefault();el.setPointerCapture(e.pointerId);
  activeGesture={el:el,id:e.pointerId,x:e.clientX,y:e.clientY,distance:0};el.classList.add('gesture-active');
 });
 el.addEventListener('pointermove',function(e){
  var g=activeGesture;if(!g||g.el!==el||g.id!==e.pointerId)return;
  var dx=e.clientX-g.x,dy=e.clientY-g.y;
  g.distance=type==='pull'?Math.max(0,dy):Math.sqrt(dx*dx+dy*dy);
  if(type==='pull')el.style.setProperty('--pull',Math.min(22,Math.max(0,dy)/(skinInfo().kind==='floor'?1:.75))+'px');
 });
 el.addEventListener('pointerup',function(e){
  var g=activeGesture;if(!g||g.el!==el||g.id!==e.pointerId)return;
  // Use release coordinates as well: some devices coalesce the final move event.
  var dx=e.clientX-g.x,dy=e.clientY-g.y;
  var distance=type==='pull'?Math.max(0,dy):Math.sqrt(dx*dx+dy*dy);
  var trigger=!busy&&distance>=12;cancelGesture();if(trigger)post('toggle');
 });
 el.addEventListener('pointercancel',cancelGesture);
 el.addEventListener('lostpointercapture',function(){if(activeGesture&&activeGesture.el===el)cancelGesture();});
 // A keyboard-generated click offers the same operation without pointer gestures.
 el.addEventListener('click',function(e){if(e.detail===0&&!busy&&accepts(type))post('toggle');});
}
gesture(pull,'pull');gesture(sphere,'touch');
sphere.addEventListener('wheel',function(e){
 if(busy||!accepts('touch')||activeGesture||e.ctrlKey)return;
 e.preventDefault();clearTimeout(wheelTimer);
 wheelTimer=setTimeout(function(){wheelLocked=false;wheelSum=0;},250);
 if(wheelLocked)return;
 wheelSum+=Math.abs(e.deltaY)*(e.deltaMode===1?16:e.deltaMode===2?100:1);
 if(wheelSum>=30){wheelLocked=true;post('toggle');}
},{passive:false});
document.getElementById('minimize').addEventListener('click',function(){cancelGesture();post('hide');});
lamp.addEventListener('contextmenu',function(e){e.preventDefault();post('menu');});
[body,document.getElementById('drag-handle')].forEach(function(target){
target.addEventListener('pointerdown',function(e){if(e.button!==0)return;target.setPointerCapture(e.pointerId);post('drag-start');});
target.addEventListener('pointermove',function(e){if(target.hasPointerCapture(e.pointerId))post('drag-move');});
target.addEventListener('pointerup',function(e){if(!target.hasPointerCapture(e.pointerId))return;post('drag-end');target.releasePointerCapture(e.pointerId);});
target.addEventListener('pointercancel',function(){post('drag-end');});
target.addEventListener('keydown',function(e){var d={ArrowLeft:[-20,0],ArrowRight:[20,0],ArrowUp:[0,-20],ArrowDown:[0,20]}[e.key];if(d){e.preventDefault();post('move',{dx:d[0],dy:d[1]});}});
});
if(window.lampHost)window.lampHost.onState(window.updateLamp);
post('ready');
})();
