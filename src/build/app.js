// ======== 後台網址（老師部署 Google Apps Script 後貼上） ========
const SCRIPT_URL = '__SCRIPT_URL__';
const HAS_BACKEND = /^https?:\/\//.test(SCRIPT_URL);

// ======== 工具 ========
const TONE_MARK = {1:'',2:'ˊ',3:'ˇ',4:'ˋ'};
const MARK_TONE = {'ˊ':2,'ˇ':3,'ˋ':4,'ˉ':1};
const PAIRS = {'ㄓ':'ㄗ','ㄗ':'ㄓ','ㄔ':'ㄘ','ㄘ':'ㄔ','ㄕ':'ㄙ','ㄙ':'ㄕ','ㄣ':'ㄥ','ㄥ':'ㄣ','ㄢ':'ㄤ','ㄤ':'ㄢ','ㄋ':'ㄌ','ㄌ':'ㄋ','ㄈ':'ㄏ','ㄏ':'ㄈ'};
const TONE_NAMES = {1:'一聲',2:'二聲',3:'三聲',4:'四聲',5:'輕聲'};
const TONE_SHOW = {1:'ˉ',2:'ˊ',3:'ˇ',4:'ˋ',5:'˙'};
const MODE_NAMES = {m1:'看字選注音',m2:'看注音選字',m3:'聲調',m4:'易混淆音'};
const ZY_RE = /^[ㄅ-ㄩ]+$/;

function parseSyl(s){
  s = s.trim();
  if(s[0]==='˙' || s[0]==='·') return {l:s.slice(1), t:5};
  const last = s[s.length-1];
  if(MARK_TONE[last]) return {l:s.slice(0,-1), t:MARK_TONE[last]};
  return {l:s, t:1};
}
function fmt(sy){ return sy.t===5 ? '˙'+sy.l : sy.l+TONE_MARK[sy.t]; }
function zyStr(syl){ return syl.map(fmt).join(' '); }
function parseLine(line){
  const parts = String(line).trim().split(/\s+/);
  if(parts.length<2) return {err:'少了注音'};
  const w = parts[0];
  const chars = Array.from(w);
  const syl = parts.slice(1).map(parseSyl);
  if(chars.some(c=>!/[一-鿿]/.test(c))) return {err:'第一段要是國字'};
  if(chars.length!==syl.length) return {err:`「${w}」有 ${chars.length} 個字，但注音有 ${syl.length} 組`};
  for(const s of syl){ if(!s.l || !ZY_RE.test(s.l)) return {err:`注音「${fmt(s)}」看不懂，請只用注音符號`}; }
  return {w, syl};
}
function validLines(text){
  const lines = text.split('\n').map(s=>s.trim()).filter(Boolean);
  const ok=[], errs=[];
  lines.forEach((l,n)=>{ const p=parseLine(l); if(p.err) errs.push(`第 ${n+1} 行：${p.err}`); else ok.push(p.w+' '+zyStr(p.syl)); });
  return {ok, errs};
}
function shuffle(a){ a=a.slice(); for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; }
function pick(a){ return a[Math.floor(Math.random()*a.length)]; }
function esc(s){ return String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }

const store = {
  get(k,d){ try{ const v=localStorage.getItem('zyx-'+k); return v==null?d:JSON.parse(v);}catch(e){return d;} },
  set(k,v){ try{ localStorage.setItem('zyx-'+k, JSON.stringify(v)); }catch(e){} }
};

const BUILTIN = RAW.trim().split('\n').map(parseLine).filter(x=>x && !x.err);

