/**
 * 注音小學堂：Google 試算表後台
 * 1. 把下面的老師密碼改成你自己的（不要用生日、不要告訴學生）
 * 2. 部署 → 新增部署作業 → 類型選「網頁應用程式」
 *    執行身分：我；誰可以存取：所有人
 */
const TEACHER_CODE = 'teacher1234';

const LOG_SHEET = '作答紀錄';
const WORD_SHEET = '全班字詞';
const AUDIO_SHEET = '老師錄音';
const DIAG_SHEET = '診斷紀錄';
const DIAG_HEADER = ['時間', '姓名', '測驗', '作答編號', '題號', '能力', '題型', '詞語', '注音', '結果', '學生選的答案', '作答前有聽', '班級代碼'];
const CLASS_SHEET = '班級設定';
const CLASS_HEADER = ['班級代碼', '班級名稱', '只練全班字詞', '診斷站開放', '全班字詞（一行一個）'];
const CHUNK = 40000; // 試算表一格最多 5 萬字，錄音分段存

function doGet(e) {
  const p = (e && e.parameter) || {};
  if (p.action === 'classes') {
    return json({ ok: true, classes: classes_().map(function (c) { return { id: c.id, name: c.name }; }) });
  }
  if (p.action === 'words') {
    const cls = p.cls ? findClass_(p.cls) : null;
    if (cls) return json({ ok: true, words: cls.words, onlyClass: cls.onlyClass, diagPhase: cls.diagPhase, className: cls.name, classOk: true });
    return json({ ok: true, words: readWords_(), onlyClass: getOnlyClass_(), diagPhase: getDiagPhase_(), className: '', classOk: !p.cls });
  }
  if (p.action === 'audioList') {
    return json({ ok: true, words: audioWords_() });
  }
  if (p.action === 'audio') {
    return json(readAudio_(p.w));
  }
  if (p.action === 'diagReport') {
    if (p.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
    return json(buildDiag_(p.cls || 'all'));
  }
  if (p.action === 'report') {
    if (p.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
    return json(buildReport_(p.cls || 'all'));
  }
  return json({ ok: true, msg: '注音小學堂後台運作中' });
}

function doPost(e) {
  let data = {};
  try { data = JSON.parse(e.postData.contents); } catch (err) { return json({ ok: false, error: 'bad json' }); }
  const lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    if (data.action === 'log') return json(writeLog_(data));
    if (data.action === 'diag') return json(writeDiag_(data));
    if (data.action === 'setDiagPhase') {
      if (data.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
      const ph = ['前測', '後測', '關閉'].indexOf(data.phase) >= 0 ? data.phase : '關閉';
      if (data.c) return json(updateClass_(data.c, { diagPhase: ph }));
      PropertiesService.getScriptProperties().setProperty('diagPhase', ph);
      return json({ ok: true, phase: ph });
    }
    if (data.action === 'moveStudent') {
      if (data.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
      return json(moveStudent_(data.name, data.from || '', data.to || ''));
    }
    if (data.action === 'addClass' || data.action === 'renameClass' || data.action === 'delClass') {
      if (data.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
      if (data.action === 'addClass') return json(addClass_(data.name));
      if (data.action === 'renameClass') return json(updateClass_(data.c, { name: data.name }));
      return json(deleteClass_(data.c));
    }
    if (data.action === 'setAudio' || data.action === 'delAudio') {
      if (data.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
      return json(data.action === 'setAudio' ? writeAudio_(data) : deleteAudio_(data.w));
    }
    if (data.action === 'setWords') {
      if (data.key !== TEACHER_CODE) return json({ ok: false, error: '老師密碼不對' });
      if (data.c) return json(updateClass_(data.c, { words: (data.words || []).slice(0, 300).map(function (w) { return String(w).slice(0, 60); }), onlyClass: !!data.onlyClass }));
      return json(writeWords_(data));
    }
    return json({ ok: false, error: 'unknown action' });
  } finally {
    lock.releaseLock();
  }
}

function json(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}

// 避免有人輸入「=」開頭的字被試算表當成公式
function safe_(v, max) {
  let s = String(v == null ? '' : v).slice(0, max || 40);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return s;
}

function sheet_(name, header) {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sh = ss.getSheetByName(name);
  if (!sh) sh = ss.insertSheet(name);
  if (header && sh.getLastRow() === 0) {
    sh.appendRow(header);
    sh.setFrozenRows(1);
  }
  return sh;
}

function writeLog_(d) {
  const sh = sheet_(LOG_SHEET, ['時間', '姓名', '題型', '詞語', '注音', '結果', '學生選的答案', '作答前有聽']);
  if (sh.getRange(1, 8).getValue() === '') sh.getRange(1, 8).setValue('作答前有聽');
  if (sh.getRange(1, 9).getValue() === '') sh.getRange(1, 9).setValue('班級代碼');
  const now = new Date();
  const rows = (d.answers || []).slice(0, 60).map(function (a) {
    return [now, safe_(d.name, 20), safe_(a.mode, 10), safe_(a.w, 10), safe_(a.zy, 40), a.ok ? '對' : '錯', safe_(a.pick, 40), a.heard ? '有聽' : '', safe_(d.c, 12)];
  });
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, 9).setValues(rows);
  return { ok: true, saved: rows.length };
}

function readWords_() {
  const sh = sheet_(WORD_SHEET, ['詞語與注音（例：蝴蝶 ㄏㄨˊ ㄉㄧㄝˊ）']);
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]).trim(); }).filter(String);
}

