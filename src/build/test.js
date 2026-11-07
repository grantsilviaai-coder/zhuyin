
// ======== 前測／後測（合併在注音小學堂裡） ========
// 前測用 A 卷、後測用 B 卷：題型一樣、詞語不同，詞語也不會出現在練習題裡
// [題型, 詞語 注音, 能力, 第幾個字(從0算), 要考的注音符號]
// m1 看字選注音、m2 看注音選字、m3 聲調、m4 易混淆音(三選一)、m5 聽音辨別
const FORMS = {
  A: [
    ['m1','蝸牛 ㄨㄛ ㄋㄧㄡˊ','拼讀'], ['m4','珍珠 ㄓㄣ ㄓㄨ','ㄓㄗ',0,'ㄓ'], ['m3','開心 ㄎㄞ ㄒㄧㄣ','一聲',0], ['m5','竹子 ㄓㄨˊ ˙ㄗ','聽ㄓㄗ',0,'ㄓ'],
    ['m4','吃飯 ㄔ ㄈㄢˋ','ㄔㄘ',0,'ㄔ'], ['m2','雞蛋 ㄐㄧ ㄉㄢˋ','認讀'], ['m3','白雲 ㄅㄞˊ ㄩㄣˊ','二聲',0], ['m4','書桌 ㄕㄨ ㄓㄨㄛ','ㄕㄙ',0,'ㄕ'],
    ['m4','門口 ㄇㄣˊ ㄎㄡˇ','ㄣㄥ',0,'ㄣ'], ['m3','水果 ㄕㄨㄟˇ ㄍㄨㄛˇ','三聲',0], ['m5','出門 ㄔㄨ ㄇㄣˊ','聽ㄔㄘ',0,'ㄔ'], ['m4','安全 ㄢ ㄑㄩㄢˊ','ㄢㄤ',0,'ㄢ'],
    ['m3','大樹 ㄉㄚˋ ㄕㄨˋ','四聲',1], ['m4','南瓜 ㄋㄢˊ ㄍㄨㄚ','ㄋㄌ',0,'ㄋ'], ['m4','房子 ㄈㄤˊ ˙ㄗ','ㄈㄏ',0,'ㄈ'], ['m3','哥哥 ㄍㄜ ˙ㄍㄜ','輕聲',1],
    ['m1','鞋子 ㄒㄧㄝˊ ˙ㄗ','拼讀'], ['m4','自己 ㄗˋ ㄐㄧˇ','ㄓㄗ',0,'ㄗ'], ['m5','掃地 ㄙㄠˇ ㄉㄧˋ','聽ㄕㄙ',0,'ㄙ'], ['m3','青菜 ㄑㄧㄥ ㄘㄞˋ','一聲',0],
    ['m4','廁所 ㄘㄜˋ ㄙㄨㄛˇ','ㄔㄘ',0,'ㄘ'], ['m4','雨傘 ㄩˇ ㄙㄢˇ','ㄕㄙ',1,'ㄙ'], ['m3','牙齒 ㄧㄚˊ ㄔˇ','二聲',0], ['m2','玩具 ㄨㄢˊ ㄐㄩˋ','認讀'],
    ['m4','風箏 ㄈㄥ ㄓㄥ','ㄣㄥ',0,'ㄥ'], ['m3','小鳥 ㄒㄧㄠˇ ㄋㄧㄠˇ','三聲',1], ['m5','冷水 ㄌㄥˇ ㄕㄨㄟˇ','聽ㄣㄥ',0,'ㄥ'], ['m4','糖果 ㄊㄤˊ ㄍㄨㄛˇ','ㄢㄤ',0,'ㄤ'],
    ['m3','汽車 ㄑㄧˋ ㄔㄜ','四聲',0], ['m4','籃球 ㄌㄢˊ ㄑㄧㄡˊ','ㄋㄌ',0,'ㄌ'], ['m4','紅色 ㄏㄨㄥˊ ㄙㄜˋ','ㄈㄏ',0,'ㄏ'], ['m3','尾巴 ㄨㄟˇ ˙ㄅㄚ','輕聲',1],
  ],
  B: [
    ['m1','螃蟹 ㄆㄤˊ ㄒㄧㄝˋ','拼讀'], ['m4','照片 ㄓㄠˋ ㄆㄧㄢˋ','ㄓㄗ',0,'ㄓ'], ['m3','公車 ㄍㄨㄥ ㄔㄜ','一聲',0], ['m5','坐車 ㄗㄨㄛˋ ㄔㄜ','聽ㄓㄗ',0,'ㄗ'],
    ['m4','船長 ㄔㄨㄢˊ ㄓㄤˇ','ㄔㄘ',0,'ㄔ'], ['m2','餅乾 ㄅㄧㄥˇ ㄍㄢ','認讀'], ['m3','魚缸 ㄩˊ ㄍㄤ','二聲',0], ['m4','手錶 ㄕㄡˇ ㄅㄧㄠˇ','ㄕㄙ',0,'ㄕ'],
    ['m4','身體 ㄕㄣ ㄊㄧˇ','ㄣㄥ',0,'ㄣ'], ['m3','雨衣 ㄩˇ ㄧ','三聲',0], ['m5','草地 ㄘㄠˇ ㄉㄧˋ','聽ㄔㄘ',0,'ㄘ'], ['m4','飯碗 ㄈㄢˋ ㄨㄢˇ','ㄢㄤ',0,'ㄢ'],
    ['m3','電話 ㄉㄧㄢˋ ㄏㄨㄚˋ','四聲',1], ['m4','奶奶 ㄋㄞˇ ˙ㄋㄞ','ㄋㄌ',0,'ㄋ'], ['m4','肥皂 ㄈㄟˊ ㄗㄠˋ','ㄈㄏ',0,'ㄈ'], ['m3','妹妹 ㄇㄟˋ ˙ㄇㄟ','輕聲',1],
    ['m1','外套 ㄨㄞˋ ㄊㄠˋ','拼讀'], ['m4','走路 ㄗㄡˇ ㄌㄨˋ','ㄓㄗ',0,'ㄗ'], ['m5','山上 ㄕㄢ ㄕㄤˋ','聽ㄕㄙ',0,'ㄕ'], ['m3','星期 ㄒㄧㄥ ㄑㄧˊ','一聲',0],
    ['m4','菜園 ㄘㄞˋ ㄩㄢˊ','ㄔㄘ',0,'ㄘ'], ['m4','松鼠 ㄙㄨㄥ ㄕㄨˇ','ㄕㄙ',0,'ㄙ'], ['m3','茶杯 ㄔㄚˊ ㄅㄟ','二聲',0], ['m2','剪刀 ㄐㄧㄢˇ ㄉㄠ','認讀'],
    ['m4','燈光 ㄉㄥ ㄍㄨㄤ','ㄣㄥ',0,'ㄥ'], ['m3','小草 ㄒㄧㄠˇ ㄘㄠˇ','三聲',1], ['m5','很好 ㄏㄣˇ ㄏㄠˇ','聽ㄣㄥ',0,'ㄣ'], ['m4','上學 ㄕㄤˋ ㄒㄩㄝˊ','ㄢㄤ',0,'ㄤ'],
    ['m3','跳繩 ㄊㄧㄠˋ ㄕㄥˊ','四聲',0], ['m4','綠色 ㄌㄩˋ ㄙㄜˋ','ㄋㄌ',0,'ㄌ'], ['m4','黃色 ㄏㄨㄤˊ ㄙㄜˋ','ㄈㄏ',0,'ㄏ'], ['m3','鼻子 ㄅㄧˊ ˙ㄗ','輕聲',1],
  ],
};
// 易混淆音的第三個選項：選一個能拼得出來、但不是答案的音
const THIRD = {'ㄓ':'ㄔ','ㄗ':'ㄘ','ㄔ':'ㄕ','ㄘ':'ㄙ','ㄕ':'ㄖ','ㄙ':'ㄘ','ㄣ':'ㄢ','ㄥ':'ㄤ','ㄢ':'ㄣ','ㄤ':'ㄥ','ㄋ':'ㄇ','ㄌ':'ㄖ','ㄈ':'ㄅ','ㄏ':'ㄍ'};
const FORM_ITEMS = {};
Object.keys(FORMS).forEach(k=>{ FORM_ITEMS[k] = FORMS[k].map(r=>parseLine(r[1])); });
const TEST_WORDS = new Set(Object.values(FORM_ITEMS).flat().map(it=>it.w));
const LISTEN_ITEMS = Object.keys(FORMS).flatMap(k=>FORMS[k].filter(r=>r[0]==='m5').map(r=>({form:k, item:parseLine(r[1])})));
MODE_NAMES.m5 = '聽音辨別';

