
// ======== 注音診斷站 ========
// 固定 30 題，每位學生題目一樣，前測和後測才能比較
// [題型, 詞語, 能力, 指定字(第幾個字,從0算), 指定注音符號]
const BLUEPRINT = [
  ['m1','蝴蝶','拼讀'], ['m4','桌子','ㄓㄗ',0,'ㄓ'], ['m3','天空','一聲',0], ['m4','長頸鹿','ㄔㄘ',0,'ㄔ'], ['m2','蘋果','認讀'],
  ['m3','學校','二聲',0], ['m4','老師','ㄕㄙ',1,'ㄕ'], ['m4','金魚','ㄣㄥ',0,'ㄣ'], ['m3','小狗','三聲',1], ['m4','麵包','ㄢㄤ',0,'ㄢ'],
  ['m1','彩虹','拼讀'], ['m3','大象','四聲',1], ['m4','牛奶','ㄋㄌ',0,'ㄋ'], ['m4','飛機','ㄈㄏ',0,'ㄈ'], ['m3','媽媽','輕聲',1],
  ['m2','颱風','認讀'], ['m4','早餐','ㄓㄗ',0,'ㄗ'], ['m3','西瓜','一聲',1], ['m4','草莓','ㄔㄘ',0,'ㄘ'], ['m4','森林','ㄕㄙ',0,'ㄙ'],
  ['m3','河流','二聲',1], ['m1','運動','拼讀'], ['m4','冰箱','ㄣㄥ',0,'ㄥ'], ['m3','螞蟻','三聲',1], ['m4','海洋','ㄢㄤ',1,'ㄤ'],
  ['m2','鉛筆','認讀'], ['m3','跳舞','四聲',0], ['m4','老虎','ㄋㄌ',0,'ㄌ'], ['m4','花園','ㄈㄏ',0,'ㄏ'], ['m3','耳朵','輕聲',1],
];
const DIAG_TITLES = {m1:'這個詞的注音是哪一個？', m2:'這是哪一個詞？'};

const $ = id=>document.getElementById(id);
const screens = ['pickClass','login','intro','closed','quiz','done'];
function show(name){
  screens.forEach(s=>$(s).hidden = s!==name);
  $('meBox').hidden = !(student && name!=='login' && name!=='pickClass');
  if(name==='login') renderClassLine();
  if(student) $('meName').textContent = student.name;
  window.scrollTo(0,0);
}

let phase = store.get('diagPhase', '前測');
function onClassWords(d){ if(d && d.diagPhase){ phase = d.diagPhase; store.set('diagPhase', phase); } renderClassLine(); }
function renderClassLine(){
  const el = $('classLine'); if(!el) return;
  if(!HAS_BACKEND || !classId){ el.innerHTML=''; return; }
  el.innerHTML = `班級：<b>${esc(className||'讀取中…')}</b> <button type="button" class="linkbtn" id="notMyClass">不是這一班？</button>`;
  $('notMyClass').addEventListener('click',()=>{ setClass('',''); student=null; store.set('student',null); run=null; store.set('diagRun',null); start(); });
}
function start(){
  if(HAS_BACKEND && !classId) return showClassPicker(()=>{ student=null; store.set('student',null); loadClassWords(); show('login'); });
  if(student) afterLogin(); else { show('login'); loadClassWords(); }
}

// 進行中的作答存在這台 iPad，不小心關掉也能接著做
let run = store.get('diagRun', null);   // {name, phase, attempt, i, answers:[]}
let qs = [], answered = false;

function buildQs(){
  return BLUEPRINT.map(([mode,w,skill,idx,letter],n)=>{
    const item = BUILTIN.find(it=>it.w===w);
    const q = makeQ(mode, item, BUILTIN, {idx, letter});
    if(DIAG_TITLES[mode]) q.title = DIAG_TITLES[mode];
    q.no = n+1; q.skill = skill;
    return q;
  });
}

async function afterLogin(){
  $('meName').textContent = student.name;
  if(run && run.name===student.name && (run.c||'')===classId && run.phase && run.i>0 && run.i<BLUEPRINT.length){ return resume(); }
  $('phaseTag').textContent = '…'; show('intro'); $('startBtn').disabled = true;
  await loadClassWords();
  $('startBtn').disabled = false;
  if(phase==='關閉'){ show('closed'); return; }
  $('phaseTag').textContent = phase;
  $('introTitle').textContent = phase==='後測' ? '注音小檢查（後測）' : '注音小檢查（前測）';
  const done = store.get('diagDone:'+student.name+':'+phase, null);
  $('redoNote').hidden = !done;
  if(done) $('redoNote').textContent = `你已經做過${phase}了。如果老師請你再做一次，就按「開始」；老師會看最新的這一次。`;
}