function writeWords_(d) {
  const sh = sheet_(WORD_SHEET, ['詞語與注音（例：蝴蝶 ㄏㄨˊ ㄉㄧㄝˊ）']);
  const n = sh.getLastRow();
  if (n >= 2) sh.getRange(2, 1, n - 1, 1).clearContent();
  const words = (d.words || []).slice(0, 300).map(function (w) { return [safe_(w, 60)]; });
  if (words.length) sh.getRange(2, 1, words.length, 1).setValues(words);
  PropertiesService.getScriptProperties().setProperty('onlyClass', d.onlyClass ? '1' : '0');
  return { ok: true, saved: words.length };
}

function getOnlyClass_() {
  return PropertiesService.getScriptProperties().getProperty('onlyClass') === '1';
}

function buildReport_(c) {
  try { ensureClassViews_(); } catch (err) {}
  const sh = sheet_(LOG_SHEET, ['時間', '姓名', '題型', '詞語', '注音', '結果', '學生選的答案', '作答前有聽']);
  const n = sh.getLastRow();
  const rows = (n < 2 ? [] : sh.getRange(2, 1, n - 1, 9).getValues()).filter(function (r) { return inClass_(c, r[8]); });
  const students = {};
  const classWords = {};
  const classSounds = {};
  rows.forEach(function (r) {
    const time = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
    const name = String(r[1]), mode = String(r[2]);
    const w = String(r[3]), zy = String(r[4]), ok = r[5] === '對', pick = String(r[6]), heard = r[7] === '有聽';
    const rc = String(r[8] || '');
    const key = rc + '|' + name;
    const s = students[key] || (students[key] = { name: name, c: rc, total: 0, right: 0, heardRight: 0, last: time, words: {}, sounds: {} });
    s.total++; if (ok) { s.right++; if (heard) s.heardRight++; } s.last = time;
    const ws = s.words[w] || (s.words[w] = { w: w, zy: zy, wrong: 0, total: 0, lastOk: true, picks: [] });
    ws.total++; ws.lastOk = ok;
    if (!ok) {
      ws.wrong++;
      ws.picks.push(mode + '：' + pick);
      if (ws.picks.length > 3) ws.picks.shift();
      const c = classWords[w] || (classWords[w] = { w: w, zy: zy, wrong: 0, who: {} });
      c.wrong++; c.who[key] = 1;
      classify_(mode, w, zy, pick).forEach(function (e) {
        const cs = classSounds[e.key] || (classSounds[e.key] = { key: e.key, type: e.type, count: 0, who: {} });
        cs.count++; cs.who[key] = 1;
        s.sounds[e.key] = (s.sounds[e.key] || 0) + 1;
      });
    }
  });
  const list = Object.keys(students).map(function (k) {
    const s = students[k];
    const weak = Object.keys(s.words).map(function (w) { return s.words[w]; })
      .filter(function (x) { return x.wrong > 0; })
      .sort(function (a, b) { return (a.lastOk - b.lastOk) || (b.wrong - a.wrong); });
    const sounds = Object.keys(s.sounds).map(function (k) { return { key: k, count: s.sounds[k] }; })
      .sort(function (a, b) { return b.count - a.count; }).slice(0, 4);
    return { name: s.name, c: s.c, total: s.total, right: s.right, heardRight: s.heardRight, last: s.last, weak: weak, sounds: sounds };
  }).sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
  const top = Object.keys(classWords).map(function (w) {
    const c = classWords[w];
    return { w: c.w, zy: c.zy, wrong: c.wrong, students: Object.keys(c.who).length };
  }).sort(function (a, b) { return b.students - a.students || b.wrong - a.wrong; }).slice(0, 15);
  const sounds = Object.keys(classSounds).map(function (k) {
    const c = classSounds[k];
    return { key: c.key, type: c.type, count: c.count, students: Object.keys(c.who).length };
  }).sort(function (a, b) { return b.students - a.students || b.count - a.count; });
  return { ok: true, students: list, top: top, sounds: sounds, classes: classNames_(), updated: new Date().toISOString() };
}