function formOf(ph){ return ph==='後測' ? 'B' : 'A'; }
function buildTest(ph){
  const k = formOf(ph), pool = FORM_ITEMS[k];
  return FORMS[k].map(([mode,line,skill,idx,letter],n)=>{
    const item = parseLine(line);
    let q;
    if(mode==='m4' || mode==='m5'){
      const spots=[]; item.syl.forEach((s,i)=>[...s.l].forEach((c,j)=>{ if(c===letter && i===idx) spots.push({i,k:j,c}); }));
      const sp = spots[0];
      const swap = to=>{ const c=item.syl.map(x=>({...x})); const arr=[...c[sp.i].l]; arr[sp.k]=to; c[sp.i].l=arr.join(''); return c; };
      if(mode==='m4'){
        const ch = Array.from(item.w)[sp.i];
        const opts = shuffle([sp.c, PAIRS[sp.c], THIRD[sp.c]]);
        q = {mode,item,idx:sp.i,spot:sp,title:'空格裡應該填哪一個？',show:'blank',cls:'big',
             options:opts.map(p=>({label:p,key:p,text:`第${sp.i+1}字「${ch}」選${p}`,correct:p===sp.c}))};
      } else {
        const right = zyStr(item.syl);
        const opts = shuffle([right, zyStr(swap(PAIRS[sp.c])), zyStr(swap(THIRD[sp.c]))]);
        q = {mode,item,title:'按「聽聽看」，選出你聽到的注音',show:'listen',cls:'zy-opt',
             options:opts.map(o=>({label:optZy(o),key:o,text:o,correct:o===right}))};
      }
    } else {
      q = makeQ(mode, item, pool, {idx});
      if(mode==='m1') q.title='這個詞的注音是哪一個？';
      if(mode==='m2') q.title='這是哪一個詞？';
    }
    q.no = n+1; q.skill = skill;
    return q;
  });
}

