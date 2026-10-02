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
  { k: 'acct', l: 'บัญชี', ic: 'wallet', g: 'การเงิน & ระบบ' },
  { k: 'prn', l: 'เครื่องพิมพ์', ic: 'printer', g: 'การเงิน & ระบบ' },
  { k: 'set', l: 'ผู้ดูแลระบบ', short: 'แอดมิน', ic: 'shield', g: 'การเงิน & ระบบ' }
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
      ${isStandalone() ? '' : `<button class="install-side" data-act="installApp" title="ติดตั้งเป็นแอป">${icon('download')}<span>ติดตั้งเป็นแอป</span></button>`}
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
      <a class="admin-chip prn-chip" href="#/prn" title="เครื่องพิมพ์">${icon('printer')}<span>เครื่องพิมพ์</span></a>
      ${isAdmin()
        ? `<button class="admin-chip on" data-act="adminLock" title="ล็อกโหมดแอดมิน">${icon('shield')}<span>แอดมิน</span>${icon('lock')}</button>`
        : `<button class="admin-chip" data-act="adminLogin" title="เข้าสู่โหมดแอดมิน">${icon('lock')}<span>แอดมิน</span></button>`}
      <span class="date-pill">${icon(h >= 18 || h < 6 ? 'moon' : 'sun')}<span>${dLong()}</span></span>
      ${state.route !== 'order' ? `<a class="btn btn-primary btn-sm top-cta" href="#/order">${icon('plus')}รับผ้าใหม่</a>` : ''}
    </div>`;
}

function renderBottomNav() {
  const more = ['pkg', 'acct', 'prn', 'set'].includes(state.route);
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
    body: `<div class="more-grid">${TABS.map(t => `<a href="#/${t.k}" class="more-item ${state.route === t.k ? 'on' : ''}" data-close><span class="nav-ic">${icon(t.ic)}</span>${t.l}</a>`).join('')}</div>
      ${isStandalone() ? '' : `<button class="btn btn-soft btn-block install-btn" data-act="installApp" data-close>${icon('download')}ติดตั้งเป็นแอปบนเครื่องนี้</button>`}`
  });
  return m;
};

let lastRoute = null;
function render() {
  document.body.classList.toggle('is-admin', isAdmin());
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
ACT.voidRc = adminOnly(el => voidRc(el.dataset.no));
ACT.delRc = adminOnly(el => delRc(el.dataset.no));

/* ---------- ติดตั้งเป็นแอป (PWA) บนมือถือ/แท็บเล็ต/คอมพิวเตอร์ ---------- */
let installEvt = null;
const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; });
window.addEventListener('appinstalled', () => { installEvt = null; toast('ติดตั้งแอปเรียบร้อย เปิดได้จากหน้าจอหลัก'); render(); });
ACT.installApp = async () => {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice; installEvt = null; if (r.outcome === 'accepted') return; }
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  openModal({
    title: 'ติดตั้งเป็นแอป', subtitle: 'เปิดใช้งานเต็มจอเหมือนแอป ทั้งมือถือและแท็บเล็ต', ic: 'download', size: 'sm',
    body: ios
      ? `<ol class="steps"><li>เปิดหน้านี้ด้วย <b>Safari</b></li><li>แตะปุ่ม <b>แชร์</b> (สี่เหลี่ยมมีลูกศรขึ้น) ด้านล่างหรือมุมขวาบน</li><li>เลือก <b>“เพิ่มไปยังหน้าจอโฮม”</b> แล้วแตะ <b>เพิ่ม</b></li></ol>`
      : `<ol class="steps"><li>เปิดหน้านี้ด้วย <b>Chrome</b> (Android) หรือ Chrome/Edge (คอมพิวเตอร์)</li><li>แตะเมนู <b>⋮</b> มุมขวาบน</li><li>เลือก <b>“ติดตั้งแอป”</b> หรือ <b>“เพิ่มลงในหน้าจอหลัก”</b></li></ol>`,
    footer: '<button class="btn btn-primary" data-close>เข้าใจแล้ว</button>'
  });
};

/* ---------- init ---------- */
route();
if ('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(() => {});
try { navigator.storage && navigator.storage.persist && navigator.storage.persist(); } catch (e) { /* ignore */ }
