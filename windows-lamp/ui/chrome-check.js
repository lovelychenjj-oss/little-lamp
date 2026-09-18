(function(){
'use strict';
var query=window.matchMedia('(prefers-color-scheme: dark)'),lines=[];
var status=document.getElementById('status'),report=document.getElementById('report');
document.getElementById('browser').textContent=navigator.userAgent;
function record(){var mode=query.matches?'深色':'浅色';status.textContent='此浏览器向网页报告：'+mode;lines.push(new Date().toLocaleTimeString()+'  '+mode);report.value='小灯当家 Chrome 检查（不代表系统设置读取结果）\n'+navigator.userAgent+'\n'+lines.slice(-20).join('\n');}
query.addEventListener('change',record);record();
document.getElementById('copy').addEventListener('click',async function(){try{await navigator.clipboard.writeText(report.value);document.getElementById('copy-status').textContent='已复制';}catch(e){report.focus();report.select();document.getElementById('copy-status').textContent='请按 ⌘C 复制选中的记录';}});
})();
