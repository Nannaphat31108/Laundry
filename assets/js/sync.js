/* ==========================================================================
   ซิงค์ข้อมูลหลายเครื่อง (Firebase Realtime Database ผ่าน REST + EventSource)
   - ทุกครั้งที่บันทึก จะส่งเฉพาะส่วนที่เปลี่ยน (ลูกค้า/ใบเสร็จ/บัญชี ทีละรายการ)
   - รับการเปลี่ยนแปลงจากเครื่องอื่นแบบเรียลไทม์
   - ออฟไลน์ได้: เก็บคิวไว้ แล้วส่งเมื่อกลับมาออนไลน์
   การตั้งค่าซิงค์ (ที่อยู่ฐานข้อมูล + รหัสร้าน) เก็บแยกในแต่ละเครื่อง
   ========================================================================== */
'use strict';

const SYNC_KEY = 'laundry_sync', SYNC_PENDING = 'laundry_sync_pending';
const SYNC_TOPS = ['shop', 'cfg', 'cats', 'pkgTypes', 'admin', 'seq', 'lastBackup'];
const SYNC_ORDERED = ['groups', 'garments', 'packages', 'customers'];
const SYNC_COLLS = SYNC_ORDERED.concat(['rc', 'ledger']);

const sync = { es: null, mirror: null, lastFlat: null, pending: {}, inflight: false, status: 'off', lastAt: 0, retry: null, applyT: null, needRender: false };