// ===== 分析「錯在哪個音」 =====
// 回傳像 { type:'sound', key:'ㄘ → ㄔ' }（正確 → 學生選的）或 { type:'tone', key:'二聲 → 三聲' }
const PAIRS_ = { 'ㄓ':'ㄗ','ㄗ':'ㄓ','ㄔ':'ㄘ','ㄘ':'ㄔ','ㄕ':'ㄙ','ㄙ':'ㄕ','ㄣ':'ㄥ','ㄥ':'ㄣ','ㄢ':'ㄤ','ㄤ':'ㄢ','ㄋ':'ㄌ','ㄌ':'ㄋ','ㄈ':'ㄏ','ㄏ':'ㄈ' };
const TONE_NAME_ = ['', '一聲', '二聲', '三聲', '四聲', '輕聲'];

function parseSyl_(x) {
  x = String(x).trim();
  if (x.charAt(0) === '˙') return { l: x.slice(1), t: 5 };
  const m = { 'ˊ': 2, 'ˇ': 3, 'ˋ': 4 };
  const last = x.charAt(x.length - 1);
  if (m[last]) return { l: x.slice(0, -1), t: m[last] };
  return { l: x, t: 1 };
}
function sylls_(zy) { return String(zy).trim().split(/\s+/).map(parseSyl_); }

function classify_(mode, w, zy, pick) {
  const out = [];
  const syl = sylls_(zy);
  const chars = String(w).split('');
  pick = String(pick).trim();
  if (mode === '聲調' || mode === '易混淆音') {
    const m = pick.match(/^(?:第(\d+)字)?「(.)」選(.+)$/);
    if (!m) return out;
    const idx = m[1] ? Number(m[1]) - 1 : chars.indexOf(m[2]);
    const s = syl[idx];
    if (!s) return out;
    if (mode === '聲調') {
      if (TONE_NAME_[s.t] !== m[3]) out.push({ type: 'tone', key: TONE_NAME_[s.t] + ' → ' + m[3] });
    } else {
      const correct = PAIRS_[m[3]];
      if (correct && s.l.indexOf(correct) >= 0) out.push({ type: 'sound', key: correct + ' → ' + m[3] });
    }
  } else if (mode === '看字選注音') {
    const ps = sylls_(pick);
    if (ps.length !== syl.length) return out;
    for (let i = 0; i < syl.length; i++) {
      const a = syl[i], b = ps[i];
      if (a.l === b.l && a.t !== b.t) out.push({ type: 'tone', key: TONE_NAME_[a.t] + ' → ' + TONE_NAME_[b.t] });
      else if (a.l !== b.l && a.l.length === b.l.length) {
        for (let k = 0; k < a.l.length; k++) if (a.l.charAt(k) !== b.l.charAt(k)) out.push({ type: 'sound', key: a.l.charAt(k) + ' → ' + b.l.charAt(k) });
      }
    }
  }
  return out;
}

