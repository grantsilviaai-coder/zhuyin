const http=require('http'),fs=require('fs'),vm=require('vm');
const sheets={};
function mkSheet(name){const rows=[];return {rows,getLastRow:()=>rows.length,getLastColumn:()=>Math.max(0,...rows.map(r=>r.length)),deleteRow:r=>rows.splice(r-1,1),appendRow:r=>rows.push(r),setFrozenRows(){},
 getRange:(r,c,nr,nc)=>({getValue:()=>(rows[r-1]||[])[c-1]??'',setValue:v=>{rows[r-1]=rows[r-1]||[];rows[r-1][c-1]=v},setValues:v=>{v.forEach((row,i)=>{rows[r-1+i]=rows[r-1+i]||[];row.forEach((x,j)=>rows[r-1+i][c-1+j]=x)})},
  getValues:()=>rows.slice(r-1,r-1+nr).map(x=>x.slice(c-1,c-1+nc)),clearContent:()=>{ if(nc===1&&c===1&&nr>1) rows.splice(r-1,nr); else for(let i=0;i<nr;i++){const row=rows[r-1+i]; if(row) for(let j=0;j<nc;j++) row[c-1+j]='';} }})};}
const props={};
const ctx={SpreadsheetApp:{getActiveSpreadsheet:()=>({getSheetByName:n=>sheets[n],insertSheet:n=>(sheets[n]=mkSheet(n))})},
 ContentService:{MimeType:{JSON:'json'},createTextOutput:s=>({s,setMimeType(){return this}})},
 LockService:{getScriptLock:()=>({waitLock(){},releaseLock(){}})},
 PropertiesService:{getScriptProperties:()=>({getProperty:k=>props[k]??null,setProperty:(k,v)=>props[k]=v})},console};
vm.createContext(ctx);vm.runInContext(fs.readFileSync('site/Code.gs','utf8'),ctx);
http.createServer((req,res)=>{
 const u=new URL(req.url,'http://x');
 if(u.pathname==='/diag'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(fs.readFileSync('/tmp/diag.html'));}
 if(u.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html'});return res.end(fs.readFileSync('/tmp/test.html'));}
 if(u.pathname==='/exec'){
  const send=o=>{res.writeHead(200,{'Content-Type':'application/json','Access-Control-Allow-Origin':'*'});res.end(o.s)};
  if(req.method==='GET') return send(ctx.doGet({parameter:Object.fromEntries(u.searchParams)}));
  let b='';req.on('data',d=>b+=d);req.on('end',()=>send(ctx.doPost({postData:{contents:b}})));return;}
 if(u.pathname==='/dump'){res.end(JSON.stringify(sheets['作答紀錄']?.rows.slice(0,4)));return}
 res.writeHead(404);res.end();
}).listen(8765);