function syncCfg() { try { return JSON.parse(localStorage.getItem(SYNC_KEY)) || {}; } catch (e) { return {}; } }
function syncCfgSave(c) { try { localStorage.setItem(SYNC_KEY, JSON.stringify(c)); } catch (e) { /* ignore */ } }
const syncOn = () => { const c = syncCfg(); return !!(c.on && c.url && c.key); };
const syncBase = () => { const c = syncCfg(); return `${c.url}/shops/${c.key}`; };
const safeKey = k => String(k).replace(/[.#$\[\]\/]/g, '_');

/* ---------- แปลงข้อมูล ⇄ โครงสร้างบนคลาวด์ ---------- */
function packDb(d) {
  const o = {};
  SYNC_TOPS.forEach(k => { o[k] = d[k] === undefined ? null : d[k]; });
  SYNC_ORDERED.forEach(c => { o[c] = {}; (d[c] || []).forEach((x, i) => { o[c][safeKey(x.id)] = Object.assign({}, x, { ord: i }); }); });
  o.rc = {}; (d.rc || []).forEach(r => { o.rc[safeKey(r.id || r.no)] = r; });
  o.ledger = {}; (d.ledger || []).forEach(x => { o.ledger[safeKey(x.id)] = x; });
  return JSON.parse(JSON.stringify(o));
}
function unpackDb(m) {
  m = m || {};
  const d = {};
  SYNC_TOPS.forEach(k => { if (m[k] != null) d[k] = m[k]; });
  const vals = o => Object.values(o || {}).filter(Boolean);
  SYNC_ORDERED.forEach(c => { d[c] = vals(m[c]).sort((a, b) => (a.ord ?? 0) - (b.ord ?? 0)).map(x => { const y = Object.assign({}, x); delete y.ord; return y; }); });
  d.rc = vals(m.rc).sort((a, b) => (a.date + (a.time || '') + a.no).localeCompare(b.date + (b.time || '') + b.no));
  d.ledger = vals(m.ledger);
  d.orders = [];
  d.seq = +d.seq || 0;
  return migrate(d);
}
function flatOf(p) {
  const m = {};
  SYNC_TOPS.forEach(k => { m[k] = JSON.stringify(p[k] ?? null); });
  SYNC_COLLS.forEach(c => Object.entries(p[c] || {}).forEach(([id, v]) => { m[c + '/' + id] = JSON.stringify(v); }));
  return m;
}
function setPath(obj, path, val) {
  const parts = path.split('/').filter(Boolean);
  if (!parts.length) return val;
  let o = obj;
  for (let i = 0; i < parts.length - 1; i++) { if (o[parts[i]] == null || typeof o[parts[i]] !== 'object') o[parts[i]] = {}; o = o[parts[i]]; }
  const last = parts[parts.length - 1];
  if (val === null) delete o[last]; else o[last] = val;
  return obj;
}

/* ---------- ส่งข้อมูลขึ้น ---------- */
function syncLoadPending() { try { sync.pending = JSON.parse(localStorage.getItem(SYNC_PENDING)) || {}; } catch (e) { sync.pending = {}; } }
function syncSavePending() { try { localStorage.setItem(SYNC_PENDING, JSON.stringify(sync.pending)); } catch (e) { /* ignore */ } }

/** เรียกทุกครั้งหลัง save(): หาเฉพาะส่วนที่เปลี่ยนแล้วส่งขึ้นคลาวด์ */
function syncPush() {
  if (!syncOn() || !sync.lastFlat) return;
  const nf = flatOf(packDb(db)), up = {};
  for (const k in nf) if (nf[k] !== sync.lastFlat[k]) up[k] = JSON.parse(nf[k]);
  for (const k in sync.lastFlat) if (!(k in nf)) up[k] = null;
  sync.lastFlat = nf;
  if (!Object.keys(up).length) return;
  Object.assign(sync.pending, up);
  syncSavePending();
  if (sync.mirror) for (const k in up) setPath(sync.mirror, k, up[k]);
  syncFlush();
}

async function syncFlush() {
  if (!syncOn() || sync.inflight || !Object.keys(sync.pending).length) return syncStatus();
  sync.inflight = true;
  const body = Object.assign({}, sync.pending);
  syncStatus('saving');
  try {
    const res = await fetch(syncBase() + '.json', { method: 'PATCH', body: JSON.stringify(body) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    for (const k in body) if (JSON.stringify(sync.pending[k]) === JSON.stringify(body[k])) delete sync.pending[k];
    syncSavePending();
    sync.lastAt = Date.now();
  } catch (e) {
    clearTimeout(sync.retry);
    sync.retry = setTimeout(syncFlush, 8000);
    sync.inflight = false;
    return syncStatus('offline');
  }
  sync.inflight = false;
  if (Object.keys(sync.pending).length) syncFlush(); else syncStatus('ok');
}

/* ---------- รับข้อมูลจากเครื่องอื่น ---------- */
function syncOnEvent(type, ev) {
  let msg; try { msg = JSON.parse(ev.data); } catch (e) { return; }
  if (!msg) return;
  const { path, data } = msg;
  if (type === 'put' && path === '/') {
    if (data == null) { syncUploadAll(); return; }          // ข้อมูลบนคลาวด์หายไป: อัปโหลดจากเครื่องนี้คืน
    sync.mirror = data;
    for (const k in sync.pending) setPath(sync.mirror, k, sync.pending[k]); // งานที่ยังไม่ได้ส่ง (ออฟไลน์)
  } else if (sync.mirror) {
    if (type === 'put') setPath(sync.mirror, path, data);
    else if (type === 'patch') for (const k in data) setPath(sync.mirror, path.replace(/\/$/, '') + '/' + k, data[k]);
  }
  sync.lastAt = Date.now();
  if (!sync.inflight) syncStatus(Object.keys(sync.pending).length ? 'saving' : 'ok');
  clearTimeout(sync.applyT);
  sync.applyT = setTimeout(syncApplyMirror, 120);
}

function syncApplyMirror() {
  if (!sync.mirror) return;
  const nd = unpackDb(sync.mirror), nf = flatOf(packDb(nd));
  const changed = !sync.lastFlat || Object.keys(nf).length !== Object.keys(sync.lastFlat).length || Object.keys(nf).some(k => nf[k] !== sync.lastFlat[k]);
  sync.lastFlat = nf;
  if (!changed) return;
  db = nd;
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  // ไม่รีเฟรชหน้าขณะกำลังพิมพ์ เพื่อไม่ให้ช่องกรอกหลุด
  const a = document.activeElement;
  if (a && a.matches && a.matches('#main input, #main textarea, #main select, .modal input, .modal textarea, .modal select') || modalStack.length) sync.needRender = true;
  else render();
}
document.addEventListener('focusout', () => setTimeout(() => {
  if (sync.needRender && !modalStack.length && !(document.activeElement && document.activeElement.matches('input, textarea, select'))) { sync.needRender = false; render(); }
}, 200));
setInterval(() => { if (sync.needRender && !modalStack.length && !(document.activeElement && document.activeElement.matches && document.activeElement.matches('input, textarea, select'))) { sync.needRender = false; render(); } }, 3000);

async function syncUploadAll() {
  const res = await fetch(syncBase() + '.json', { method: 'PUT', body: JSON.stringify(packDb(db)) });
  if (!res.ok) throw new Error('HTTP ' + res.status);
  sync.lastFlat = flatOf(packDb(db));
  sync.pending = {}; syncSavePending();
}

function syncStart() {
  syncStop();
  if (!syncOn()) return syncStatus('off');
  syncLoadPending();
  sync.lastFlat = flatOf(packDb(db));
  syncStatus('connecting');
  try {
    const es = new EventSource(syncBase() + '.json');
    sync.es = es;
    es.addEventListener('put', e => syncOnEvent('put', e));
    es.addEventListener('patch', e => syncOnEvent('patch', e));
    es.addEventListener('keep-alive', () => { sync.lastAt = Date.now(); });
    es.addEventListener('cancel', () => { syncStatus('denied'); });
    es.onopen = () => { syncFlush(); };
    es.onerror = () => { if (sync.status !== 'denied') syncStatus('offline'); };
  } catch (e) { syncStatus('offline'); }
  syncFlush();
}
function syncStop() { if (sync.es) { sync.es.close(); sync.es = null; } sync.mirror = null; }
window.addEventListener('online', () => { if (syncOn()) { syncStart(); } });

/* ---------- สถานะ ---------- */
const SYNC_TXT = {
  off: ['ยังไม่ได้เชื่อมต่อหลายเครื่อง', 'neutral'], connecting: ['กำลังเชื่อมต่อ…', 'warning'], ok: ['ซิงค์แล้ว', 'success'],
  saving: ['กำลังบันทึกขึ้นคลาวด์…', 'warning'], offline: ['ออฟไลน์ — จะส่งข้อมูลเมื่อกลับมาออนไลน์', 'danger'], denied: ['ฐานข้อมูลไม่อนุญาต — ตรวจกฎ (Rules)', 'danger']
};
function syncStatus(s) {
  if (s) sync.status = s;
  const chip = $('#sync-chip');
  if (chip) chip.outerHTML = syncChip();
  const box = $('#sync-state');
  if (box) box.innerHTML = syncStateHTML();
}
function syncChip() {
  if (!syncOn()) return '<span id="sync-chip" hidden></span>';
  const n = Object.keys(sync.pending).length, [txt, tone] = SYNC_TXT[sync.status] || SYNC_TXT.off;
  return `<button id="sync-chip" class="admin-chip sync-chip s-${tone}" data-act="syncInfo" title="${txt}">${icon('cloud')}<span>${sync.status === 'ok' ? 'ซิงค์แล้ว' : sync.status === 'offline' ? 'ออฟไลน์' : 'กำลังซิงค์'}</span>${n ? `<em>${n}</em>` : ''}</button>`;
}
function syncStateHTML() {
  const [txt, tone] = SYNC_TXT[sync.status] || SYNC_TXT.off, n = Object.keys(sync.pending).length;
  return `${badge(txt, tone)}${n ? `<span class="muted small">รอส่ง ${n} รายการ</span>` : ''}${sync.lastAt ? `<span class="muted small">อัปเดตล่าสุด ${new Date(sync.lastAt).toLocaleTimeString('th-TH')}</span>` : ''}`;
}

/* ---------- เชื่อมต่อ / เข้าร่วม ---------- */
function normUrl(u) {
  u = String(u || '').trim().replace(/\/+$/, '').replace(/\.json$/, '');
  if (u && !/^https:\/\//.test(u)) u = 'https://' + u.replace(/^\w+:\/\//, '');
  return u;
}
function newShopKey() {
  const a = new Uint8Array(18); crypto.getRandomValues(a);
  return 'shop' + Array.from(a, b => b.toString(36).padStart(2, '0')).join('').slice(0, 26);
}
function joinCode(c = syncCfg()) { return btoa(unescape(encodeURIComponent(c.url + '|' + c.key))).replace(/=+$/, ''); }
function parseJoin(code) {
  try {
    code = String(code).trim().replace(/^.*#\/join\//, '');
    const [url, key] = decodeURIComponent(escape(atob(code))).split('|');
    if (!/^https:\/\/|^http:\/\/localhost[:/]/.test(url) || !key || key.length < 20) return null;
    return { url, key };
  } catch (e) { return null; }
}
const joinLink = () => location.origin + location.pathname + '#/join/' + joinCode();

async function syncTest(url, key) {
  const res = await fetch(`${url}/shops/${key}.json?shallow=true`);
  if (res.status === 401 || res.status === 403) throw new Error('ฐานข้อมูลไม่อนุญาต — กรุณาวางกฎ (Rules) ตามขั้นตอนที่ 3 แล้วกด Publish');
  if (res.status === 404) throw new Error('ไม่พบฐานข้อมูลนี้ — ตรวจสอบที่อยู่ (URL) อีกครั้ง');
  if (!res.ok) throw new Error('เชื่อมต่อไม่ได้ (HTTP ' + res.status + ')');
  return res.json();
}

/** เครื่องแรก: สร้างร้านบนคลาวด์ แล้วอัปโหลดข้อมูลจากเครื่องนี้ */
async function syncCreate(url) {
  url = normUrl(url);
  if (!/^https:\/\/[\w.-]+\.(firebaseio\.com|firebasedatabase\.app)$/.test(url)) throw new Error('ที่อยู่ไม่ถูกต้อง ตัวอย่าง: https://ชื่อโปรเจกต์-default-rtdb.asia-southeast1.firebasedatabase.app');
  const key = newShopKey();
  await syncTest(url, key);
  syncCfgSave({ url, key, on: true, since: Date.now() });
  await syncUploadAll();
  syncStart();
}

/** เครื่องอื่น: เข้าร่วมด้วยลิงก์/รหัส แล้วใช้ข้อมูลจากคลาวด์ */
async function syncJoin(code) {
  const j = parseJoin(code);
  if (!j) throw new Error('รหัสหรือลิงก์เข้าร่วมไม่ถูกต้อง');
  const data = await (await fetch(`${j.url}/shops/${j.key}.json`)).json().catch(() => null);
  if (!data) throw new Error('ไม่พบข้อมูลร้านจากรหัสนี้');
  syncStop();
  db = unpackDb(data);
  try { localStorage.setItem(KEY, JSON.stringify(db)); } catch (e) { /* ignore */ }
  syncCfgSave({ url: j.url, key: j.key, on: true, since: Date.now() });
  sync.pending = {}; syncSavePending();
  state.cart = {}; state.sel = '';
  syncStart();
}

async function syncJoinPrompt(code) {
  const j = parseJoin(code);
  if (!j) return toast('ลิงก์เข้าร่วมไม่ถูกต้อง', 'error');
  if (syncOn() && syncCfg().key === j.key) return toast('เครื่องนี้เชื่อมกับร้านนี้อยู่แล้ว', 'info');
  const ok = await confirmDlg({
    title: 'เชื่อมเครื่องนี้กับข้อมูลร้าน?', tone: 'primary', ic: 'cloud', okText: 'เชื่อมต่อ',
    msg: `<p>เครื่องนี้จะใช้ข้อมูลชุดเดียวกับเครื่องอื่นของร้าน (ลูกค้า ใบเสร็จ บัญชี ราคา)</p>
          <div class="alert alert-warning">${icon('alert')}<div>ข้อมูลที่อยู่ในเครื่องนี้ตอนนี้จะถูก<b>แทนที่</b>ด้วยข้อมูลร้านจากระบบออนไลน์</div></div>`
  });
  if (!ok) return;
  try { await syncJoin(code); render(); toast('เชื่อมต่อเรียบร้อย ข้อมูลตรงกับเครื่องอื่นแล้ว'); }
  catch (e) { toast(e.message || String(e), 'error', 6000); }
}

/* ---------- หน้าตั้งค่า (แท็บในหน้าผู้ดูแลระบบ) ---------- */
const SYNC_RULES = `{
  "rules": {
    "shops": {
      "$shop": {
        ".read": "$shop.length >= 20",
        ".write": "$shop.length >= 20"
      }
    }
  }
}`;

function syncPanel() {
  const c = syncCfg();
  if (syncOn()) {
    return `<section class="card">
        ${secHead('cloud', 'green', 'เชื่อมต่อหลายเครื่องอยู่', 'ทุกเครื่องที่เชื่อมจะเห็นข้อมูลชุดเดียวกันแบบเรียลไทม์')}
        <div class="sync-state" id="sync-state">${syncStateHTML()}</div>
        <h3 class="mini-h">เพิ่มเครื่องอื่น (มือถือ / แท็บเล็ต / คอมพิวเตอร์)</h3>
        <ol class="steps">
          <li>ส่งลิงก์ด้านล่างไปที่เครื่องนั้น (เช่น ส่งทาง LINE ให้ตัวเอง)</li>
          <li>เปิดลิงก์ด้วย <b>Chrome</b> แล้วกด “เชื่อมต่อ”</li>
        </ol>
        <div class="join-box"><input readonly value="${esc(joinLink())}" aria-label="ลิงก์เข้าร่วม" id="join-link"></div>
        <div class="sync-btns">
          <button class="btn btn-soft" data-act="syncCopy">${icon('copy')}คัดลอกลิงก์</button>
          <a class="btn btn-line" href="https://line.me/R/share?text=${encodeURIComponent('ลิงก์เชื่อมเครื่องกับระบบร้าน (อย่าส่งให้คนอื่น): ' + joinLink())}" target="_blank" rel="noopener">${icon('message')}ส่งทาง LINE</a>
        </div>
        <div class="alert alert-warning slim">${icon('shield')}<div>ใครมีลิงก์นี้จะเข้าถึงข้อมูลร้านได้ทั้งหมด — ส่งให้เฉพาะเครื่องของร้านเท่านั้น</div></div>
      </section>
      <section class="card">
        ${secHead('sliders', 'amber', 'จัดการการเชื่อมต่อ', 'ที่อยู่ฐานข้อมูล: ' + esc(c.url))}
        <div class="backup-grid">
          <div class="backup-box"><div><b>ซิงค์ใหม่ทั้งหมด</b><small>ดึงข้อมูลล่าสุดจากคลาวด์มาใหม่</small></div>
            <button class="btn btn-soft" data-act="syncReload">${icon('refresh')}ซิงค์ใหม่</button></div>
          <div class="backup-box"><div><b>เลิกเชื่อมเครื่องนี้</b><small>เครื่องนี้จะเก็บข้อมูลไว้ใช้คนเดียว ไม่กระทบเครื่องอื่น</small></div>
            <button class="btn btn-danger-soft" data-act="syncLeave">${icon('x')}เลิกเชื่อม</button></div>
        </div>
      </section>`;
  }
  return `<section class="card">
      ${secHead('cloud', 'indigo', 'ใช้ข้อมูลเดียวกันหลายเครื่อง', 'ตอนนี้ข้อมูลเก็บแยกในแต่ละเครื่อง — เชื่อมต่อเพื่อให้ทุกเครื่องเห็นข้อมูลชุดเดียวกันแบบเรียลไทม์')}
      <div class="sync-choice">
        <div class="sync-opt">
          <span class="stat-ic tone-indigo">${icon('link')}</span>
          <div><b>มีลิงก์จากเครื่องหลักแล้ว</b><small>วางลิงก์เข้าร่วมเพื่อใช้ข้อมูลร้านเดียวกัน</small></div>
          <form class="join-form" id="join-form"><input placeholder="วางลิงก์เข้าร่วมที่นี่" aria-label="ลิงก์เข้าร่วม"><button class="btn btn-primary" type="submit">${icon('link')}เข้าร่วม</button></form>
        </div>
      </div>
    </section>
    <section class="card">
      ${secHead('database', 'green', 'ตั้งค่าครั้งแรก (ทำที่เครื่องหลักเครื่องเดียว)', 'ใช้ฐานข้อมูลฟรีของ Google (Firebase) · ประมาณ 5 นาที')}
      <ol class="steps big">
        <li>เข้า <a href="https://console.firebase.google.com/" target="_blank" rel="noopener"><b>console.firebase.google.com</b></a> ด้วยบัญชี Google ของร้าน → <b>สร้างโปรเจกต์</b> (ตั้งชื่ออะไรก็ได้ ไม่ต้องเปิด Google Analytics)</li>
        <li>เมนูซ้าย <b>Build → Realtime Database</b> → <b>Create Database</b> → เลือกตำแหน่ง <b>Singapore (asia-southeast1)</b> → เลือก <b>Start in locked mode</b> → Enable</li>
        <li>ไปที่แท็บ <b>Rules</b> ลบของเดิมทั้งหมด แล้ววางข้อความนี้ → กด <b>Publish</b>
          <div class="rules-box"><pre id="rules-text">${esc(SYNC_RULES)}</pre><button class="btn btn-soft btn-sm" data-act="syncCopyRules">${icon('copy')}คัดลอก</button></div></li>
        <li>กลับไปแท็บ <b>Data</b> คัดลอกที่อยู่ด้านบน (ขึ้นต้นด้วย https:// ลงท้ายด้วย firebasedatabase.app) มาวางด้านล่าง</li>
      </ol>
      <form class="join-form" id="create-form"><input placeholder="https://xxxx-default-rtdb.asia-southeast1.firebasedatabase.app" aria-label="ที่อยู่ฐานข้อมูล" inputmode="url"><button class="btn btn-primary" type="submit">${icon('cloud')}เชื่อมต่อและอัปโหลดข้อมูลเครื่องนี้</button></form>
      <div class="alert alert-info slim">${icon('info')}<div>ข้อมูลในเครื่องนี้จะถูกอัปโหลดเป็นข้อมูลตั้งต้นของร้าน จากนั้นส่งลิงก์ให้เครื่องอื่นเข้าร่วม · แพ็กเกจฟรีของ Firebase รองรับร้านซักรีดได้สบาย</div></div>
    </section>`;
}

/* ---------- actions ---------- */
document.addEventListener('submit', async e => {
  const f = e.target;
  if (f.id !== 'join-form' && f.id !== 'create-form') return;
  e.preventDefault();
  const v = f.querySelector('input').value.trim(), btn = f.querySelector('button');
  if (!v) return f.querySelector('input').focus();
  btn.disabled = true;
  try {
    if (f.id === 'join-form') { btn.disabled = false; return syncJoinPrompt(v); }
    await syncCreate(v);
    render(); toast('เชื่อมต่อสำเร็จ อัปโหลดข้อมูลแล้ว — ส่งลิงก์ให้เครื่องอื่นได้เลย');
  } catch (err) { toast(err.message || String(err), 'error', 7000); }
  finally { btn.disabled = false; }
});
ACT.syncCopy = async () => toast(await copyText(joinLink()) ? 'คัดลอกลิงก์แล้ว' : 'คัดลอกไม่สำเร็จ', 'info');
ACT.syncCopyRules = async () => toast(await copyText(SYNC_RULES) ? 'คัดลอกกฎแล้ว นำไปวางในแท็บ Rules' : 'คัดลอกไม่สำเร็จ', 'info');
ACT.syncReload = adminOnly(async () => {
  try {
    const data = await (await fetch(syncBase() + '.json')).json();
    if (data) { sync.mirror = data; for (const k in sync.pending) setPath(sync.mirror, k, sync.pending[k]); syncApplyMirror(); }
    syncStart(); render(); toast('ซิงค์ข้อมูลล่าสุดแล้ว');
  } catch (e) { toast('เชื่อมต่อไม่ได้ ลองใหม่อีกครั้ง', 'error'); }
});
ACT.syncLeave = adminOnly(async () => {
  if (!await confirmDlg({ title: 'เลิกเชื่อมเครื่องนี้?', tone: 'warning', ic: 'cloud', okText: 'เลิกเชื่อม', msg: '<p>เครื่องนี้จะเก็บข้อมูลชุดปัจจุบันไว้ใช้แยก การเปลี่ยนแปลงต่อจากนี้จะไม่ส่งถึงเครื่องอื่น (เชื่อมใหม่ได้ด้วยลิงก์เข้าร่วม)</p>' })) return;
  syncStop(); syncCfgSave({}); sync.pending = {}; syncSavePending(); syncStatus('off');
  render(); toast('เลิกเชื่อมเครื่องนี้แล้ว');
});
ACT.syncInfo = () => {
  const [txt] = SYNC_TXT[sync.status] || SYNC_TXT.off, n = Object.keys(sync.pending).length;
  openModal({
    title: 'ข้อมูลหลายเครื่อง', subtitle: txt, ic: 'cloud', size: 'sm',
    body: `<div class="sync-state">${syncStateHTML()}</div><p class="muted" style="margin-top:12px">${n ? 'มีรายการที่ยังไม่ได้ส่ง ระบบจะส่งให้อัตโนมัติเมื่อออนไลน์' : 'ข้อมูลเครื่องนี้ตรงกับเครื่องอื่นของร้าน'}</p>`,
    footer: `<button class="btn btn-ghost" data-close>ปิด</button><button class="btn btn-primary" data-close data-act="syncNow">${icon('refresh')}ซิงค์ตอนนี้</button>`
  });
};
ACT.syncNow = () => { syncStart(); };