// ===== 老師錄音（存在「老師錄音」工作表：A 詞語、B 格式、C 之後是分段的錄音資料） =====
function audioSheet_() { return sheet_(AUDIO_SHEET, ['詞語', '格式', '錄音資料（請勿修改）']); }

function audioRow_(sh, w) {
  const n = sh.getLastRow();
  if (n < 2) return 0;
  const names = sh.getRange(2, 1, n - 1, 1).getValues();
  for (let i = 0; i < names.length; i++) if (String(names[i][0]) === String(w)) return i + 2;
  return 0;
}

function audioWords_() {
  const sh = audioSheet_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 1).getValues().map(function (r) { return String(r[0]); }).filter(String);
}

function readAudio_(w) {
  const sh = audioSheet_();
  const row = audioRow_(sh, w);
  if (!row) return { ok: false, error: 'no audio' };
  const width = sh.getLastColumn();
  const vals = sh.getRange(row, 1, 1, width).getValues()[0];
  return { ok: true, w: String(vals[0]), mime: String(vals[1]), data: vals.slice(2).map(function (v) { return String(v).replace(/^~/, ''); }).join('') };
}

function writeAudio_(d) {
  const w = safe_(d.w, 10);
  const data = String(d.data || '');
  if (!w || !/^[A-Za-z0-9+\/=]+$/.test(data) || data.length > 600000) return { ok: false, error: 'bad audio' };
  const sh = audioSheet_();
  let row = audioRow_(sh, w);
  if (!row) row = sh.getLastRow() + 1;
  else sh.getRange(row, 1, 1, sh.getLastColumn()).clearContent();
  const parts = [];
  for (let i = 0; i < data.length; i += CHUNK) parts.push('~' + data.slice(i, i + CHUNK)); // 加「~」避免被當成數字或公式
  sh.getRange(row, 1, 1, parts.length + 2).setValues([[w, safe_(d.mime, 20)].concat(parts)]);
  return { ok: true };
}

function deleteAudio_(w) {
  const sh = audioSheet_();
  const row = audioRow_(sh, w);
  if (row) sh.deleteRow(row);
  return { ok: true };
}

// ===== 注音診斷站 =====
function getDiagPhase_() {
  return PropertiesService.getScriptProperties().getProperty('diagPhase') || '前測';
}

function writeDiag_(d) {
  const phase = d.phase === '後測' ? '後測' : '前測';
  const sh = sheet_(DIAG_SHEET, DIAG_HEADER);
  const now = new Date();
  const rows = (d.answers || []).slice(0, 60).map(function (a) {
    return [now, safe_(d.name, 20), phase, safe_(d.attempt, 20), Number(a.no) || '', safe_(a.skill, 10), safe_(a.mode, 10),
      safe_(a.w, 10), safe_(a.zy, 40), a.ok ? '對' : '錯', safe_(a.pick, 40), a.heard ? '有聽' : '', safe_(d.c, 12)];
  });
  if (sh.getRange(1, 13).getValue() === '') sh.getRange(1, 13).setValue('班級代碼');
  if (rows.length) sh.getRange(sh.getLastRow() + 1, 1, rows.length, DIAG_HEADER.length).setValues(rows);
  return { ok: true, saved: rows.length };
}