// ======== 班級：網址後面的 #c-代碼 決定是哪一班（每班一張 QR Code） ========
let classId = store.get('classId', '');
let className = store.get('className', '');
(function(){
  const m = location.hash.match(/^#c-([a-z0-9]{4,12})$/);
  if(m && m[1]!==classId){ classId = m[1]; className = ''; store.set('classId', classId); store.set('className', ''); store.set('student', null); }
})();
function setClass(id, name){
  classId = id; className = name || '';
  store.set('classId', classId); store.set('className', className);
  try{ history.replaceState(null, '', location.pathname + (id ? '#c-'+id : '')); }catch(e){}
}
async function fetchClasses(){
  const d = await (await fetch(SCRIPT_URL+'?action=classes')).json();
  return (d && d.ok && d.classes) || [];
}
// 選班級畫面（兩個網站共用）：列出班級按鈕，點了就進入那一班
async function showClassPicker(onPicked){
  show('pickClass');
  const box = $('classList');
  box.innerHTML = '<span class="hint">讀取班級中…</span>';
  try{
    const list = await fetchClasses();
    if(!list.length){ box.innerHTML = '<span class="hint">老師還沒有建立班級。請老師在注音小學堂的老師後台新增班級。</span>'; return; }
    box.innerHTML = list.map(c=>`<button class="mode class-btn" data-id="${esc(c.id)}"><b>${esc(c.name)}</b></button>`).join('');
    box.querySelectorAll('.class-btn').forEach(b=>b.addEventListener('click',()=>{ const c=list.find(x=>x.id===b.dataset.id); setClass(c.id, c.name); onPicked(); }));
  }catch(e){ box.innerHTML = '<span class="hint">連不上網路，請確認網路後重新整理。</span>'; }
}

let student = store.get('student', null);   // {seat, name}
function sid(){ return student ? `${classId}-${student.name}` : 'guest'; }
let state = {};
function loadStudentState(){
  state.stars = store.get('stars:'+sid(), 0);
  state.wrong = store.get('wrong:'+sid(), []);
}
state.custom = store.get('custom',[]);
state.onlyMine = store.get('onlyMine',false);
state.classWords = store.get('classWords',[]);
state.onlyClass = store.get('onlyClass',false);
loadStudentState();
function saveStudentState(){ store.set('stars:'+sid(), state.stars); store.set('wrong:'+sid(), state.wrong); }

function itemsFrom(lines){ return lines.map(parseLine).filter(x=>x && !x.err); }
function customItems(){ return itemsFrom(state.custom); }
function classItems(){ return itemsFrom(state.classWords); }
function allItems(){
  const map = new Map();
  BUILTIN.forEach(i=>map.set(i.w,i));
  classItems().forEach(i=>map.set(i.w,i));
  customItems().forEach(i=>map.set(i.w,i));
  return [...map.values()];
}
function pool(){ return poolAll().filter(it=>!TEST_WORDS.has(it.w)); }
function poolAll(){
  const cls = classItems();
  if(state.onlyClass && cls.length>=4) return cls;
  const mine = customItems();
  if(state.onlyMine && mine.length>=4) return mine;
  return allItems();
}
function findItem(w){ return allItems().find(i=>i.w===w); }

// ======== 和後台溝通 ========
async function loadClassWords(){
  if(!HAS_BACKEND) return;
  try{
    const r = await fetch(SCRIPT_URL+'?action=words&cls='+encodeURIComponent(classId||''));
    const d = await r.json();
    if(d && d.ok){
      if(d.className){ className = d.className; store.set('className', className); }
      if(classId && d.classOk===false){ setClass('', ''); }
      state.classWords = (d.words||[]).filter(l=>!parseLine(l).err);
      state.onlyClass = !!d.onlyClass;
      store.set('classWords',state.classWords); store.set('onlyClass',state.onlyClass);
      if(typeof onClassWords==='function') onClassWords(d);
    }
  }catch(e){}
}
function postJSON(obj){
  return fetch(SCRIPT_URL,{method:'POST',mode:'no-cors',headers:{'Content-Type':'text/plain;charset=utf-8'},body:JSON.stringify(obj)});
}
async function flushPending(){
  if(!HAS_BACKEND) return;
  let q = store.get('pending',[]);
  while(q.length){
    try{ await postJSON(q[0]); q.shift(); store.set('pending',q); }
    catch(e){ return false; }
  }
  return true;
}
async function sendLog(answers){
  if(!HAS_BACKEND || !answers.length || !student) return null;
  const q = store.get('pending',[]);
  q.push({action:'log', seat:student.seat, name:student.name, c:classId, answers});
  store.set('pending', q.slice(-30));
  return flushPending();
}

// ======== 朗讀 ========
const canSpeak = 'speechSynthesis' in window;
// ---- 挑最自然的中文語音 ----
// 台灣口音優先；同樣是台灣口音時，「增強版／高音質／自然／Neural／Google」這類比較像真人的聲音優先
function zhVoices(){
  try{ return speechSynthesis.getVoices().filter(v=>/^zh|^cmn|^yue/i.test(v.lang) || /Chinese|中文|國語|普通話|台灣|臺灣/i.test(v.name)); }catch(e){ return []; }
}
function voiceScore(v){
  let s = 0;
  if(/zh[-_]TW|zh[-_]Hant|cmn[-_]Hant[-_]TW/i.test(v.lang) || /台灣|臺灣|Taiwan/i.test(v.name)) s += 100;
  else if(/zh[-_]CN|cmn|zh[-_]Hans/i.test(v.lang)) s += 30;
  else if(/yue|zh[-_]HK/i.test(v.lang)) s += 5;
  if(/Enhanced|Premium|增強|高音質|優化|Natural|自然|Neural|Online/i.test(v.name)) s += 40;
  if(/Google/i.test(v.name)) s += 25;
  if(/Mei-?Jia|美佳|HsiaoChen|曉臻|HsiaoYu|曉雨|YunJhe|雲哲|Hanhan|涵涵/i.test(v.name)) s += 10;
  if(/Compact|Eloquence|eSpeak/i.test(v.name)) s -= 50;
  if(v.localService === false) s += 5;
  return s;
}
function pickVoice(){
  const vs = zhVoices(); if(!vs.length) return null;
  const chosen = store.get('voiceName', '');
  if(chosen){ const v = vs.find(x=>x.name===chosen); if(v) return v; }
  return vs.slice().sort((a,b)=>voiceScore(b)-voiceScore(a))[0];
}
function speak(text){
  if(!canSpeak) return;
  try{
    const u = new SpeechSynthesisUtterance(text);
    const v = pickVoice();
    u.lang = v ? v.lang : 'zh-TW';
    if(v) u.voice = v;
    u.rate = Number(store.get('voiceRate', 0.9)) || 0.9; u.pitch = 1;
    speechSynthesis.cancel(); speechSynthesis.speak(u);
  }catch(e){}
}
if(canSpeak){ try{ speechSynthesis.getVoices(); speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', ()=>{ if(typeof renderVoicePanel==='function') renderVoicePanel(); }); }catch(e){} }

// ======== 老師錄音 ========
let recWords = new Set(store.get('recWords',[]));
const audioCache = {};
const player = new Audio();
let audioUnlocked = false;
// iPad 規定聲音要由點擊開始播放：第一次點畫面時先播一段無聲，之後才能順利播錄音
const SILENT = 'data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEAQB8AAIA+AAACABAAZGF0YQAAAAA=';
document.addEventListener('pointerdown',()=>{ if(audioUnlocked) return; audioUnlocked=true; try{ player.src=SILENT; const p=player.play(); if(p) p.catch(()=>{}); }catch(e){} },{capture:true});

async function loadRecList(){
  if(!HAS_BACKEND) return;
  try{
    const d = await (await fetch(SCRIPT_URL+'?action=audioList')).json();
    if(d && d.ok){ recWords = new Set(d.words||[]); store.set('recWords',[...recWords]); }
  }catch(e){}
}
async function fetchAudio(w){
  if(audioCache[w]) return audioCache[w];
  const d = await (await fetch(SCRIPT_URL+'?action=audio&w='+encodeURIComponent(w))).json();
  if(!d || !d.ok) throw new Error('no audio');
  audioCache[w] = `data:${d.mime||'audio/wav'};base64,${d.data}`;
  return audioCache[w];
}
function playUrl(url){ player.pause(); player.src = url; player.currentTime = 0; return player.play(); }
function speakWord(w){
  if(HAS_BACKEND && recWords.has(w)){
    if(audioCache[w]){ const p=playUrl(audioCache[w]); if(p) p.catch(()=>speak(w)); return; }
    fetchAudio(w).then(playUrl).catch(()=>speak(w));
    return;
  }
  speak(w);
}
function prefetchRound(){
  if(!HAS_BACKEND) return;
  round.forEach(q=>{ if(recWords.has(q.item.w)) fetchAudio(q.item.w).catch(()=>{}); });
}

// 錄音轉成 WAV（每台 iPad、電腦都能播放），去掉前後空白、音量調整、最長 3 秒
async function toWav(blob){
  const ab = await blob.arrayBuffer();
  const AC = window.AudioContext || window.webkitAudioContext;
  const ctx = new AC();
  const buf = await new Promise((res,rej)=>{ const p=ctx.decodeAudioData(ab,res,rej); if(p&&p.then) p.then(res,rej); });
  try{ ctx.close(); }catch(e){}
  const len = buf.length, chs = buf.numberOfChannels;
  const mono = new Float32Array(len);
  for(let c=0;c<chs;c++){ const d=buf.getChannelData(c); for(let i=0;i<len;i++) mono[i]+=d[i]/chs; }
  const rate = 16000, ratio = buf.sampleRate/rate;
  const n = Math.floor(len/ratio);
  let out = new Float32Array(n);
  for(let i=0;i<n;i++){ const a=Math.floor(i*ratio), b=Math.max(a+1,Math.floor((i+1)*ratio)); let s=0; for(let k=a;k<b&&k<len;k++) s+=mono[k]; out[i]=s/(b-a); }
  let peak=0; for(const v of out) peak=Math.max(peak,Math.abs(v));
  if(peak<0.01) throw new Error('quiet');
  const th = Math.max(0.015, peak*0.08), pad = Math.round(rate*0.12);
  let st=0, en=out.length-1;
  while(st<out.length && Math.abs(out[st])<th) st++;
  while(en>st && Math.abs(out[en])<th) en--;
  st=Math.max(0,st-pad); en=Math.min(out.length-1,en+pad);
  out = out.slice(st, Math.min(en+1, st+rate*3));
  const gain = 0.9/peak;
  const bytes = new Uint8Array(44+out.length*2), dv = new DataView(bytes.buffer);
  const wstr=(o,s)=>{ for(let i=0;i<s.length;i++) dv.setUint8(o+i,s.charCodeAt(i)); };
  wstr(0,'RIFF'); dv.setUint32(4,36+out.length*2,true); wstr(8,'WAVE'); wstr(12,'fmt ');
  dv.setUint32(16,16,true); dv.setUint16(20,1,true); dv.setUint16(22,1,true); dv.setUint32(24,rate,true);
  dv.setUint32(28,rate*2,true); dv.setUint16(32,2,true); dv.setUint16(34,16,true); wstr(36,'data'); dv.setUint32(40,out.length*2,true);
  for(let i=0;i<out.length;i++){ const v=Math.max(-1,Math.min(1,out[i]*gain)); dv.setInt16(44+i*2, v<0?v*0x8000:v*0x7fff, true); }
  let bin=''; for(let i=0;i<bytes.length;i+=0x8000) bin+=String.fromCharCode.apply(null, bytes.subarray(i,i+0x8000));
  const b64 = btoa(bin);
  return {b64, url:'data:audio/wav;base64,'+b64};
}

// ======== 出題 ========
function hasConfusable(item){ return item.syl.some(s=>[...s.l].some(c=>PAIRS[c])); }

function makeQ(mode, item, P, opt={}){
  if(mode==='m1'){
    const correct = zyStr(item.syl);
    const tones=[], swaps=[];
    item.syl.forEach((s,i)=>{
      for(let t=1;t<=5;t++){ if(t!==s.t){ const c=item.syl.map(x=>({...x})); c[i].t=t; tones.push(zyStr(c)); } }
      [...s.l].forEach((ch,k)=>{ if(PAIRS[ch]){ const c=item.syl.map(x=>({...x})); const arr=[...s.l]; arr[k]=PAIRS[ch]; c[i].l=arr.join(''); swaps.push(zyStr(c)); } });
    });
    const set = new Set();
    shuffle(swaps).slice(0,2).forEach(x=>{ if(x!==correct) set.add(x); });
    for(const x of shuffle(tones)){ if(set.size>=3) break; if(x!==correct) set.add(x); }
    const opts = shuffle([correct, ...[...set].slice(0,3)]);
    return {mode,item,title:'這個詞的注音是哪一個？',show:'char',options:opts.map(o=>({label:optZy(o),key:o,text:o,correct:o===correct})),cls:'zy-opt'};
  }
  if(mode==='m2'){
    const len = item.syl.length;
    let others = P.filter(i=>i.w!==item.w && i.syl.length===len);
    if(others.length<3) others = P.filter(i=>i.w!==item.w);
    const opts = shuffle([item, ...shuffle(others).slice(0,3)]);
    return {mode,item,title:'這是哪一個詞？',show:'zy',options:opts.map(o=>({label:esc(o.w),key:o.w,text:o.w,correct:o.w===item.w})),cls:'word-opt'};
  }
  if(mode==='m3'){
    const idx = opt.idx!=null ? opt.idx : Math.floor(Math.random()*item.syl.length);
    const ch = Array.from(item.w)[idx];
    const t = item.syl[idx].t;
    return {mode,item,idx,title:`「${ch}」是第幾聲？`,show:'tone',options:[1,2,3,4,5].map(n=>({label:`${TONE_SHOW[n]}<small>${TONE_NAMES[n]}</small>`,key:n,text:`第${idx+1}字「${ch}」選${TONE_NAMES[n]}`,correct:n===t})),cls:'five'};
  }
  if(mode==='m4'){
    const spots=[];
    item.syl.forEach((s,i)=>[...s.l].forEach((c,k)=>{ if(PAIRS[c]) spots.push({i,k,c}); }));
    const sp = (opt.letter && spots.find(x=>x.c===opt.letter && (opt.idx==null || x.i===opt.idx))) || pick(spots);
    const pair = shuffle([sp.c, PAIRS[sp.c]]);
    const ch = Array.from(item.w)[sp.i];
    return {mode,item,idx:sp.i,spot:sp,title:'空格裡應該填哪一個？',show:'blank',options:pair.map(p=>({label:p,key:p,text:`第${sp.i+1}字「${ch}」選${p}`,correct:p===sp.c})),cls:'big'};
  }
}

function buildRound(mode){
  const P = pool();
  if(mode==='review'){
    const list = shuffle(state.wrong).slice(0,10).map(x=>{ const it=findItem(x.w); return it?{mode:x.mode,item:it}:null; }).filter(Boolean);
    return list.map(x=>{ let m=x.mode; if(m==='m4' && !hasConfusable(x.item)) m='m1'; return makeQ(m,x.item,P); });
  }
  const qs=[]; const used=new Set();
  for(let n=0;n<10;n++){
    let m = mode==='mix' ? pick(['m1','m2','m3','m4']) : mode;
    let cands = P.filter(i=>!used.has(i.w) && (m!=='m4'||hasConfusable(i)));
    if(!cands.length){ cands = P.filter(i=>m!=='m4'||hasConfusable(i)); }
    if(!cands.length){ m='m1'; cands=P; }
    const it = pick(cands); used.add(it.w);
    qs.push(makeQ(m,it,P));
  }
  return qs;
}

// ======== 畫面 ========
const $ = id=>document.getElementById(id);
const screens = ['pickClass','login','home','quiz','result','parent','teacher','testIntro','testQuiz','testDone'];
function show(name){
  screens.forEach(s=>$(s).hidden = s!==name);
  const studentView = name!=='teacher' && name!=='login' && name!=='pickClass';
  if(name==='login') renderClassLine();
  $('meBox').hidden = !(student && studentView);
  $('starBox').hidden = !(student && studentView);
  window.scrollTo(0,0);
  if(name==='home') refreshHome();
}
function goHome(){
  if(HAS_BACKEND && !classId) return showClassPicker(()=>{ student=null; store.set('student',null); loadStudentState(); loadClassWords(); show('login'); });
  show(student ? 'home' : 'login');
}
function renderClassLine(){
  const el = $('classLine'); if(!el) return;
  if(!HAS_BACKEND || !classId){ el.innerHTML=''; return; }
  el.innerHTML = `班級：<b>${esc(className||'讀取中…')}</b> <button type="button" class="linkbtn" id="notMyClass">不是這一班？</button>`;
  $('notMyClass').addEventListener('click',()=>{ setClass('',''); student=null; store.set('student',null); goHome(); });
}
const GO_TEST = new URLSearchParams(location.search).get('go')==='test';
let goTestUsed = false;
function onClassWords(d){
  if(d && d.diagPhase){ diagPhase = d.diagPhase; store.set('diagPhase', diagPhase); }
  renderClassLine();
  if(!$('home').hidden) refreshHome();
  if(GO_TEST && !goTestUsed && student && !$('home').hidden && diagPhase!=='關閉'){ goTestUsed = true; openTestIntro(); }
}

function refreshHome(){
  $('starCount').textContent = state.stars;
  if(student) { $('meName').textContent = student.name; $('hello').textContent = `${student.name}，今天想練什麼？`; }
  const n = state.wrong.length;
  $('reviewInfo').textContent = n ? `有 ${n} 題等你再挑戰` : '目前沒有錯題，太棒了';
  $('reviewCard').disabled = !n;
  const c = customItems().length;
  $('customInfo').textContent = c ? `這台已加入 ${c} 個詞${state.onlyMine&&c>=4?'（目前只練這些）':''}` : '只會出現在這台 iPad';
  const cls = classItems().length;
  const nb = $('classNotice');
  refreshTestCard();
  if(cls){ nb.hidden=false; nb.textContent = state.onlyClass&&cls>=4 ? `老師指定了 ${cls} 個本週字詞，今天的題目都會從這些詞出。` : `老師加了 ${cls} 個本週字詞，會混在題目裡出現。`; }
  else nb.hidden=true;
}

// 直式注音：符號由上往下排，聲調標在最後一個符號的右上方，輕聲點在最上面
function vertZy(s, opt={}){
  const letters = [...s.l].map((c,k)=> k===opt.blankK ? '<span class="blank">▢</span>' : esc(c));
  let tone = '';
  if(opt.hideTone) tone = '<span class="blank">？</span>';
  else if(s.t>=2 && s.t<=4) tone = TONE_MARK[s.t];
  const dot = (!opt.hideTone && s.t===5) ? '<span class="dot">˙</span>' : '';
  const body = letters.map((c,k)=> k===letters.length-1 && tone ? `<span class="z">${c}<span class="t">${tone}</span></span>` : `<span class="z">${c}</span>`).join('');
  return dot + body;
}

// 選項用的直式注音：每個字的注音一欄，由左到右排
function optZy(str){
  return `<span class="optzy" aria-label="${esc(str)}">${str.split(' ').map(x=>`<span class="zy">${vertZy(parseSyl(x))}</span>`).join('')}</span>`;
}

// 小型「國字＋直式注音」，用在答案說明、錯題清單、老師後台
function miniWord(w, zy){
  const chars = Array.from(w), syl = String(zy).trim().split(/\s+/).map(parseSyl);
  return `<span class="mini" aria-label="${esc(w)} ${esc(zy)}">${chars.map((c,i)=>`<span class="mc"><span class="mch">${esc(c)}</span>${syl[i]?`<span class="zy">${vertZy(syl[i])}</span>`:''}</span>`).join('')}</span>`;
}

function wordHTML(q, revealed){
  const chars = Array.from(q.item.w);
  const zyOnly = q.show==='zy' && !revealed;
  const cells = chars.map((c,i)=>{
    const s = q.item.syl[i];
    let zy = vertZy(s);
    let target = false;
    if(!revealed){
      if(q.show==='char') zy = '';
      if(q.show==='tone' && i===q.idx){ target=true; zy = vertZy(s,{hideTone:true}); }
      if(q.show==='blank' && i===q.idx){ target=true; zy = vertZy(s,{blankK:q.spot.k}); }
    } else if((q.show==='tone'||q.show==='blank') && i===q.idx){ target=true; }
    const chHTML = zyOnly ? '' : `<span class="ch">${esc(c)}</span>`;
    const zyHTML = zy ? `<span class="zy">${zy}</span>` : '';
    return `<div class="cell${target?' target':''}">${chHTML}${zyHTML}</div>`;
  }).join('');
  return `<div class="word${zyOnly?' zy-only':''}">${cells}</div>`;
}

let round=[], qi=0, score=0, streak=0, roundWrong=[], lastMode='m1', answered=false, log=[];

function startRound(mode){
  if(pool().length<4) return;
  lastMode = mode;
  round = buildRound(mode);
  if(!round.length){ show('home'); return; }
  qi=0; score=0; streak=0; roundWrong=[]; log=[];
  show('quiz'); renderQ(); prefetchRound();
}

const speakerSVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M4 9v6h4l5 4V5L8 9H4zm12.5 3a4.5 4.5 0 0 0-2.5-4v8a4.5 4.5 0 0 0 2.5-4zM14 3.2v2.1a7 7 0 0 1 0 13.4v2.1a9 9 0 0 0 0-17.6z"/></svg>';

function renderQ(){
  answered=false;
  const q = round[qi];
  $('progText').textContent = `第 ${qi+1} / ${round.length} 題`;
  $('progBar').style.width = (qi/round.length*100)+'%';
  $('qTitle').textContent = q.title;
  $('qWord').innerHTML = wordHTML(q,false);
  $('qSay').hidden = !(canSpeak || (HAS_BACKEND && recWords.has(q.item.w)));
  $('qOptions').className = 'options ' + (q.cls==='five'?'five':'');
  $('qOptions').innerHTML = q.options.map((o,i)=>`<button class="opt ${q.cls==='five'?'':q.cls}" data-i="${i}">${o.label}</button>`).join('');
  $('qFeedback').innerHTML = '';
  $('qOptions').querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>answer(+b.dataset.i)));
  $('qPanel').classList.remove('pop'); void $('qPanel').offsetWidth; $('qPanel').classList.add('pop');
}

function answer(i){
  if(answered) return; answered=true;
  const q = round[qi];
  const ok = q.options[i].correct;
  const btns = $('qOptions').querySelectorAll('.opt');
  btns.forEach((b,k)=>{ b.disabled=true; if(q.options[k].correct) b.classList.add('right'); });
  if(!ok) btns[i].classList.add('wrong');
  log.push({mode:MODE_NAMES[q.mode], w:q.item.w, zy:zyStr(q.item.syl), ok, pick:q.options[i].text, heard:!!q.heard});
  const key = {w:q.item.w, mode:q.mode};
  if(ok){
    score++; streak++; state.stars++;
    if(lastMode==='review'){ state.wrong = state.wrong.filter(x=>!(x.w===key.w && x.mode===key.mode)); }
  } else {
    streak=0; roundWrong.push(q);
    if(!state.wrong.some(x=>x.w===key.w && x.mode===key.mode)) state.wrong.push(key);
  }
  saveStudentState();
  $('starCount').textContent = state.stars;
  $('streak').textContent = streak>=3 ? `連續答對 ${streak} 題！` : '';
  $('qWord').innerHTML = wordHTML(q,true);
  const praise = pick(['答對了！','好厲害！','完全正確！','你真棒！']);
  const last = qi===round.length-1;
  $('qFeedback').innerHTML = `<div class="feedback ${ok?'ok':'no'}">
    <div><div class="msg">${ok?praise:'沒關係，記住正確答案'}</div>
    <div class="ans">${miniWord(q.item.w, zyStr(q.item.syl))}</div></div>
    <div class="actions">
      <button class="btn" id="nextBtn">${last?'看成績':'下一題 →'}</button>
    </div></div>`;
  $('nextBtn').addEventListener('click',next);
  $('nextBtn').focus();
}

function next(){
  qi++;
  if(qi>=round.length) return showResult();
  renderQ();
}

function sendRoundLog(){
  const a = log; log = [];
  return sendLog(a);
}

const starSVG = on=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="${on?'#f0a91e':'#e3e8ec'}" stroke="#1c3553" stroke-width="1.5" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>`;
function showResult(){
  show('result');
  const total = round.length;
  const ratio = score/total;
  const s3 = ratio>=0.9?3:ratio>=0.6?2:ratio>0?1:0;
  $('rTitle').textContent = ratio===1?'全部答對，太厲害了！':ratio>=0.8?'很棒！差一點就全對':ratio>=0.6?'不錯喔，繼續加油':'多練幾次就會越來越熟';
  $('rScore').textContent = `${score} / ${total}`;
  $('rStars').innerHTML = [0,1,2].map(i=>starSVG(i<s3)).join('');
  $('rWrong').innerHTML = roundWrong.length ? `<p class="hint">這回答錯的詞：</p><div class="wrong-list">${roundWrong.map(q=>`<span class="chip">${miniWord(q.item.w, zyStr(q.item.syl))}</span>`).join('')}</div>` : '';
  $('rReviewBtn').hidden = !state.wrong.length;
  $('rSent').textContent = HAS_BACKEND ? '正在把這回的成績送給老師…' : '';
  const p = sendRoundLog();
  if(p) p.then(ok=>{ if(ok===null) return; $('rSent').textContent = ok ? '這回的成績已經送給老師了' : '現在沒有網路，下次連上網會自動補送給老師'; });
}

// ======== 學生登入 ========
$('loginForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name = $('nameIn').value.trim().replace(/\s+/g,'');
  if(!name){ $('loginErr').textContent='請寫上你的名字'; $('nameIn').focus(); return; }
  $('loginErr').textContent='';
  student = {seat:'', name};
  store.set('student', student);
  loadStudentState();
  show('home');
  if(GO_TEST && !goTestUsed && HAS_BACKEND && diagPhase!=='關閉'){ goTestUsed = true; openTestIntro(); }
});
$('switchBtn').addEventListener('click',()=>{
  student = null; store.set('student', null);
  $('nameIn').value='';
  loadStudentState();
  show('login'); $('nameIn').focus();
});

// ======== 注音鍵盤 ========
const KB = 'ㄅㄆㄇㄈㄉㄊㄋㄌㄍㄎㄏㄐㄑㄒㄓㄔㄕㄖㄗㄘㄙㄧㄨㄩㄚㄛㄜㄝㄞㄟㄠㄡㄢㄣㄤㄥㄦ';
document.querySelectorAll('.kb').forEach(kb=>{
  let html = KB.split('').map(c=>`<button type="button" data-k="${c}">${c}</button>`).join('');
  html += ['ˊ','ˇ','ˋ','˙'].map(c=>`<button type="button" class="tone" data-k="${c}" aria-label="聲調 ${c}">${c}</button>`).join('');
  html += `<button type="button" class="wide" data-k=" ">空格</button><button type="button" class="wide" data-k="\n">換行</button><button type="button" class="wide" data-k="⌫">刪除</button>`;
  kb.innerHTML = html;
  kb.addEventListener('click',e=>{
    const b = e.target.closest('button'); if(!b) return;
    const ta = $(kb.dataset.for); const k = b.dataset.k;
    const s = ta.selectionStart ?? ta.value.length, en = ta.selectionEnd ?? ta.value.length;
    if(k==='⌫'){
      if(s===en && s>0){ ta.value = ta.value.slice(0,s-1)+ta.value.slice(en); ta.selectionStart=ta.selectionEnd=s-1; }
      else { ta.value = ta.value.slice(0,s)+ta.value.slice(en); ta.selectionStart=ta.selectionEnd=s; }
    } else {
      ta.value = ta.value.slice(0,s)+k+ta.value.slice(en);
      ta.selectionStart = ta.selectionEnd = s+k.length;
    }
    ta.focus();
  });
});

// ======== 家長區 ========
function renderMine(){
  const items = customItems();
  $('myCount').textContent = items.length;
  $('onlyMine').checked = state.onlyMine;
  $('myList').innerHTML = items.length ? items.map(it=>`<span class="mychip">${miniWord(it.w, zyStr(it.syl))}<button data-del="${esc(it.w)}" aria-label="刪除 ${esc(it.w)}">刪除</button></span>`).join('') : '<span class="hint">還沒有加入任何字詞</span>';
  $('myList').querySelectorAll('[data-del]').forEach(b=>b.addEventListener('click',()=>{
    state.custom = state.custom.filter(l=>{ const p=parseLine(l); return !(p && p.w===b.dataset.del); });
    store.set('custom',state.custom); renderMine();
  }));
}
$('addBtn').addEventListener('click',()=>{
  const {ok, errs} = validLines($('customInput').value);
  ok.forEach(norm=>{
    const w = norm.split(' ')[0];
    state.custom = state.custom.filter(x=>x.split(' ')[0]!==w);
    state.custom.push(norm);
  });
  store.set('custom',state.custom);
  $('addErr').textContent = errs.join('\n');
  $('addOk').textContent = ok.length ? `已加入 ${ok.length} 個詞` : '';
  if(!errs.length) $('customInput').value='';
  renderMine();
});
$('onlyMine').addEventListener('change',e=>{ state.onlyMine=e.target.checked; store.set('onlyMine',state.onlyMine); });

// ---- 聲音設定（家長區） ----
function renderVoicePanel(){
  const box = $('voicePanel'); if(!box) return;
  if(!canSpeak){ box.innerHTML = '<p class="hint">這個瀏覽器不能朗讀。</p>'; return; }
  const vs = zhVoices().sort((a,b)=>voiceScore(b)-voiceScore(a));
  const cur = pickVoice();
  const sel = $('voiceSel');
  sel.innerHTML = vs.length ? vs.map(v=>`<option value="${esc(v.name)}"${cur&&cur.name===v.name?' selected':''}>${esc(v.name)}（${esc(v.lang)}）${voiceScore(v)>=140?' ★推薦':''}</option>`).join('') : '<option value="">找不到中文語音</option>';
  $('voiceRate').value = store.get('voiceRate', 0.9);
  $('voiceRateTxt').textContent = Number($('voiceRate').value).toFixed(2) + ' 倍';
  const best = vs[0];
  $('voiceTip').hidden = !!(best && voiceScore(best) >= 140);
}
$('voiceSel').addEventListener('change',()=>{ store.set('voiceName', $('voiceSel').value); speak('蝴蝶'); });
$('voiceRate').addEventListener('input',()=>{ store.set('voiceRate', Number($('voiceRate').value)); $('voiceRateTxt').textContent = Number($('voiceRate').value).toFixed(2) + ' 倍'; });
$('voiceTest').addEventListener('click',()=>speak('媽媽，我們一起去公園'));
$('voiceAuto').addEventListener('click',()=>{ store.set('voiceName',''); store.set('voiceRate',0.9); renderVoicePanel(); speak('蝴蝶'); });
$('parentBtn').addEventListener('click',()=>setTimeout(renderVoicePanel,50));

// ======== 老師後台 ========
let tKey = '';
try{ tKey = sessionStorage.getItem('zyx-tkey') || ''; }catch(e){}
function fmtTime(iso){
  const d = new Date(iso); if(isNaN(d)) return '';
  const pad=n=>String(n).padStart(2,'0');
  return `${d.getMonth()+1}/${d.getDate()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
function openTeacher(){
  show('teacher');
  if(!HAS_BACKEND){
    $('tLogin').hidden=false; $('tMain').hidden=true;
    $('tErr').textContent='網站還沒連上 Google 試算表後台，請先完成後台設定。';
    return;
  }
  if(tKey) loadReport(); else { $('tLogin').hidden=false; $('tMain').hidden=true; $('tCode').focus(); }
}
async function loadReport(){
  $('tErr').textContent='讀取中…';
  try{
    const r = await fetch(SCRIPT_URL+'?action=report&key='+encodeURIComponent(tKey)+'&cls='+encodeURIComponent(tClass));
    const d = await r.json();
    if(!d.ok){ $('tErr').textContent = d.error || '讀取失敗'; tKey=''; try{sessionStorage.removeItem('zyx-tkey');}catch(e){} $('tLogin').hidden=false; $('tMain').hidden=true; return; }
    try{ sessionStorage.setItem('zyx-tkey', tKey); }catch(e){}
    $('tErr').textContent='';
    $('tLogin').hidden=true; $('tMain').hidden=false;
    tClassNames = d.classes || {};
    await loadClassesT();          // 先讀好班級清單，「分到班級」選單才會出現
    renderReport(d);
    renderRec(); loadRecList().then(renderRec);
    loadDiag();
    loadTeacherWords();
  }catch(e){
    $('tErr').textContent='連不上後台，請確認網路，或確認後台部署時「誰可以存取」選了「所有人」。';
    $('tLogin').hidden=false; $('tMain').hidden=true;
  }
}
// ---- 班級 ----
let tClass = 'all';
try{ tClass = sessionStorage.getItem('zyx-tclass') || 'all'; }catch(e){}
let tClassNames = {};
let tClassList = [];
const isOneClass = ()=> tClass!=='all' && tClass!=='_none';
const clsLabel = id => id ? (tClassNames[id] || '（已刪除的班級）') : '未分班';
const moveCtl = s => (!s.c && tClassList.length) ? `<div class="move-ctl" data-name="${esc(s.name)}"><select aria-label="把 ${esc(s.name)} 分到哪一班"><option value="">分到班級…</option>${tClassList.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('')}</select><button class="btn light" data-act="move">分過去</button></div>` : '';
const nameCell = s => `<td style="white-space:nowrap">${esc(s.name)}${tClass==='all'?`<div class="cls-tag">${esc(clsLabel(s.c))}</div>`:''}${moveCtl(s)}</td>`;
// 「分到班級」：把未分班學生的所有紀錄移到選好的班級
document.addEventListener('click', async e=>{
  const b = e.target.closest('.move-ctl button[data-act=move]'); if(!b) return;
  const box = b.closest('.move-ctl'), to = box.querySelector('select').value, name = box.dataset.name;
  if(!to){ box.querySelector('select').focus(); return; }
  b.disabled = true; b.textContent = '移動中…';
  try{ await postJSON({action:'moveStudent', key:tKey, name, from:'', to}); await new Promise(r=>setTimeout(r,1500)); loadReport(); }
  catch(err){ b.disabled = false; b.textContent = '分過去'; $('tErr').textContent = '移動失敗，請確認網路後再試一次'; }
});
async function loadClassesT(){
  try{ tClassList = await fetchClasses(); }catch(e){ return; }
  tClassList.forEach(c=>{ tClassNames[c.id]=c.name; });
  if(isOneClass() && !tClassList.some(c=>c.id===tClass)){ tClass='all'; }
  $('tClass').innerHTML = `<option value="all">全部班級</option>` + tClassList.map(c=>`<option value="${esc(c.id)}">${esc(c.name)}</option>`).join('') + `<option value="_none">未分班（舊資料）</option>`;
  $('tClass').value = tClass;
  // 一排按鈕：全部班級、各班、未分班
  const chips = [['all','全部班級']].concat(tClassList.map(c=>[c.id,c.name]), [['_none','未分班']]);
  $('tClassChips').innerHTML = chips.map(([id,nm])=>`<button type="button" class="cls-chip${id===tClass?' on':''}" data-id="${esc(id)}" aria-pressed="${id===tClass}">${esc(nm)}</button>`).join('');
  const scope = tClass==='all' ? '全部班級的' : tClass==='_none' ? '未分班的' : `${clsLabel(tClass)} 的`;
  document.querySelectorAll('.scope-name').forEach(el=>{ el.textContent = scope; });
  $('tClassHint').textContent = tClass==='all' ? '顯示所有班級的學生，姓名下方會標出班級。' : tClass==='_none' ? '建立班級以前收集的資料。' : '';
  renderClassMgr();
}
$('tClassChips').addEventListener('click',e=>{
  const b = e.target.closest('.cls-chip'); if(!b || b.dataset.id===tClass) return;
  $('tClass').value = b.dataset.id; $('tClass').dispatchEvent(new Event('change'));
});
$('tClass').addEventListener('change',()=>{ tClass=$('tClass').value; try{ sessionStorage.setItem('zyx-tclass', tClass); }catch(e){} loadReport(); });

const XQ_URL = location.origin + location.pathname;
function qrSVG(text){
  const q = new QRLib.QRCode(-1, QRLib.L.M); q.addData(text); q.make();
  const n = q.getModuleCount(), pad = 4; let d='';
  for(let r=0;r<n;r++) for(let c=0;c<n;c++) if(q.isDark(r,c)) d+=`M${c+pad},${r+pad}h1v1h-1z`;
  return `<svg viewBox="0 0 ${n+pad*2} ${n+pad*2}" shape-rendering="crispEdges" role="img" aria-label="QR Code"><rect width="100%" height="100%" fill="#fff"/><path d="${d}" fill="#111"/></svg>`;
}
let delArm = {};
function renderClassMgr(){
  $('classMgr').innerHTML = tClassList.length ? tClassList.map(c=>`<div class="cm-row" data-id="${esc(c.id)}">
      <div class="cm-name"><b>${esc(c.name)}</b><small class="hint">代碼 ${esc(c.id)}</small></div>
      <div class="rec-btns">
        <button class="btn" data-act="qr">QR Code</button>
        <button class="btn light" data-act="rename">改名</button>
        <button class="btn light danger" data-act="del">${delArm[c.id] && Date.now()-delArm[c.id]<4000 ? '再按一次確定刪除' : '刪除'}</button>
      </div></div>`).join('') : '<span class="hint">還沒有班級。在上面輸入班級名稱，按「新增班級」。</span>';
}
$('addClassBtn').addEventListener('click',async ()=>{
  const name = $('newClassName').value.trim();
  $('classMgrErr').textContent='';
  if(!name){ $('classMgrErr').textContent='請先輸入班級名稱，例如「王老師・三年二班」'; return; }
  if(tClassList.some(c=>c.name===name)){ $('classMgrErr').textContent='已經有同名的班級了'; return; }
  $('addClassBtn').disabled = true;
  try{
    await postJSON({action:'addClass', key:tKey, name});
    await new Promise(r=>setTimeout(r,1200));
    $('newClassName').value='';
    await loadClassesT();
    const c = tClassList.find(x=>x.name===name);
    if(c) showQR(c.id); else $('classMgrErr').textContent='好像沒有建立成功，請按「重新整理」確認';
  }catch(e){ $('classMgrErr').textContent='新增失敗，請確認網路後再試一次'; }
  $('addClassBtn').disabled = false;
});
$('classMgr').addEventListener('click',async e=>{
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const id = b.closest('.cm-row').dataset.id, c = tClassList.find(x=>x.id===id); if(!c) return;
  $('classMgrErr').textContent='';
  if(b.dataset.act==='qr') return showQR(id);
  if(b.dataset.act==='rename'){
    const row = b.closest('.cm-row');
    row.querySelector('.cm-name').innerHTML = `<input class="cm-input" maxlength="30" value="${esc(c.name)}" aria-label="新的班級名稱">`;
    row.querySelector('.rec-btns').innerHTML = `<button class="btn" data-act="saveName">儲存</button><button class="btn light" data-act="cancel">取消</button>`;
    row.querySelector('.cm-input').focus();
    return;
  }
  if(b.dataset.act==='cancel') return renderClassMgr();
  if(b.dataset.act==='saveName'){
    const nm = b.closest('.cm-row').querySelector('.cm-input').value.trim(); if(!nm) return;
    b.disabled = true;
    try{ await postJSON({action:'renameClass', key:tKey, c:id, name:nm}); await new Promise(r=>setTimeout(r,1000)); await loadClassesT(); }
    catch(err){ $('classMgrErr').textContent='改名失敗，請再試一次'; renderClassMgr(); }
    return;
  }
  if(b.dataset.act==='del'){
    if(!(delArm[id] && Date.now()-delArm[id]<4000)){ delArm[id]=Date.now(); renderClassMgr(); setTimeout(renderClassMgr,4100); return; }
    delete delArm[id]; b.disabled = true;
    try{ await postJSON({action:'delClass', key:tKey, c:id}); await new Promise(r=>setTimeout(r,1000)); if(tClass===id){ tClass='all'; } $('qrView').hidden=true; await loadClassesT(); }
    catch(err){ $('classMgrErr').textContent='刪除失敗，請再試一次'; }
  }
});
function showQR(id){
  const c = tClassList.find(x=>x.id===id); if(!c) return;
  const u1 = XQ_URL + '#c-' + id;
  $('qrView').hidden = false;
  $('qrView').innerHTML = `<div class="qr-sheet" id="qrSheet">
      <h3>${esc(c.name)}</h3>
      <div class="qr-pair">
        <figure><div class="qr-box big">${qrSVG(u1)}</div><figcaption><b>注音小學堂</b><span>練習・前測・後測都在這裡</span></figcaption></figure>
      </div>
      <p class="qr-note">用 iPad 相機掃描，輸入自己的名字就能開始。</p>
    </div>
    <div class="actions no-print"><button class="btn" id="printQR">列印這一班的 QR Code</button><button class="btn light" id="closeQR">關閉</button></div>`;
  $('printQR').addEventListener('click',()=>{ document.body.classList.add('print-qr'); try{ window.print(); }catch(e){} setTimeout(()=>document.body.classList.remove('print-qr'),500); });
  $('closeQR').addEventListener('click',()=>{ $('qrView').hidden=true; });
  $('qrView').scrollIntoView({behavior:'smooth', block:'start'});
}

// ---- 各班字詞 ----
async function loadTeacherWords(){
  const one = isOneClass();
  $('wordsNeedClass').hidden = one; $('wordsEditor').hidden = !one;
  $('wordsClassName').textContent = one ? `（${clsLabel(tClass)}）` : '';
  if(!one) return;
  try{
    const d = await (await fetch(SCRIPT_URL+'?action=words&cls='+encodeURIComponent(tClass))).json();
    if(d && d.ok){ $('classInput').value = (d.words||[]).join('\n'); $('onlyClass').checked = !!d.onlyClass; }
  }catch(e){}
}

function renderReport(d){
  $('tUpdated').textContent = `更新時間 ${fmtTime(d.updated)}，共 ${d.students.length} 位學生`;
  $('tTop').innerHTML = d.top.length ? d.top.map(t=>`<span class="topchip">${miniWord(t.w, t.zy)} <small>${t.students} 人錯，共 ${t.wrong} 次</small></span>`).join('') : '<span class="hint">還沒有錯題紀錄</span>';
  const snd = d.sounds||[];
  const chipS = x=>{ const [a,b]=x.key.split(' → '); return `<span class="topchip snd"><span class="pair"><b>${esc(a)}</b><span class="arr">選成</span><b class="bad">${esc(b)}</b></span><small>${x.students} 人，共 ${x.count} 次</small></span>`; };
  const sSound = snd.filter(x=>x.type==='sound'), sTone = snd.filter(x=>x.type==='tone');
  $('tSoundLetters').innerHTML = sSound.length ? sSound.slice(0,10).map(chipS).join('') : '<span class="hint">還沒有易混淆音的錯誤</span>';
  $('tSoundTones').innerHTML = sTone.length ? sTone.slice(0,10).map(chipS).join('') : '<span class="hint">還沒有聲調的錯誤</span>';
  $('tBody').innerHTML = d.students.length ? d.students.map(s=>{
    const rate = s.total ? Math.round(s.right/s.total*100) : 0;
    const cls = rate>=85?'hi':rate>=60?'mid':'lo';
    const weak = s.weak.length ? s.weak.map(w=>`<span class="wchip${w.lastOk?' done':''}" title="${esc(w.picks.join('、'))}">${miniWord(w.w, w.zy)}${w.lastOk?'':`<b>×${w.wrong}</b>`}</span>`).join('') : '<span class="hint">沒有錯題</span>';
    return `<tr>${nameCell(s)}<td class="num">${s.total}</td><td class="num"><span class="rate ${cls}">${rate}%</span>${s.heardRight?`<div class="heard">自己答對 ${s.total?Math.round((s.right-s.heardRight)/s.total*100):0}%<br><span class="ear">聽</span>聽了才答對 ${s.heardRight} 題</div>`:''}</td><td class="num">${fmtTime(s.last)}</td><td><div class="weak">${(s.sounds||[]).length ? s.sounds.map(x=>{ const [a,b]=x.key.split(' → '); return `<span class="schip">${esc(a)}<span class="arr">→</span>${esc(b)}<b>×${x.count}</b></span>`; }).join('') : '<span class="hint">—</span>'}</div></td><td><div class="weak">${weak}</div></td></tr>`;
  }).join('') : '<tr><td colspan="6" class="hint">還沒有學生的練習紀錄。學生練完一回後，紀錄就會出現在這裡。</td></tr>';
}
$('tLogin').addEventListener('submit',e=>{ e.preventDefault(); if(!HAS_BACKEND) return; tKey=$('tCode').value.trim(); if(!tKey){ $('tErr').textContent='請輸入老師密碼'; return; } loadReport(); });
$('tRefresh').addEventListener('click',loadReport);
$('saveClass').addEventListener('click',async ()=>{
  const {ok, errs} = validLines($('classInput').value);
  $('classErr').textContent = errs.join('\n');
  $('classOk').textContent = '';
  if(errs.length) return;
  const only = $('onlyClass').checked;
  if(only && ok.length<4){ $('classErr').textContent='要「全班只練這些字詞」，至少要有 4 個詞'; return; }
  if(!isOneClass()){ $('classErr').textContent='請先在最上面選一個班級'; return; }
  $('classOk').textContent='儲存中…';
  try{
    await postJSON({action:'setWords', key:tKey, c:tClass, words:ok, onlyClass:only});
    await new Promise(r=>setTimeout(r,1200));
    const d = await (await fetch(SCRIPT_URL+'?action=words&cls='+encodeURIComponent(tClass))).json();
    $('classOk').textContent = d && (d.words||[]).length===ok.length ? `已儲存 ${ok.length} 個詞，${clsLabel(tClass)}的學生下次打開網站就會拿到` : '已送出，請按「重新整理」確認';
  }catch(e){ $('classOk').textContent=''; $('classErr').textContent='儲存失敗，請確認網路後再試一次'; }
});
$('teacherLink').addEventListener('click',openTeacher);

// ---- 老師錄音介面 ----
const recState = {};   // w -> {phase:'idle'|'rec'|'review'|'saving', wav}
let recActive = null;  // {w, mr, stream, timer}
function hasLight(it){ return it.syl.some(s=>s.t===5); }
function renderRec(){
  const only = $('recOnlyLight').checked;
  const listen = LISTEN_ITEMS.map(x=>x.item);
  const items = listen.concat(allItems().filter(it=>!TEST_WORDS.has(it.w) && (!only || hasLight(it))));
  const done = items.filter(it=>recWords.has(it.w)).length;
  const ld = listen.filter(it=>recWords.has(it.w)).length;
  $('recCount').textContent = `聽音題已錄 ${ld} / ${listen.length}　全部已錄 ${done} / ${items.length}`;
  $('recList').innerHTML = items.map(it=>{
    const st = recState[it.w] || {phase:'idle'};
    const has = recWords.has(it.w);
    let btns = '';
    if(st.phase==='rec') btns = `<button class="btn rec-on" data-act="stop">停止</button><span class="hint">錄音中…</span>`;
    else if(st.phase==='review') btns = `<button class="btn" data-act="save">儲存</button><button class="btn light" data-act="preview">再聽一次</button><button class="btn light" data-act="rec">重錄</button>`;
    else if(st.phase==='saving') btns = `<span class="hint">儲存中…</span>`;
    else btns = `<button class="btn light" data-act="rec">${has?'重新錄音':'錄音'}</button>${has?`<button class="btn light" data-act="play">播放</button><button class="btn light danger" data-act="del">刪除</button>`:''}`;
    const lt = LISTEN_ITEMS.find(x=>x.item.w===it.w);
    return `<div class="rec-row${lt?' listen-row-rec':''}" data-w="${esc(it.w)}"><div class="rec-word">${miniWord(it.w, zyStr(it.syl))}${lt?`<small class="must-tag">${lt.form==='A'?'前測':'後測'}聽音題・一定要錄</small>`:''}</div><span class="pill ${has?'on':''}">${has?'已錄音':'未錄音'}</span><div class="rec-btns">${btns}</div></div>`;
  }).join('') || '<span class="hint">沒有符合的詞</span>';
}
$('recOnlyLight').addEventListener('change',renderRec);

// ---- 診斷報告 ----
const SKILLS = ['拼讀','認讀','一聲','二聲','三聲','四聲','輕聲','ㄓㄗ','ㄔㄘ','ㄕㄙ','ㄣㄥ','ㄢㄤ','ㄋㄌ','ㄈㄏ','聽ㄓㄗ','聽ㄔㄘ','聽ㄕㄙ','聽ㄣㄥ'];
const SKILL_GROUP = {'拼讀':'整體','認讀':'整體','一聲':'聲調','二聲':'聲調','三聲':'聲調','四聲':'聲調','輕聲':'聲調','聽ㄓㄗ':'聽音辨別','聽ㄔㄘ':'聽音辨別','聽ㄕㄙ':'聽音辨別','聽ㄣㄥ':'聽音辨別'};
async function loadDiag(){
  $('diagErr').textContent='';
  try{
    const d = await (await fetch(SCRIPT_URL+'?action=diagReport&key='+encodeURIComponent(tKey)+'&cls='+encodeURIComponent(tClass))).json();
    if(!d.ok){ $('diagErr').textContent = d.error||'讀取診斷資料失敗'; return; }
    renderDiag(d);
  }catch(e){ $('diagErr').textContent='讀取診斷資料失敗，請按「重新整理」再試一次。後台程式要更新到有診斷功能的版本。'; }
}
function pct(r,n){ return n ? Math.round(r/n*100) : null; }
function renderDiag(d){
  if(d.classes) Object.assign(tClassNames, d.classes);
  const one = isOneClass();
  document.querySelectorAll('input[name=dphase]').forEach(r=>{ r.checked = one && r.value===d.phase; r.disabled = !one; });
  $('savePhase').disabled = !one;
  $('phaseClassName').textContent = one ? `（${clsLabel(tClass)}）` : '（請先在最上面選一個班級）';
  const agg = {pre:{}, post:{}, pairPre:{}, pairPost:{}};
  const add = (bucket,x)=>SKILLS.forEach(k=>{ const v=x.skills[k]; if(!v) return; const a=bucket[k]||(bucket[k]={n:0,r:0}); a.n+=v.n; a.r+=v.right; });
  d.students.forEach(st=>{ if(st.pre) add(agg.pre,st.pre); if(st.post) add(agg.post,st.post); if(st.pre&&st.post){ add(agg.pairPre,st.pre); add(agg.pairPost,st.post); } });
  const bar = v => v==null ? '<span class="hint">—</span>' : `<span class="pbar"><i style="width:${v}%" class="${v>=85?'hi':v>=60?'mid':'lo'}"></i></span><span class="pnum">${v}%</span>`;
  const preN = d.students.filter(s=>s.pre).length, postN = d.students.filter(s=>s.post).length;
  $('dSkills').innerHTML = SKILLS.map(k=>{
    const a=agg.pre[k], b=agg.post[k];
    const pa=a?pct(a.r,a.n):null, pb=b?pct(b.r,b.n):null;
    const c1=agg.pairPre[k], c2=agg.pairPost[k];
    const diff = c1&&c2 ? pct(c2.r,c2.n)-pct(c1.r,c1.n) : null;
    return `<tr><td><span class="sk">${esc(k)}</span><small class="hint"> ${SKILL_GROUP[k]||'易混淆音'}</small></td><td>${bar(pa)}</td><td>${bar(pb)}</td><td class="num">${diff==null?'<span class="hint">—</span>':`<b class="${diff>0?'up':diff<0?'down':''}">${diff>0?'+':''}${diff}</b>`}</td></tr>`;
  }).join('') + `<tr><td class="hint" colspan="4">前測 ${preN} 人、後測 ${postN} 人。「進步」只算前測和後測都做過的 ${d.students.filter(s=>s.pre&&s.post).length} 位學生。</td></tr>`;
  $('dHead').innerHTML = `<tr><th>姓名</th><th>前測</th><th>後測</th>${SKILLS.map(k=>`<th class="skh">${esc(k)}</th>`).join('')}</tr>`;
  $('dBody').innerHTML = d.students.length ? d.students.map(st=>{
    const tot = x => x ? `<span class="rate ${pct(x.right,x.total)>=85?'hi':pct(x.right,x.total)>=60?'mid':'lo'}">${x.right}/${x.total}</span>${x.heard?`<div class="heard"><span class="ear">聽</span>${x.heard} 題</div>`:''}` : '<span class="hint">未做</span>';
    const cells = SKILLS.map(k=>{
      const a = st.pre && st.pre.skills[k], b = st.post && st.post.skills[k];
      const last = b || a;
      if(!last) return '<td class="hint">—</td>';
      const cls = last.right===last.n ? 'full' : last.right===0 ? 'none' : 'half';
      const txt = a && b ? `${a.right}→${b.right}` : `${last.right}`;
      const tip = `${k}：${a?`前測 ${a.right}/${a.n}`:''}${a&&b?'，':''}${b?`後測 ${b.right}/${b.n}`:''}`;
      return `<td><span class="dc ${cls}" title="${esc(tip)}">${txt}</span></td>`;
    }).join('');
    return `<tr>${nameCell(st)}<td class="num">${tot(st.pre)}</td><td class="num">${tot(st.post)}</td>${cells}</tr>`;
  }).join('') : `<tr><td colspan="${SKILLS.length+3}" class="hint">還沒有學生做診斷測驗。</td></tr>`;
}
$('savePhase').addEventListener('click',async ()=>{
  const r = document.querySelector('input[name=dphase]:checked'); if(!r) return;
  $('phaseOk').textContent='儲存中…';
  if(!isOneClass()) return;
  try{ await postJSON({action:'setDiagPhase', key:tKey, c:tClass, phase:r.value}); await new Promise(x=>setTimeout(x,1000)); await loadDiag(); $('phaseOk').textContent=`已設定為「${r.value}」`; }
  catch(e){ $('phaseOk').textContent=''; $('diagErr').textContent='儲存失敗，請確認網路後再試一次'; }
});
$('recList').addEventListener('click',async e=>{
  const b = e.target.closest('button[data-act]'); if(!b) return;
  const w = b.closest('.rec-row').dataset.w, act = b.dataset.act;
  $('recErr').textContent='';
  if(act==='rec') return startRec(w);
  if(act==='stop') return stopRec();
  if(act==='preview'){ const st=recState[w]; if(st&&st.wav) playUrl(st.wav.url).catch(()=>{}); return; }
  if(act==='play'){ fetchAudio(w).then(playUrl).catch(()=>{ $('recErr').textContent='播放失敗，請按「重新整理」再試一次'; }); return; }
  if(act==='save'){
    const st = recState[w]; if(!st||!st.wav) return;
    recState[w] = {phase:'saving', wav:st.wav}; renderRec();
    try{
      await postJSON({action:'setAudio', key:tKey, w, mime:'audio/wav', data:st.wav.b64});
      await new Promise(r=>setTimeout(r,1500));
      await loadRecList();
      if(recWords.has(w)){ audioCache[w]=st.wav.url; delete recState[w]; }
      else { recState[w]={phase:'review', wav:st.wav}; $('recErr').textContent='好像沒有存成功，請再按一次「儲存」'; }
    }catch(err){ recState[w]={phase:'review', wav:st.wav}; $('recErr').textContent='儲存失敗，請確認網路後再試一次'; }
    return renderRec();
  }
  if(act==='del'){
    b.disabled = true;
    try{ await postJSON({action:'delAudio', key:tKey, w}); await new Promise(r=>setTimeout(r,1200)); await loadRecList(); delete audioCache[w]; }
    catch(err){ $('recErr').textContent='刪除失敗，請確認網路後再試一次'; }
    return renderRec();
  }
});
async function startRec(w){
  if(recActive) stopRec();
  if(!(navigator.mediaDevices && navigator.mediaDevices.getUserMedia && window.MediaRecorder)){
    $('recErr').textContent='這個瀏覽器不能錄音，請改用 iPad 的 Safari 或電腦的 Chrome。'; return;
  }
  let stream;
  try{ stream = await navigator.mediaDevices.getUserMedia({audio:true}); }
  catch(err){ $('recErr').textContent='沒有拿到麥克風權限。請在瀏覽器設定裡允許這個網站使用麥克風，再按一次「錄音」。'; return; }
  const mr = new MediaRecorder(stream); const chunks=[];
  mr.ondataavailable = ev=>{ if(ev.data && ev.data.size) chunks.push(ev.data); };
  mr.onstop = async ()=>{
    stream.getTracks().forEach(t=>t.stop());
    try{
      const wav = await toWav(new Blob(chunks,{type:mr.mimeType||'audio/mp4'}));
      recState[w] = {phase:'review', wav}; renderRec();
      playUrl(wav.url).catch(()=>{});
    }catch(err){
      delete recState[w]; renderRec();
      $('recErr').textContent = err && err.message==='quiet' ? '沒有錄到聲音，請靠近麥克風再錄一次。' : '錄音處理失敗，請再錄一次。';
    }
  };
  recActive = {w, mr, timer:setTimeout(stopRec, 3000)};
  recState[w] = {phase:'rec'}; renderRec();
  mr.start();
}
function stopRec(){
  if(!recActive) return;
  clearTimeout(recActive.timer);
  const {mr} = recActive; recActive = null;
  try{ if(mr.state!=='inactive') mr.stop(); }catch(e){}
}
$('qSay').innerHTML = speakerSVG + '聽聽看';
document.querySelectorAll('[data-zy]').forEach(el=>{ el.innerHTML = optZy(el.dataset.zy); });
$('qSay').addEventListener('click',()=>{ const q=round[qi]; if(!q) return; if(!answered) q.heard=true; speakWord(q.item.w); });
$('teacherBack').addEventListener('click',goHome);

// ======== 事件 ========
document.querySelectorAll('.mode[data-mode]').forEach(b=>b.addEventListener('click',()=>startRound(b.dataset.mode)));
$('homeBtn').addEventListener('click',goHome);
$('quitBtn').addEventListener('click',()=>{ sendRoundLog(); goHome(); });
$('rHomeBtn').addEventListener('click',goHome);
$('againBtn').addEventListener('click',()=>startRound(lastMode==='review'&&!state.wrong.length?'mix':lastMode));
$('rReviewBtn').addEventListener('click',()=>startRound('review'));
$('parentBtn').addEventListener('click',()=>{ show('parent'); renderMine(); });
$('parentBack').addEventListener('click',goHome);