let diagPhase = store.get('diagPhase', '前測');
let run = store.get('diagRun', null);   // {name, c, phase, attempt, i, answers:[]}
let tq = [], tAnswered = false;
const doneKey = ()=> `diagDone:${classId}:${student?student.name:''}:${diagPhase}`;
function runActive(){ return run && student && run.name===student.name && (run.c||'')===classId && run.phase===diagPhase && run.i>0 && run.i<FORMS[formOf(run.phase)].length; }

function refreshTestCard(){
  const card = $('testCard'); if(!card) return;
  if(!HAS_BACKEND || !student || diagPhase==='關閉'){ card.hidden = true; return; }
  card.hidden = false;
  $('testTag').textContent = diagPhase;
  const done = store.get(doneKey(), null);
  if(runActive()){
    $('testMsg').textContent = `你上次做到第 ${run.i+1} 題，按下面的按鈕接著做。`;
    $('testGo').textContent = '接著做'; $('testGo').hidden = false; $('testRedo').hidden = true;
    card.classList.remove('done');
  } else if(done){
    $('testMsg').textContent = `你已經做完${diagPhase}了，謝謝你！`;
    $('testGo').hidden = true; $('testRedo').hidden = false;
    card.classList.add('done');
  } else {
    $('testMsg').textContent = `老師開放了${diagPhase}，大約 12 分鐘。請先做這個，再去練習。`;
    $('testGo').textContent = '開始'; $('testGo').hidden = false; $('testRedo').hidden = true;
    card.classList.remove('done');
  }
}
function openTestIntro(){
  if(runActive()) return resumeTest();
  show('testIntro');
  $('introTag').textContent = diagPhase;
  $('introTitle').textContent = `注音小檢查（${diagPhase}）`;
}
function startTest(){
  run = {name:student.name, c:classId, phase:diagPhase, attempt:String(Date.now()), i:0, answers:[]};
  store.set('diagRun', run);
  tq = buildTest(diagPhase);
  show('testQuiz'); renderTQ(); prefetchTest();
}
function resumeTest(){ tq = buildTest(run.phase); show('testQuiz'); renderTQ(); prefetchTest(); }
function prefetchTest(){ if(!HAS_BACKEND) return; tq.forEach(q=>{ if(recWords.has(q.item.w)) fetchAudio(q.item.w).catch(()=>{}); }); }

