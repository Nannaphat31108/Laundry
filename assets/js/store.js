/* ==========================================================================
   Store: ข้อมูลทั้งหมดเก็บใน localStorage (คีย์และโครงสร้างเดียวกับระบบเดิม
   จึงนำไฟล์สำรองจากระบบเดิมมากู้คืนได้ทันที)
   ========================================================================== */
'use strict';

const KEY = 'laundry_v1';
const UNITS = ['ชิ้น', 'กก.'];
const PKG_TYPES = ['รายเดือน', 'รายวัน', 'อื่นๆ'];
const CAT_IN = ['ค่าบริการซักรีด', 'ค่าแพ็คเกจ', 'อื่นๆ'];
const CAT_OUT = ['ค่าน้ำยา/อุปกรณ์', 'ค่าน้ำ-ไฟ', 'ค่าเช่า', 'ค่าแรง', 'อื่นๆ'];
const TH_MONTHS = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
const TH_MONTHS_FULL = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
const TH_DAYS = ['อาทิตย์', 'จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์'];

function defaultDb() {
  return {
    shop: { name: 'ร้านซักรีด', phone: '', addr: '', logo: '', qr: '', tax: '', foot: 'ขอบคุณที่ใช้บริการ' },
    garments: [
      ['เสื้อ', 'ชิ้น', 20], ['เสื้อโปโล', 'ชิ้น', 25], ['กางเกงขาสั้น', 'ชิ้น', 20], ['กางเกงขายาว', 'ชิ้น', 25],
      ['ผ้ารีด', 'ชิ้น', 10], ['ซักรีด', 'ชิ้น', 30], ['ซักพับ', 'กก.', 40], ['ซักแห้ง', 'ชิ้น', 80], ['เครื่องนอน', 'ชิ้น', 150]
    ].map((a, i) => ({ id: 'g' + i, name: a[0], unit: a[1], price: a[2] })),
    packages: [{ id: 'p1', name: 'รายเดือน 50 ชิ้น', type: 'รายเดือน', pieces: 50, price: 700, days: 30 }],
    customers: [], orders: [], ledger: [], rc: [], seq: 0
  };
}

/** เติมฟิลด์ที่ขาด เพื่อให้ข้อมูลจากเวอร์ชันเก่า/ไฟล์สำรองใช้งานได้ */
function migrate(d) {
  const base = defaultDb();
  d = d && typeof d === 'object' ? d : base;
  d.shop = Object.assign({}, base.shop, d.shop || {});
  ['garments', 'packages', 'customers', 'orders', 'ledger', 'rc'].forEach(k => { if (!Array.isArray(d[k])) d[k] = k === 'garments' || k === 'packages' ? base[k] : []; });
  d.seq = +d.seq || 0;
  d.garments.forEach(g => { if (!g.unit) g.unit = 'ชิ้น'; g.price = +g.price || 0; });
  d.customers.forEach(c => { if (c.line == null) c.line = ''; if (c.phone == null) c.phone = ''; });
  return d;
}

let db;
try { db = JSON.parse(localStorage.getItem(KEY)); } catch (e) { db = null; }
db = migrate(db);

function save() {
  try { localStorage.setItem(KEY, JSON.stringify(db)); return true; }
  catch (e) { toast('บันทึกไม่ได้ พื้นที่จัดเก็บเต็มหรือถูกบล็อก', 'error'); return false; }
}

/* ---------- utils ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const uid = () => Math.random().toString(36).slice(2, 9);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const ld = d => { d = d || new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const today = () => ld();
const addDays = n => { const d = new Date(); d.setDate(d.getDate() + n); return ld(d); };
const parseD = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const daysBetween = (a, b) => Math.round((parseD(b) - parseD(a)) / 864e5);
const fm = n => Number(n || 0).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const money = n => '฿' + fm(n);

/** 2026-10-02 → 2 ต.ค. 2569 */
const dTh = s => { if (!s) return '-'; const [y, m, d] = s.split('-'); return `${+d} ${TH_MONTHS[+m - 1]} ${+y + 543}`; };
/** 2026-10-02 → 02/10/2569 */
const dSlash = s => { if (!s) return '-'; const [y, m, d] = s.split('-'); return `${d}/${m}/${+y + 543}`; };
const dLong = (d = new Date()) => `วัน${TH_DAYS[d.getDay()]}ที่ ${d.getDate()} ${TH_MONTHS_FULL[d.getMonth()]} ${d.getFullYear() + 543}`;
const monthLabel = k => TH_MONTHS[+k.slice(5, 7) - 1] + ' ' + String(+k.slice(0, 4) + 543).slice(2);

