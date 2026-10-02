/* ==========================================================================
   โหมดแอดมิน: รหัส PIN, ปลดล็อก/ล็อก, ล็อกอัตโนมัติ
   หมายเหตุ: ทำงานฝั่งเครื่องทั้งหมด จึงเป็นการกันพนักงานแก้ข้อมูลโดยไม่ตั้งใจ
   ไม่ใช่ระบบความปลอดภัยระดับเซิร์ฟเวอร์
   ========================================================================== */
'use strict';

const ADMIN_KEY = 'laundry_admin_until';
let pinFails = 0, pinBlockedUntil = 0;

async function hashPin(pin) {
  const txt = 'laundry-admin:' + pin;
  try {
    if (window.crypto && crypto.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(txt));
      return 's:' + Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
    }
  } catch (e) { /* ใช้วิธีสำรองด้านล่าง */ }
  let h = 2166136261;
  for (const c of txt) { h ^= c.charCodeAt(0); h = Math.imul(h, 16777619) >>> 0; }
  return 'f:' + h.toString(16);
}

const hasPin = () => !!(db.admin && db.admin.pin);
function adminUntil() { try { return +sessionStorage.getItem(ADMIN_KEY) || 0; } catch (e) { return 0; } }
function isAdmin() { return adminUntil() > Date.now(); }
function touchAdmin() {
  if (!isAdmin()) return;
  try { sessionStorage.setItem(ADMIN_KEY, String(Date.now() + (cfg().lockMin || 15) * 6e4)); } catch (e) { /* ignore */ }
}
function unlockAdmin() {
  try { sessionStorage.setItem(ADMIN_KEY, String(Date.now() + (cfg().lockMin || 15) * 6e4)); } catch (e) { /* ignore */ }
  document.body.classList.add('is-admin');
}
function lockAdmin(silent) {
  try { sessionStorage.removeItem(ADMIN_KEY); } catch (e) { /* ignore */ }
  document.body.classList.remove('is-admin');
  if (!silent) { render(); toast('ล็อกโหมดแอดมินแล้ว', 'info'); }
}

/* ล็อกอัตโนมัติเมื่อไม่ได้ใช้งาน */
['pointerdown', 'keydown'].forEach(t => document.addEventListener(t, touchAdmin, true));
setInterval(() => { if (document.body.classList.contains('is-admin') && !isAdmin()) { lockAdmin(true); render(); toast('ล็อกโหมดแอดมินอัตโนมัติ', 'info'); } }, 20000);

/**
 * หน้าต่างกรอกรหัส PIN แบบแป้นตัวเลข
 * mode: 'verify' | 'new' | 'confirm'
 */
function pinPad({ title, subtitle, mode = 'verify' }) {
  return new Promise(res => {
    let val = '', done = false;
    const keys = ['1', '2', '3', '4', '5', '6', '7', '8', '9', 'clear', '0', 'back'];
    const m = openModal({
      size: 'sm', cls: 'modal-pin',
      body: `<div class="pin">
        <span class="pin-ic">${icon(mode === 'verify' ? 'shield' : 'key')}</span>
        <h2>${title}</h2><p>${subtitle || ''}</p>
        <div class="pin-dots" aria-live="polite"></div>
        <div class="pin-err" role="alert"></div>
        <div class="pin-pad">${keys.map(k => `<button type="button" data-k="${k}" class="${k.length > 1 ? 'fn' : ''}" aria-label="${k === 'back' ? 'ลบ' : k === 'clear' ? 'ล้าง' : k}">${k === 'back' ? icon('backspace') : k === 'clear' ? 'ล้าง' : k}</button>`).join('')}</div>
        <button class="btn btn-primary btn-lg btn-block" data-ok disabled>${icon('check')}${mode === 'verify' ? 'ปลดล็อก' : 'ถัดไป'}</button>
      </div>`,
      onClose: () => { document.removeEventListener('keydown', onKey, true); if (!done) res(null); }
    });
    const dots = m.q('.pin-dots'), err = m.q('.pin-err'), ok = m.q('[data-ok]');
    const paint = () => {
      dots.innerHTML = Array.from({ length: Math.max(4, val.length) }, (_, i) => `<i class="${i < val.length ? 'on' : ''}"></i>`).join('');
      ok.disabled = val.length < 4;
    };
    const fail = msg => {
      err.textContent = msg; val = ''; paint();
      const box = m.q('.pin'); box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    };
    const submit = () => {
      if (val.length < 4) return;
      if (Date.now() < pinBlockedUntil) return fail(`กรอกผิดหลายครั้ง กรุณารอ ${Math.ceil((pinBlockedUntil - Date.now()) / 1000)} วินาที`);
      done = true;
      const v = val;
      res({ value: v, fail: msg => { done = false; fail(msg); return new Promise(r2 => { res = r2; }); }, close: () => m.close() });
    };
    const press = k => {
      err.textContent = '';
      if (k === 'back') val = val.slice(0, -1);
      else if (k === 'clear') val = '';
      else if (/^\d$/.test(k) && val.length < 6) val += k;
      paint();
      if (val.length === 6) submit();
    };
    const onKey = e => {
      if (modalStack[modalStack.length - 1] !== m) return;
      if (/^\d$/.test(e.key)) { e.preventDefault(); press(e.key); }
      else if (e.key === 'Backspace') { e.preventDefault(); press('back'); }
      else if (e.key === 'Enter') { e.preventDefault(); submit(); }
    };
    document.addEventListener('keydown', onKey, true);
    m.q('.pin-pad').addEventListener('click', e => { const b = e.target.closest('[data-k]'); if (b) press(b.dataset.k); });
    ok.addEventListener('click', submit);
    paint();
  });
}

