'use strict';
const modes=['light','warm','dark','dim'];
function appearance(mode){if(!modes.includes(mode))throw new Error('Invalid mode');return ['dark','dim'].includes(mode)?0:1;}
function next(mode,direction){return modes[(modes.indexOf(mode)+(direction===-1?3:1))%4];}
function clamp(point,area,size){return {x:Math.round(Math.max(area.x,Math.min(point.x,area.x+area.width-size.w))),y:Math.round(Math.max(area.y,Math.min(point.y,area.y+area.height-size.h)))};}
function origin(info,area){return clamp({x:area.x+area.width-info.w-20,y:info.kind==='pendant'?area.y:area.y+area.height-info.h-18},area,info);}
function overlay(mode){return mode==='warm'?{color:'#ffb04d',opacity:0.13}:mode==='dim'?{color:'#000000',opacity:0.23}:null;}
module.exports={modes,appearance,next,clamp,origin,overlay};