function buildDiag_(c) {
  const sh = sheet_(DIAG_SHEET, DIAG_HEADER);
  const n = sh.getLastRow();
  const rows = (n < 2 ? [] : sh.getRange(2, 1, n - 1, DIAG_HEADER.length).getValues()).filter(function (r) { return inClass_(c, r[12]); });
  // 每位學生、每種測驗，只用「最近一次」的作答
  const latest = {};   // name|phase -> attempt
  const lastTime = {};
  rows.forEach(function (r) {
    const k = (r[12] || '') + '|' + r[1] + '|' + r[2];
    const t = r[0] instanceof Date ? r[0].getTime() : Date.parse(r[0]) || 0;
    if (!(k in lastTime) || t >= lastTime[k]) { lastTime[k] = t; latest[k] = String(r[3]); }
  });
  const students = {};
  rows.forEach(function (r) {
    const rc = String(r[12] || '');
    const name = String(r[1]), phase = String(r[2]), k = rc + '|' + name + '|' + phase;
    if (String(r[3]) !== latest[k]) return;
    const sk_ = rc + '|' + name;
    const st = students[sk_] || (students[sk_] = { name: name, c: rc });
    const ph = st[phase === '後測' ? 'post' : 'pre'] || (st[phase === '後測' ? 'post' : 'pre'] = { time: '', total: 0, right: 0, heard: 0, heardRight: 0, skills: {}, wrong: [] });
    ph.time = r[0] instanceof Date ? r[0].toISOString() : String(r[0]);
    const ok = r[9] === '對', heard = r[11] === '有聽', skill = String(r[5]);
    ph.total++; if (ok) ph.right++; if (heard) { ph.heard++; if (ok) ph.heardRight++; }
    const sk = ph.skills[skill] || (ph.skills[skill] = { n: 0, right: 0, heardRight: 0 });
    sk.n++; if (ok) { sk.right++; if (heard) sk.heardRight++; }
    if (!ok) ph.wrong.push({ w: String(r[7]), zy: String(r[8]), skill: skill, pick: String(r[10]) });
  });
  const list = Object.keys(students).map(function (k) { return students[k]; })
    .sort(function (a, b) { return a.name.localeCompare(b.name, 'zh-Hant'); });
  const cls = c && c !== 'all' && c !== '_none' ? findClass_(c) : null;
  return { ok: true, phase: cls ? cls.diagPhase : getDiagPhase_(), students: list, classes: classNames_(), updated: new Date().toISOString() };
}

// ===== 班級（存在「班級設定」工作表，老師也可以直接在試算表裡看） =====
function classSheet_() { return sheet_(CLASS_SHEET, CLASS_HEADER); }

function classes_() {
  const sh = classSheet_();
  const n = sh.getLastRow();
  if (n < 2) return [];
  return sh.getRange(2, 1, n - 1, 5).getValues().map(function (r, i) {
    return {
      row: i + 2, id: String(r[0]), name: String(r[1]), onlyClass: r[2] === true || r[2] === '是',
      diagPhase: ['前測', '後測', '關閉'].indexOf(String(r[3])) >= 0 ? String(r[3]) : '前測',
      words: String(r[4] || '').split('\n').map(function (x) { return x.trim(); }).filter(String)
    };
  }).filter(function (c) { return c.id; });
}
function findClass_(id) { return classes_().filter(function (c) { return c.id === String(id); })[0] || null; }
function classNames_() { const o = {}; classes_().forEach(function (c) { o[c.id] = c.name; }); return o; }

// c = 'all' 全部班級、'_none' 未分班、其他是班級代碼
function inClass_(c, rowClass) {
  const rc = String(rowClass || '');
  if (!c || c === 'all') return true;
  if (c === '_none') return rc === '';
  return rc === String(c);
}

function addClass_(name) {
  name = safe_(String(name || '').trim(), 30);
  if (!name) return { ok: false, error: '請輸入班級名稱' };
  const sh = classSheet_();
  const ids = classes_().map(function (c) { return c.id; });
  let id;
  do { id = Math.random().toString(36).slice(2, 8); } while (ids.indexOf(id) >= 0 || !/^[a-z]/.test(id));
  sh.appendRow([id, name, '否', '前測', '']);
  ensureClassViews_();
  return { ok: true, id: id };
}

function updateClass_(id, ch) {
  const c = findClass_(id);
  if (!c) return { ok: false, error: '找不到這個班級' };
  const sh = classSheet_();
  if ('name' in ch) { const nm = safe_(String(ch.name || '').trim(), 30); if (nm) sh.getRange(c.row, 2).setValue(nm); }
  if ('onlyClass' in ch) sh.getRange(c.row, 3).setValue(ch.onlyClass ? '是' : '否');
  if ('diagPhase' in ch) sh.getRange(c.row, 4).setValue(ch.diagPhase);
  if ('words' in ch) sh.getRange(c.row, 5).setValue(ch.words.map(function (w) { return safe_(w, 60); }).join('\n'));
  if ('name' in ch) ensureClassViews_();
  return { ok: true };
}