const initials = name => {
  const s = String(name || '?').trim().replace(/^(คุณ|นาย|นาง|นางสาว|น\.ส\.)\s*/, '');
  const ch = Array.from(s.replace(/[ัิ-ฺ็-๎]/g, ''));
  return (ch[0] || '?').toUpperCase();
};
const AVATAR_TONES = ['indigo', 'pink', 'cyan', 'amber', 'green', 'violet', 'rose', 'sky'];
const avatarTone = id => { let h = 0; for (const c of String(id)) h = (h * 31 + c.charCodeAt(0)) >>> 0; return AVATAR_TONES[h % AVATAR_TONES.length]; };

/* ---------- domain ---------- */
const cust = id => db.customers.find(c => c.id == id);
const pkgById = id => db.packages.find(p => p.id == id);
const active = c => !!(c && c.pkgId && c.left > 0 && c.exp >= today());
/** ยอดชิ้นที่ใช้เกินแพ็คเกจ รอหักจากแพ็คเกจถัดไป */
const owedOf = c => (c && c.pkgId && c.left < 0 ? -c.left : 0);
/** แสดงยอดคงเหลือ: ติดลบ = เกินแพ็คเกจ รอหักจากแพ็คเกจถัดไป */
const pcs = n => (n < 0 ? `เกิน ${-n} ชิ้น` : `${n} ชิ้น`);
const needsFollow = c => c.pkgId && (c.left <= 5 || c.exp <= addDays(3));

/** สถานะแพ็คเกจของลูกค้า สำหรับป้ายสถานะ */
function pkgStatus(c) {
  if (!c.pkgId) return { key: 'none', label: 'ไม่มีแพ็คเกจ', tone: 'neutral' };
  if (c.left < 0) return { key: 'owed', label: 'เกิน ' + (-c.left) + ' ชิ้น', tone: 'danger' };
  if (c.exp < today()) return { key: 'expired', label: 'หมดอายุ', tone: 'danger' };
  if (c.left <= 0) return { key: 'empty', label: 'ใช้ครบแล้ว', tone: 'danger' };
  if (c.left <= 5 || c.exp <= addDays(3)) return { key: 'low', label: 'ใกล้หมด', tone: 'warning' };
  return { key: 'active', label: 'ใช้งานอยู่', tone: 'success' };
}

function mkRc(r) {
  r.no = 'R' + today().replace(/-/g, '').slice(2) + '-' + String(++db.seq).padStart(3, '0');
  r.date = today();
  r.time = new Date().toTimeString().slice(0, 5);
  db.rc.push(r);
  return r;
}
const rcByNo = no => db.rc.find(r => r.no == no);

function sumBy(list, fn) { return list.reduce((a, x) => a + (+fn(x) || 0), 0); }

/** สรุปบัญชีในช่วงวันที่ (รายเดือน + หมวดหมู่) */
function ledgerStats(from, to) {
  const l = db.ledger.filter(x => x.date >= from && x.date <= to), ms = {}, ci = {}, co = {};
  let y = +from.slice(0, 4), m = +from.slice(5, 7);
  const ey = +to.slice(0, 4), em = +to.slice(5, 7);
  while (y < ey || (y == ey && m <= em)) { ms[y + '-' + String(m).padStart(2, '0')] = { i: 0, o: 0 }; if (++m > 12) { m = 1; y++; } }
  l.forEach(x => {
    const k = x.date.slice(0, 7);
    if (ms[k]) ms[k][x.type == 'in' ? 'i' : 'o'] += x.amt;
    const c = x.type == 'in' ? ci : co, n = x.cat || 'อื่นๆ';
    c[n] = (c[n] || 0) + x.amt;
  });
  return { l, ms, ci, co };
}

/** ช่วงวันที่ด่วน: n เดือนล่าสุดนับรวมเดือนนี้ */
function monthRange(n) {
  const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - (n - 1));
  return [ld(d), today()];
}

/* ---------- registry (ใช้ร่วมกันทุกไฟล์) ---------- */
const V = {};    // views: V[key] = { render(), mount?() }
const ACT = {};  // actions: data-act / data-input / data-change → ACT[name](el, event)
const state = {
  route: 'home',
  from: today().slice(0, 8) + '01', to: today(),
  cart: {}, sel: '', over: 'carry',
  q: '', custFilter: 'all', rcQ: '', ledFilter: 'all', ledLimit: 50, rcLimit: 50
};