function startTest(){
  run = {name:student.name, c:classId, phase, attempt:String(Date.now()), i:0, answers:[]};
  store.set('diagRun', run);
  qs = buildQs();
  show('quiz'); renderQ();
}
function resume(){
  qs = buildQs();
  show('quiz'); renderQ();
}

function renderQ(){
  answered = false;
  const q = qs[run.i];
  q.heard = false;
  $('progText').textContent = `第 ${run.i+1} / ${qs.length} 題`;
  $('progBar').style.width = (run.i/qs.length*100)+'%';
  $('qTitle').textContent = q.title;
  $('qWord').innerHTML = wordHTML(q,false);
  $('qSay').hidden = !(canSpeak || (HAS_BACKEND && recWords.has(q.item.w)));
  $('qOptions').className = 'options ' + (q.cls==='five'?'five':'');
  $('qOptions').innerHTML = q.options.map((o,i)=>`<button class="opt ${q.cls==='five'?'':q.cls}" data-i="${i}">${o.label}</button>`).join('');
  $('qOptions').querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>choose(+b.dataset.i)));
  $('qPanel').classList.remove('pop'); void $('qPanel').offsetWidth; $('qPanel').classList.add('pop');
  if(HAS_BACKEND && recWords.has(q.item.w)) fetchAudio(q.item.w).catch(()=>{});
}

function choose(i){
  if(answered) return; answered = true;
  const q = qs[run.i];
  const btns = $('qOptions').querySelectorAll('.opt');
  btns.forEach(b=>b.disabled=true);
  btns[i].classList.add('picked');
  run.answers.push({no:q.no, skill:q.skill, mode:MODE_NAMES[q.mode], w:q.item.w, zy:zyStr(q.item.syl), ok:q.options[i].correct, pick:q.options[i].text, heard:!!q.heard});
  run.i++;
  store.set('diagRun', run);
  setTimeout(()=>{ if(run.i>=qs.length) finish(); else renderQ(); }, 380);
}

async function finish(){
  show('done');
  $('doneStars').innerHTML = [0,1,2].map(()=>`<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#f0a91e" stroke="#1c3553" stroke-width="1.5" d="M12 2.8l2.8 5.8 6.3.9-4.6 4.4 1.1 6.3L12 17.2l-5.6 3 1.1-6.3L2.9 9.5l6.3-.9z"/></svg>`).join('');
  store.set('diagDone:'+run.name+':'+run.phase, run.attempt);
  if(!HAS_BACKEND){ $('doneMsg').textContent='（這個網站還沒有連上老師的後台）'; return; }
  const q = store.get('pending',[]);
  q.push({action:'diag', name:run.name, c:run.c||classId, phase:run.phase, attempt:run.attempt, answers:run.answers});
  store.set('pending', q.slice(-30));
  run = null; store.set('diagRun', null);
  await trySend();
}
async function trySend(){
  $('doneMsg').textContent='正在把你的作答交給老師…'; $('retrySend').hidden = true;
  const ok = await flushPending();
  if(ok){ $('doneMsg').textContent='已經交給老師了。你可以把 iPad 還給老師，或回去注音小學堂練習。'; }
  else { $('doneMsg').textContent='現在沒有網路。連上網以後按「再送一次」，或下次打開這個網站時會自動補送。'; $('retrySend').hidden = false; }
}

// ======== 事件 ========
$('loginForm').addEventListener('submit',e=>{
  e.preventDefault();
  const name = $('nameIn').value.trim().replace(/\s+/g,'');
  if(!name){ $('loginErr').textContent='請寫上你的名字'; $('nameIn').focus(); return; }
  $('loginErr').textContent='';
  student = {seat:'', name}; store.set('student', student);
  afterLogin();
});
$('switchBtn').addEventListener('click',()=>{
  if(run && run.i>0 && run.i<BLUEPRINT.length && !confirmSwitch()) return;
  student=null; store.set('student',null); run=null; store.set('diagRun',null);
  $('nameIn').value=''; show('login'); $('nameIn').focus();
});
let switchArmed = 0;
function confirmSwitch(){
  // 不能用 confirm 視窗：第一次按「換人」先提醒，3 秒內再按一次才換
  if(Date.now()-switchArmed < 3000) return true;
  switchArmed = Date.now();
  $('switchBtn').textContent = '再按一次換人（這次的作答會不見）';
  setTimeout(()=>{ $('switchBtn').textContent='換人'; }, 3000);
  return false;
}
$('startBtn').addEventListener('click',startTest);
$('closedRetry').addEventListener('click',afterLogin);
$('retrySend').addEventListener('click',trySend);
$('qSay').innerHTML = speakerSVG + '聽聽看';
$('qSay').addEventListener('click',()=>{ const q=qs[run && run.i]; if(!q) return; if(!answered) q.heard=true; speakWord(q.item.w); });

loadRecList();
flushPending();
start();