function deleteClass_(id) {
  const c = findClass_(id);
  if (c) classSheet_().deleteRow(c.row);
  ensureClassViews_();
  return { ok: true };   // 作答紀錄不會刪除，只是不再列出這個班級
}

// 把某位學生的紀錄（練習＋前後測）從一個班級移到另一個班級，例如把「未分班」的舊資料分到正確的班級
function moveStudent_(name, from, to) {
  name = String(name || '');
  if (!name || !to || !findClass_(to)) return { ok: false, error: '找不到要移過去的班級' };
  let moved = 0;
  [[LOG_SHEET, 2, 9], [DIAG_SHEET, 2, 13]].forEach(function (cfg) {
    const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(cfg[0]);
    if (!sh || sh.getLastRow() < 2) return;
    const n = sh.getLastRow() - 1;
    const names = sh.getRange(2, cfg[1], n, 1).getValues();
    const cls = sh.getRange(2, cfg[2], n, 1).getValues();
    let changed = false;
    for (let i = 0; i < n; i++) {
      if (String(names[i][0]) === name && String(cls[i][0] || '') === String(from)) { cls[i][0] = to; moved++; changed = true; }
    }
    if (changed) sh.getRange(2, cfg[2], n, 1).setValues(cls);
  });
  return { ok: true, moved: moved };
}

// ===== 試算表裡每班的檢視工作表（自動跟著「作答紀錄」「診斷紀錄」更新，只能看、改了也不影響原始資料） =====
function viewSheetName_(name, kind) {
  return (String(name).replace(/[\[\]\*\?\/\\:']/g, '').trim() || '班級').slice(0, 80) + (kind === 'p' ? ' 練習' : ' 前後測');
}
function ensureClassViews_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  sheet_(LOG_SHEET, ['時間', '姓名', '題型', '詞語', '注音', '結果', '學生選的答案', '作答前有聽']);
  const dsh = sheet_(DIAG_SHEET, DIAG_HEADER);
  if (dsh.getRange(1, 13).getValue() === '') dsh.getRange(1, 13).setValue('班級代碼');
  const lsh = ss.getSheetByName(LOG_SHEET);
  if (lsh.getRange(1, 9).getValue() === '') lsh.getRange(1, 9).setValue('班級代碼');
  const props = PropertiesService.getScriptProperties();
  let views = {};
  try { views = JSON.parse(props.getProperty('classViews') || '{}'); } catch (e) {}
  const cls = classes_();
  const keep = {};
  cls.forEach(function (c) {
    const want = { p: viewSheetName_(c.name, 'p'), d: viewSheetName_(c.name, 'd') };
    const had = views[c.id] || {};
    ['p', 'd'].forEach(function (k) {
      let sh = had[k] ? ss.getSheetByName(had[k]) : null;
      if (sh && had[k] !== want[k] && !ss.getSheetByName(want[k])) sh.setName(want[k]);
      if (!sh) sh = ss.getSheetByName(want[k]);
      if (!sh) {
        try { sh = ss.insertSheet(want[k]); } catch (e) { sh = ss.getSheetByName(want[k]); }
        if (!sh) return;
      }
      const f = k === 'p'
        ? '=QUERY(\'' + LOG_SHEET + '\'!A:I,"select A,B,C,D,E,F,G,H where I = \'' + c.id + '\'",1)'
        : '=QUERY(\'' + DIAG_SHEET + '\'!A:M,"select A,B,C,D,E,F,G,H,I,J,K,L where M = \'' + c.id + '\'",1)';
      if (sh.getRange(1, 1).getFormula() !== f) { sh.clear(); sh.getRange(1, 1).setFormula(f); sh.setFrozenRows(1); }
      sh.setTabColor(k === 'p' ? '#1f62b0' : '#0f766e');
      want[k] = sh.getName();
    });
    keep[c.id] = want;
  });
  // 刪除已經不存在的班級的檢視工作表
  Object.keys(views).forEach(function (id) {
    if (keep[id]) return;
    ['p', 'd'].forEach(function (k) { const sh = views[id][k] && ss.getSheetByName(views[id][k]); if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh); });
  });
  props.setProperty('classViews', JSON.stringify(keep));
}
