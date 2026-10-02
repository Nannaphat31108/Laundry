/* ==========================================================================
   App shell: เมนู, การนำทาง (hash router), event delegation
   ========================================================================== */
'use strict';

const TABS = [
  { k: 'home', l: 'หน้าหลัก', ic: 'home', g: 'ภาพรวม' },
  { k: 'order', l: 'รับผ้า / คิดเงิน', short: 'รับผ้า', ic: 'washer', g: 'ภาพรวม' },
  { k: 'cust', l: 'ลูกค้า', ic: 'users', g: 'จัดการร้าน' },
  { k: 'pkg', l: 'แพ็คเกจ', ic: 'package', g: 'จัดการร้าน' },
  { k: 'rc', l: 'ใบเสร็จ', ic: 'receipt', g: 'จัดการร้าน' },
  { k: 'acct', l: 'บัญชี', ic: 'wallet', g: 'การเงิน' },
  { k: 'set', l: 'ตั้งค่าร้าน', ic: 'settings', g: 'การเงิน' }
];
const MOBILE_TABS = ['home', 'cust', 'order', 'rc', 'more'];

function brandMark(sz = '') {
  return db.shop.logo
    ? `<img class="brand-logo ${sz}" src="${db.shop.logo}" alt="">`
    : `<span class="brand-mark ${sz}">${icon('bubbles')}</span>`;
}

function backupAge() {
  if (!db.lastBackup) return null;
  return daysBetween(db.lastBackup, today());
}

function renderSidebar() {
  const follow = db.customers.filter(needsFollow).length;
  let g = '', nav = '';
  TABS.forEach(t => {
    if (t.g !== g) { g = t.g; nav += `<div class="nav-group">${g}</div>`; }
    const count = t.k === 'cust' && follow ? `<span class="nav-count" title="ต้องติดตาม">${follow}</span>` : '';
    nav += `<a href="#/${t.k}" class="nav-item ${state.route === t.k ? 'on' : ''}" ${state.route === t.k ? 'aria-current="page"' : ''} title="${t.l}">
      <span class="nav-ic">${icon(t.ic)}</span><span class="nav-label">${t.l}</span>${count}</a>`;
  });
  const age = backupAge();
  const warn = age == null || age > 7;
  $('#sidebar').innerHTML = `
    <a class="brand" href="#/home">${brandMark()}<span class="brand-text"><b>${esc(db.shop.name)}</b><small>ระบบจัดการร้านซักรีด</small></span></a>
    <nav class="nav">${nav}</nav>
    <div class="side-foot">
      <div class="backup-card ${warn ? 'warn' : ''}">
        <span class="backup-ic">${icon(warn ? 'alert' : 'shield')}</span>
        <div><b>${warn ? 'ควรสำรองข้อมูล' : 'ข้อมูลปลอดภัย'}</b><small>${age == null ? 'ยังไม่เคยสำรองข้อมูล' : age === 0 ? 'สำรองล่าสุดวันนี้' : 'สำรองล่าสุด ' + age + ' วันก่อน'}</small></div>
        <button class="icon-btn sm" data-act="backup" title="ดาวน์โหลดไฟล์สำรอง" aria-label="ดาวน์โหลดไฟล์สำรอง">${icon('download')}</button>
      </div>
    </div>`;
}

function renderTopbar() {
  const t = TABS.find(x => x.k === state.route) || TABS[0];
  const h = new Date().getHours();
  $('#topbar').innerHTML = `
    <a class="top-brand" href="#/home">${brandMark('sm')}<b>${esc(db.shop.name)}</b></a>
    <div class="crumbs"><span>${esc(db.shop.name)}</span>${icon('chevronRight')}<b>${t.l}</b></div>
    <div class="top-right">
      <span class="date-pill">${icon(h >= 18 || h < 6 ? 'moon' : 'sun')}<span>${dLong()}</span></span>
      ${state.route !== 'order' ? `<a class="btn btn-primary btn-sm top-cta" href="#/order">${icon('plus')}รับผ้าใหม่</a>` : ''}
    </div>`;
}

