'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('lampHost',{
 post(value){ipcRenderer.send('lamp-action',value);},
 onState(callback){ipcRenderer.on('lamp-state',(_event,value)=>callback(value));}
});