function renderTQ(){
  tAnswered = false;
  const q = tq[run.i]; q.heard = false;
  $('tProg').textContent = `第 ${run.i+1} / ${tq.length} 題`;
  $('tBar').style.width = (run.i/tq.length*100)+'%';
  $('tTitle').textContent = q.title;
  $('tWord').innerHTML = q.show==='listen'
    ? `<div class="listen-big"><span class="hint">這一題要用聽的</span></div>`
    : wordHTML(q,false);
  $('tSay').hidden = !(canSpeak || (HAS_BACKEND && recWords.has(q.item.w)));
  $('tSay').classList.toggle('must', q.show==='listen');
  $('tOptions').className = 'options ' + (q.cls==='five'?'five':'') + (q.options.length===3?' three':'');
  $('tOptions').innerHTML = q.options.map((o,i)=>`<button class="opt ${q.cls==='five'?'':q.cls}" data-i="${i}">${o.label}</button>`).join('');
  $('tOptions').querySelectorAll('.opt').forEach(b=>b.addEventListener('click',()=>chooseT(+b.dataset.i)));
  $('tPanel').classList.remove('pop'); void $('tPanel').offsetWidth; $('tPanel').classList.add('pop');
}
function chooseT(i){
  if(tAnswered) return; tAnswered = true;
  const q = tq[run.i];
  const btns = $('tOptions').querySelectorAll('.opt');
  btns.forEach(b=>b.disabled=true); btns[i].classList.add('picked');
  run.answers.push({no:q.no, skill:q.skill, mode:MODE_NAMES[q.mode], w:q.item.w, zy:zyStr(q.item.syl), ok:q.options[i].correct, pick:q.options[i].text, heard: q.mode!=='m5' && !!q.heard});
  run.i++; store.set('diagRun', run);
  setTimeout(()=>{ if(run.i>=tq.length) finishTest(); else renderTQ(); }, 380);
}
async function finishTest(){
  show('testDone');
  store.set(`diagDone:${run.c||''}:${run.name}:${run.phase}`, run.attempt);
  const q = store.get('pending',[]);
  q.push({action:'diag', name:run.name, c:run.c||classId, phase:run.phase, attempt:run.attempt, answers:run.answers});
  store.set('pending', q.slice(-30));
  run = null; store.set('diagRun', null);
  await trySendTest();
}
async function trySendTest(){
  $('tDoneMsg').textContent='正在把你的作答交給老師…'; $('tRetry').hidden = true;
  const ok = await flushPending();
  if(ok) $('tDoneMsg').textContent='已經交給老師了。現在可以去練習了！';
  else { $('tDoneMsg').textContent='現在沒有網路。連上網以後按「再送一次」，或下次打開網站時會自動補送。'; $('tRetry').hidden = false; }
}

$('testGo').addEventListener('click',openTestIntro);
$('testRedo').addEventListener('click',()=>{ store.set(doneKey(), null); openTestIntro(); });
$('tStart').addEventListener('click',startTest);
$('tIntroBack').addEventListener('click',goHome);
$('tRetry').addEventListener('click',trySendTest);
$('tDoneHome').addEventListener('click',goHome);
$('tSay').innerHTML = speakerSVG + '聽聽看';
$('tSay').addEventListener('click',()=>{ const q = run && tq[run.i]; if(!q) return; if(!tAnswered) q.heard = true; speakWord(q.item.w); });

// ======== 啟動 ========
// 舊的「注音診斷站」網址自動轉到這裡，直接進入前後測
(function(){
  if(location.hostname==='jazzy-trifle-9635da.netlify.app'){
    location.replace('https://zippy-kitten-68848e.netlify.app/?go=test' + (location.hash||''));
  }
})();
if(location.hash==='#teacher') openTeacher(); else goHome();
loadClassWords();
loadRecList();
flushPending();