/** ตั้งรหัสใหม่ (กรอก 2 ครั้ง) คืนค่า true เมื่อสำเร็จ */
async function setNewPin(first) {
  const a = await pinPad({ title: first ? 'ตั้งรหัสแอดมิน' : 'ตั้งรหัสแอดมินใหม่', subtitle: 'ตัวเลข 4–6 หลัก ใช้ปลดล็อกการแก้ไขข้อมูลสำคัญ', mode: 'new' });
  if (!a) return false;
  a.close();
  let b = await pinPad({ title: 'ยืนยันรหัสอีกครั้ง', subtitle: 'กรอกรหัสเดิมซ้ำเพื่อยืนยัน', mode: 'confirm' });
  while (b && b.value !== a.value) b = await b.fail('รหัสไม่ตรงกัน ลองอีกครั้ง');
  if (!b) return false;
  b.close();
  db.admin.pin = await hashPin(a.value);
  save();
  return true;
}

/** ตรวจสิทธิ์แอดมิน: ถ้ายังไม่ปลดล็อกจะถามรหัส (หรือให้ตั้งรหัสครั้งแรก) */
async function requireAdmin() {
  if (isAdmin()) { touchAdmin(); return true; }
  if (!hasPin()) {
    const ok = await confirmDlg({
      title: 'ตั้งรหัสแอดมินก่อนใช้งาน', tone: 'primary', ic: 'shield', okText: 'ตั้งรหัส',
      msg: '<p>ส่วนนี้สำหรับผู้ดูแลระบบ เช่น แก้ราคา แพ็คเกจ ยอดลูกค้า ยกเลิก/ลบใบเสร็จ</p><p>กรุณาตั้งรหัส PIN เพื่อป้องกันการแก้ไขโดยไม่ตั้งใจ</p>'
    });
    if (!ok || !await setNewPin(true)) return false;
    unlockAdmin(); render(); toast('ตั้งรหัสและเข้าสู่โหมดแอดมินแล้ว');
    return true;
  }
  let r = await pinPad({ title: 'เข้าสู่โหมดแอดมิน', subtitle: 'กรอกรหัส PIN ของผู้ดูแลระบบ' });
  while (r) {
    if (await hashPin(r.value) === db.admin.pin) {
      pinFails = 0; r.close(); unlockAdmin(); render(); toast('เข้าสู่โหมดแอดมินแล้ว');
      return true;
    }
    if (++pinFails >= 5) { pinBlockedUntil = Date.now() + 30000; pinFails = 0; }
    r = await r.fail(Date.now() < pinBlockedUntil ? 'กรอกผิดหลายครั้ง กรุณารอ 30 วินาที' : 'รหัสไม่ถูกต้อง');
  }
  return false;
}

/** ห่อ action ให้ต้องเป็นแอดมินก่อน */
const adminOnly = fn => async (...a) => { if (await requireAdmin()) return fn(...a); };

ACT.adminLogin = () => requireAdmin();
ACT.adminLock = () => lockAdmin();
ACT.changePin = async () => {
  if (!await requireAdmin()) return;
  if (await setNewPin(false)) toast('เปลี่ยนรหัสแอดมินแล้ว');
};

if (isAdmin()) document.body.classList.add('is-admin');