function renderBottomNav() {
  const more = ['pkg', 'acct', 'set'].includes(state.route);
  $('#bottom-nav').innerHTML = MOBILE_TABS.map(k => {
    if (k === 'more') return `<button class="bn-item ${more ? 'on' : ''}" data-act="moreMenu">${icon('grid')}<span>เพิ่มเติม</span></button>`;
    const t = TABS.find(x => x.k === k);
    if (k === 'order') return `<a class="bn-fab ${state.route === k ? 'on' : ''}" href="#/order" aria-label="${t.l}"><span>${icon('plus')}</span><em>รับผ้า</em></a>`;
    return `<a class="bn-item ${state.route === k ? 'on' : ''}" href="#/${k}">${icon(t.ic)}<span>${t.short || t.l}</span></a>`;
  }).join('');
}

ACT.moreMenu = () => {
  const m = openModal({
    title: 'เมนูเพิ่มเติม', ic: 'grid', size: 'sm', cls: 'sheet',
    body: `<div class="more-grid">${TABS.map(t => `<a href="#/${t.k}" class="more-item ${state.route === t.k ? 'on' : ''}" data-close><span class="nav-ic">${icon(t.ic)}</span>${t.l}</a>`).join('')}</div>`
  });
  return m;
};

let lastRoute = null;
function render() {
  if (lastRoute !== state.route) { state.ledLimit = 50; state.rcLimit = 50; }
  renderSidebar(); renderTopbar(); renderBottomNav();
  const v = V[state.route] || V.home;
  const main = $('#main');
  main.innerHTML = `<div class="page page-${state.route}">${v.render()}</div>`;
  v.mount && v.mount();
  if (lastRoute !== state.route) { main.scrollTop = 0; window.scrollTo(0, 0); lastRoute = state.route; }
  document.title = `${(TABS.find(t => t.k === state.route) || TABS[0]).l} · ${db.shop.name}`;
}
/** เรนเดอร์เฉพาะเนื้อหาบางส่วน โดยไม่ทำให้ช่องค้นหาเสีย focus */
function renderPart(sel, html) { const el = $(sel); if (el) el.innerHTML = html; }

function go(k) { if (location.hash !== '#/' + k) location.hash = '#/' + k; else { state.route = k; render(); } }
function route() {
  const k = (location.hash.match(/^#\/(\w+)/) || [])[1];
  state.route = V[k] ? k : 'home';
  render();
}
window.addEventListener('hashchange', route);

/* ---------- event delegation ---------- */
document.addEventListener('click', e => {
  const t = e.target.closest('[data-act]');
  if (!t || t.disabled) return;
  const fn = ACT[t.dataset.act];
  if (fn) fn(t, e);
});
['input', 'change'].forEach(type => document.addEventListener(type, e => {
  const t = e.target.closest(`[data-${type}]`);
  if (!t) return;
  const fn = ACT[t.dataset[type]];
  if (fn) fn(t, e);
}));

/* ---------- ตัวกรองช่วงวันที่ (ใช้หลายหน้า) ---------- */
ACT.range = el => { [state.from, state.to] = monthRange(+el.dataset.n); render(); };
ACT.setFrom = el => { if (el.value) { state.from = el.value; if (state.from > state.to) state.to = state.from; render(); } };
ACT.setTo = el => { if (el.value) { state.to = el.value; if (state.to < state.from) state.from = state.to; render(); } };
ACT.go = el => go(el.dataset.to);
ACT.reprint = el => showRc(rcByNo(el.dataset.no));
ACT.voidRc = el => voidRc(el.dataset.no);
ACT.delRc = el => delRc(el.dataset.no);

/* ---------- init ---------- */
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ }
