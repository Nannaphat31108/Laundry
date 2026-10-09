/* ==========================================================================
   ผู้ดูแลระบบ (แอดมิน): แก้ไขได้ทุกอย่างในระบบ
   - ข้อมูลร้าน & ใบเสร็จ   - ราคาต่อชิ้น   - แพ็คเกจ
   - หมวดหมู่ & รายการ       - กฎระบบ       - ข้อมูล & ความปลอดภัย
   ========================================================================== */
'use strict';

const ADM_TABS = [
  ['shop', 'ร้าน & ใบเสร็จ', 'store'],
  ['price', 'หมวดผ้า & ราคา', 'layers'],
  ['pkg', 'แพ็คเกจ', 'package'],
  ['list', 'หมวดบัญชี', 'tag'],
  ['sync', 'หลายเครื่อง', 'cloud'],
  ['rule', 'กฎระบบ', 'sliders'],
  ['data', 'ข้อมูล & รหัส', 'shield']
];

const SHOP_FIELDS = [
  ['name', 'ชื่อร้าน', 'store', 'เช่น ร้านซักรีดสะอาดใส'],
  ['tax', 'เลขประจำตัวผู้เสียภาษี (ถ้ามี)', 'hash', '13 หลัก'],
  ['phone', 'เบอร์โทรศัพท์', 'phone', '08x-xxx-xxxx'],
  ['addr', 'ที่อยู่ (ถ้ามี)', 'home', 'บ้านเลขที่ ถนน เขต จังหวัด'],
  ['foot', 'ข้อความท้ายใบเสร็จ', 'message', 'ขอบคุณที่ใช้บริการ']
];

const secHead = (ic, tone, title, sub, action = '') =>
  `<div class="card-head"><div class="ch-ic"><span class="tone-${tone}">${icon(ic)}</span><div><h2>${title}</h2><p>${sub}</p></div></div>${action}</div>`;

const toggleRow = (key, title, sub) => `
  <label class="opt-row">
    <span class="opt-txt"><b>${title}</b><small>${sub}</small></span>
    <span class="switch"><input type="checkbox" ${cfg()[key] ? 'checked' : ''} data-change="cfgSet" data-k="${key}" data-type="bool"><i></i></span>
  </label>`;

const numRow = (key, title, sub, suffix, min = 0) => `
  <div class="opt-row">
    <span class="opt-txt"><b>${title}</b><small>${sub}</small></span>
    <div class="input-affix opt-num"><input type="number" inputmode="numeric" min="${min}" step="1" value="${cfg()[key]}" data-change="cfgSet" data-k="${key}" data-type="num"><span class="affix">${suffix}</span></div>
  </div>`;

function imageSlot(key, label, hint, ic) {
  const v = db.shop[key];
  return `<div class="img-slot ${v ? 'has' : ''}">
    <div class="img-prev ${key}">${v ? `<img src="${v}" alt="${label}">` : icon(ic)}</div>
    <div class="img-info"><b>${label}</b><small>${hint}</small>
      <div class="img-btns">
        <label class="btn btn-soft btn-sm">${icon('upload')}${v ? 'เปลี่ยนรูป' : 'อัปโหลดรูป'}<input type="file" accept="image/*" hidden data-change="upImg" data-k="${key}"></label>
        ${v ? `<button class="btn btn-ghost btn-sm danger-text" data-act="rmImg" data-k="${key}">${icon('trash')}ลบ</button>` : ''}
      </div></div></div>`;
}

/* ---------- tabs ---------- */
const ADM = {};

ADM.shop = () => {
  const s = db.shop;
  return `<section class="card">
      ${secHead('store', 'indigo', 'ข้อมูลร้าน', 'แสดงบนใบเสร็จและรายงาน · บันทึกอัตโนมัติ')}
      <div class="form-grid two">
        ${SHOP_FIELDS.map(([k, l, ic, ph]) => `<div class="field ${k === 'addr' || k === 'foot' ? 'full' : ''}"><label>${l}</label>
          <div class="input-icon">${icon(ic)}<input value="${esc(s[k] || '')}" placeholder="${ph}" data-change="shopSet" data-k="${k}"></div></div>`).join('')}
      </div>
      <div class="img-slots">
        ${imageSlot('logo', 'โลโก้ร้าน', 'แสดงที่เมนูและหัวใบเสร็จ (ย่ออัตโนมัติ)', 'image')}
        ${imageSlot('qr', 'QR โอนเงิน (ท้ายใบเสร็จ)', 'เช่น QR พร้อมเพย์ของร้าน', 'qr')}
      </div>
    </section>
    <section class="card">
      ${secHead('receipt', 'pink', 'รูปแบบใบเสร็จ', 'กำหนดสิ่งที่พิมพ์บนใบเสร็จ 80mm และข้อความ LINE')}
      <div class="opt-list">
        ${toggleRow('showUnitPrice', 'แสดงราคาต่อชิ้น (@ราคา)', 'เช่น “เสื้อ x3 @20” — ปิดไว้จะแสดงแค่ชื่อและจำนวน')}
        ${toggleRow('showPkgAmt', 'แสดง “0 บาท” ในรายการที่หักแพ็คเกจ', 'ปิดไว้ ใบเสร็จลูกค้าแพ็คเกจจะไม่มีตัวเลขเงินในรายการผ้า')}
        <div class="opt-row">
          <span class="opt-txt"><b>ตัวอักษรนำหน้าเลขใบเสร็จ</b><small>ตัวอย่างเลขถัดไป: <span class="mono">${esc(cfg().rcPrefix)}${today().replace(/-/g, '').slice(2)}-${String(db.seq + 1).padStart(3, '0')}</span></small></span>
          <input class="opt-num" maxlength="6" value="${esc(cfg().rcPrefix)}" data-change="cfgSet" data-k="rcPrefix" data-type="text" aria-label="ตัวอักษรนำหน้า">
        </div>
        <div class="opt-row">
          <span class="opt-txt"><b>เลขลำดับใบเสร็จล่าสุด</b><small>ใบถัดไปจะเป็นลำดับที่ ${db.seq + 1} · แก้เมื่อต้องการเริ่มนับใหม่</small></span>
          <div class="input-affix opt-num"><input type="number" min="0" step="1" value="${db.seq}" data-change="seqSet"><span class="affix">ใบ</span></div>
        </div>
      </div>
    </section>`;
};

function garRow(g, i, list) {
  const multi = db.groups.length > 1;
  return `<div class="gar-row ${multi ? 'has-grp' : ''}">
    <div class="reorder"><button class="icon-btn sm" data-act="garMove" data-id="${g.id}" data-d="-1" ${i ? '' : 'disabled'} aria-label="เลื่อนขึ้น">${icon('chevronUp')}</button><button class="icon-btn sm" data-act="garMove" data-id="${g.id}" data-d="1" ${i < list.length - 1 ? '' : 'disabled'} aria-label="เลื่อนลง">${icon('chevronDown')}</button></div>
    <div class="gar-name"><span class="gar-ic ${g.unit == 'กก.' ? 'kg' : ''}">${icon(g.unit == 'กก.' ? 'scale' : 'shirt')}</span>
      <input value="${esc(g.name)}" data-change="garSet" data-id="${g.id}" data-k="name" aria-label="ชื่อรายการ"></div>
    <div class="input-affix"><input type="number" inputmode="decimal" min="0" value="${g.price}" data-change="garSet" data-id="${g.id}" data-k="price" aria-label="ราคา"><span class="affix">บาท/${g.unit}</span></div>
    ${multi ? `<select data-change="garSet" data-id="${g.id}" data-k="grp" aria-label="ย้ายไปหมวด" title="ย้ายไปหมวด">${db.groups.map(gr => `<option value="${gr.id}" ${gr.id == g.grp ? 'selected' : ''}>${esc(gr.name)}</option>`).join('')}</select>` : ''}
    <button class="icon-btn danger" data-act="delGar" data-id="${g.id}" title="ลบ" aria-label="ลบ ${esc(g.name)}">${icon('trash')}</button>
  </div>`;
}

ADM.price = () => `<section class="card">
    ${secHead('layers', 'pink', 'หมวดหมู่และราคา', `${db.groups.length} หมวด · ${db.garments.length} รายการ · แก้แล้วบันทึกทันที`,
      `<button class="btn btn-primary btn-sm" data-act="grpAdd">${icon('plus')}เพิ่มหมวดใหม่</button>`)}
    <div class="alert alert-info slim">${icon('info')}<div>กด <b>“เพิ่มหมวดใหม่”</b> เพื่อสร้างหมวด เช่น <b>ซักรีด</b>, <b>รีดอย่างเดียว</b>, <b>ซักแห้ง</b> (คิดตามชิ้น) หรือ <b>ซักพับ</b>, <b>ซักผ้านวม</b> (คิดตามน้ำหนัก) — หน้ารับผ้าจะแสดงแยกตามหมวด และใบเสร็จจะจัดกลุ่มให้ · หมวดคิดตามชิ้นเลือกได้ว่าหักแพ็คเกจหรือไม่ · หมวดคิดตามน้ำหนักคิดเงินทุกครั้ง · เปลี่ยนราคามีผลกับบิลใหม่เท่านั้น</div></div>
  </section>
  ${db.groups.map((gr, gi) => {
    const items = db.garments.filter(g => grpOf(g) === gr);
    return `<section class="card grp-card" style="${grpStyle(gr)}">
      <div class="grp-head">
        <div class="reorder"><button class="icon-btn sm" data-act="grpMove" data-id="${gr.id}" data-d="-1" ${gi ? '' : 'disabled'} aria-label="เลื่อนหมวดขึ้น">${icon('chevronUp')}</button><button class="icon-btn sm" data-act="grpMove" data-id="${gr.id}" data-d="1" ${gi < db.groups.length - 1 ? '' : 'disabled'} aria-label="เลื่อนหมวดลง">${icon('chevronDown')}</button></div>
        <div class="grp-name"><span class="grp-ic">${icon('layers')}</span><input value="${esc(gr.name)}" data-change="grpSet" data-id="${gr.id}" data-k="name" aria-label="ชื่อหมวด"></div>
        <div class="seg grp-unit" role="radiogroup" aria-label="คิดราคา">${[['ชิ้น', 'คิดตามชิ้น', 'shirt'], ['กก.', 'คิดตามน้ำหนัก', 'scale']].map(([u, l, ic]) => `<button class="${gr.unit === u ? 'on' : ''}" data-act="grpUnit" data-id="${gr.id}" data-u="${u}" role="radio" aria-checked="${gr.unit === u}">${icon(ic)}${l}</button>`).join('')}</div>
        ${gr.unit === 'กก.' ? `<span class="grp-pkg muted">${icon('coins')}คิดเงินทุกครั้ง (ไม่หักแพ็คเกจ)</span>`
          : `<label class="grp-pkg"><span class="switch"><input type="checkbox" ${gr.pkg ? 'checked' : ''} data-change="grpSet" data-id="${gr.id}" data-k="pkg"><i></i></span><span>หักแพ็คเกจได้</span></label>`}
        <div class="grp-colors" role="radiogroup" aria-label="สีของหมวด"><span>สี</span>${Object.entries(GRP_COLORS).map(([k, c]) => `<button class="swatch ${gr.color === k ? 'on' : ''}" style="--s1:${c[0]};--s2:${c[1]}" data-act="grpColor" data-id="${gr.id}" data-c="${k}" role="radio" aria-checked="${gr.color === k}" title="${c[3]}" aria-label="สี${c[3]}"></button>`).join('')}</div>
        <div class="grp-actions">
          <button class="btn btn-soft btn-sm" data-act="addGar" data-grp="${gr.id}">${icon('plus')}เพิ่มรายการ</button>
          ${db.groups.length > 1 ? `<button class="btn btn-ghost btn-sm" data-act="grpCopy" data-id="${gr.id}" title="คัดลอกรายการจากหมวดอื่นมาใส่หมวดนี้">${icon('copy')}คัดลอกจากหมวดอื่น</button>` : ''}
          <button class="icon-btn danger" data-act="grpDel" data-id="${gr.id}" ${db.groups.length > 1 ? '' : 'disabled'} title="ลบหมวด" aria-label="ลบหมวด ${esc(gr.name)}">${icon('trash')}</button>
        </div>
      </div>
      <div class="gar-list">${items.length ? `<div class="gar-head ${db.groups.length > 1 ? 'has-grp' : ''}"><span></span><span>ชื่อรายการ</span><span>ราคา</span>${db.groups.length > 1 ? '<span>ย้ายไปหมวด</span>' : ''}<span></span></div>` + items.map(garRow).join('')
        : `<div class="grp-empty">ยังไม่มีรายการในหมวดนี้ — กด “เพิ่มรายการ”${db.groups.length > 1 ? ' หรือ “คัดลอกจากหมวดอื่น”' : ''}</div>`}</div>
    </section>`;
  }).join('')}`;

ADM.pkg = () => `<section class="card">
    ${secHead('package', 'violet', 'แพ็คเกจ', `${db.packages.length} แพ็คเกจ · แก้ในตารางได้ทันที`,
      `<button class="btn btn-primary btn-sm" data-act="admAddPkg">${icon('plus')}เพิ่มแพ็คเกจ</button>`)}
    ${db.packages.length ? `<div class="pkg-edit">
      <div class="pkg-edit-head"><span>ชื่อแพ็คเกจ</span><span>ประเภท</span><span>จำนวนชิ้น</span><span>ราคา</span><span>ใช้ได้</span><span>ลูกค้า</span><span></span></div>
      ${db.packages.map(p => `<div class="pkg-edit-row">
        <input value="${esc(p.name)}" data-change="pkgSet" data-id="${p.id}" data-k="name" aria-label="ชื่อแพ็คเกจ">
        <select data-change="pkgSet" data-id="${p.id}" data-k="type" aria-label="ประเภท">${[...new Set([...PKG_TYPES_LIST(), p.type].filter(Boolean))].map(t => `<option ${t == p.type ? 'selected' : ''}>${esc(t)}</option>`).join('')}</select>
        <div class="input-affix"><input type="number" min="1" step="1" value="${p.pieces}" data-change="pkgSet" data-id="${p.id}" data-k="pieces" aria-label="จำนวนชิ้น"><span class="affix">ชิ้น</span></div>
        <div class="input-affix"><input type="number" min="0" value="${p.price}" data-change="pkgSet" data-id="${p.id}" data-k="price" aria-label="ราคา"><span class="affix">บาท</span></div>
        <div class="input-affix"><input type="number" min="1" step="1" value="${p.days}" data-change="pkgSet" data-id="${p.id}" data-k="days" aria-label="จำนวนวัน"><span class="affix">วัน</span></div>
        <span class="pkg-edit-n" title="ลูกค้าที่ถือแพ็คเกจนี้">${icon('users')}${db.customers.filter(c => c.pkgId == p.id).length}</span>
        <button class="icon-btn danger" data-act="admDelPkg" data-id="${p.id}" title="ลบ" aria-label="ลบ ${esc(p.name)}">${icon('trash')}</button>
      </div>`).join('')}</div>` : empty('package', 'ยังไม่มีแพ็คเกจ', 'เพิ่มแพ็คเกจเพื่อขายให้ลูกค้าประจำ')}
    <div class="alert alert-info slim">${icon('info')}<div>เปลี่ยนชื่อแพ็คเกจ ระบบจะอัปเดตชื่อในข้อมูลลูกค้าให้ด้วย · เปลี่ยนจำนวนชิ้น/ราคามีผลกับการซื้อครั้งถัดไป ยอดคงเหลือเดิมของลูกค้าไม่เปลี่ยน (แก้ยอดลูกค้าได้ที่หน้าลูกค้า)</div></div>
  </section>`;

function listEditor(kind, title, sub, tone, ic) {
  const arr = kind === 'pkgTypes' ? db.pkgTypes : db.cats[kind];
  return `<section class="card">
    ${secHead(ic, tone, title, sub)}
    <div class="list-edit">${arr.map((v, i) => `<div class="list-item">
      <input value="${esc(v)}" data-change="listSet" data-kind="${kind}" data-i="${i}" aria-label="${title} ${i + 1}">
      <button class="icon-btn danger sm" data-act="listDel" data-kind="${kind}" data-i="${i}" ${arr.length > 1 ? '' : 'disabled'} aria-label="ลบ">${icon('x')}</button></div>`).join('')}
      <form class="list-add" data-kind="${kind}"><input placeholder="เพิ่มรายการใหม่…" aria-label="เพิ่ม${title}"><button class="btn btn-soft btn-sm" type="submit">${icon('plus')}เพิ่ม</button></form>
    </div></section>`;
}
ADM.list = () => `<div class="adm-2">
    ${listEditor('in', 'หมวดรายรับ', 'ใช้ตอนเพิ่มรายรับในหน้าบัญชี', 'green', 'trendUp')}
    ${listEditor('out', 'หมวดรายจ่าย', 'ใช้ตอนเพิ่มรายจ่ายในหน้าบัญชี', 'rose', 'trendDown')}
  </div>
  ${listEditor('pkgTypes', 'ประเภทแพ็คเกจ', 'เช่น รายเดือน รายวัน', 'violet', 'package')}
  <div class="alert alert-info">${icon('info')}<div>เปลี่ยนชื่อหมวด ระบบจะเปลี่ยนชื่อในรายการบัญชี/แพ็คเกจเดิมให้ด้วย · ลบหมวดแล้วรายการเดิมยังคงชื่อหมวดเดิมไว้</div></div>`;

ADM.rule = () => `<section class="card">
    ${secHead('sliders', 'amber', 'กฎของระบบ', 'ปรับการทำงานให้ตรงกับร้าน')}
    <div class="opt-list">
      ${numRow('lowLeft', 'แจ้งเตือนเมื่อแพ็คเกจเหลือน้อย', 'แสดงในรายการ “ต้องติดตาม” เมื่อเหลือไม่เกินจำนวนนี้', 'ชิ้น')}
      ${numRow('warnDays', 'แจ้งเตือนก่อนแพ็คเกจหมดอายุ', 'แสดงในรายการ “ต้องติดตาม” ล่วงหน้า', 'วัน')}
      <div class="opt-row">
        <span class="opt-txt"><b>เมื่อลูกค้าส่งผ้าเกินแพ็คเกจ (ค่าเริ่มต้น)</b><small>เลือกเปลี่ยนได้ทุกบิลในหน้ารับผ้า</small></span>
        <select class="opt-sel" data-change="cfgSet" data-k="overDefault" data-type="text">
          ${[['carry', 'ทบไปหักแพ็คเกจถัดไป'], ['renew', 'ต่อแพ็คเกจใหม่ทันที'], ['cash', 'คิดเงินสดส่วนเกิน']].map(([k, l]) => `<option value="${k}" ${cfg().overDefault === k ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      ${numRow('lockMin', 'ล็อกโหมดแอดมินอัตโนมัติ', 'เมื่อไม่ได้ใช้งานครบเวลานี้', 'นาที', 1)}
    </div>
  </section>`;

ADM.data = () => {
  const age = backupAge();
  return `<section class="card">
      ${secHead('key', 'indigo', 'รหัสแอดมิน', 'ใช้ปลดล็อกการแก้ไขข้อมูลสำคัญ')}
      <div class="backup-grid">
        <div class="backup-box"><span class="stat-ic tone-indigo">${icon('key')}</span><div><b>เปลี่ยนรหัส PIN</b><small>ตัวเลข 4–6 หลัก</small></div>
          <button class="btn btn-soft" data-act="changePin">${icon('refresh')}เปลี่ยนรหัส</button></div>
        <div class="backup-box"><span class="stat-ic tone-amber">${icon('lock')}</span><div><b>ออกจากโหมดแอดมิน</b><small>ล็อกทันทีเมื่อส่งเครื่องให้พนักงาน</small></div>
          <button class="btn btn-soft" data-act="adminLock">${icon('lock')}ล็อกเลย</button></div>
      </div>
    </section>
    <section class="card">
      ${secHead('shield', 'green', 'สำรองข้อมูล', 'ข้อมูลอยู่ในเครื่องนี้ ควรสำรองสัปดาห์ละครั้ง')}
      <div class="backup-grid">
        <div class="backup-box"><span class="stat-ic tone-green">${icon('download')}</span>
          <div><b>ดาวน์โหลดไฟล์สำรอง</b><small>${age == null ? 'ยังไม่เคยสำรอง' : 'สำรองล่าสุด ' + dTh(db.lastBackup)}</small></div>
          <button class="btn btn-success" data-act="backup">${icon('download')}ดาวน์โหลด</button></div>
        <div class="backup-box"><span class="stat-ic tone-amber">${icon('upload')}</span>
          <div><b>กู้คืนจากไฟล์</b><small>ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</small></div>
          <label class="btn btn-soft">${icon('upload')}เลือกไฟล์ .json<input type="file" accept=".json,application/json" hidden data-change="restore"></label></div>
      </div>
      <div class="data-sum">
        <span>${icon('users')}ลูกค้า <b>${db.customers.length}</b></span>
        <span>${icon('receipt')}ใบเสร็จ <b>${db.rc.length}</b></span>
        <span>${icon('wallet')}รายการบัญชี <b>${db.ledger.length}</b></span>
        <span>${icon('package')}แพ็คเกจ <b>${db.packages.length}</b></span>
      </div>
    </section>
    <section class="card danger-zone">
      ${secHead('alert', 'rose', 'ล้างข้อมูล', 'ทำไม่ได้ย้อนกลับ — แนะนำให้ดาวน์โหลดไฟล์สำรองก่อน')}
      <div class="backup-grid">
        <div class="backup-box"><div><b>ล้างใบเสร็จและบัญชี</b><small>เก็บลูกค้า แพ็คเกจ ราคา และการตั้งค่าไว้</small></div>
          <button class="btn btn-danger-soft" data-act="wipe" data-k="tx">${icon('trash')}ล้าง</button></div>
        <div class="backup-box"><div><b>ล้างข้อมูลทั้งหมด</b><small>ลูกค้า ใบเสร็จ บัญชี (เก็บราคา แพ็คเกจ การตั้งค่า และรหัส)</small></div>
          <button class="btn btn-danger-soft" data-act="wipe" data-k="all">${icon('trash')}ล้างทั้งหมด</button></div>
      </div>
    </section>`;
};


ADM.sync = () => syncPanel();

V.set = {
  render() {
    if (!isAdmin()) {
      return `${pageHead('ผู้ดูแลระบบ', 'ส่วนสำหรับเจ้าของร้าน')}
        <div class="card lock-card">
          <div class="lock-art"><span>${icon('lock')}</span></div>
          <h2>${hasPin() ? 'ต้องใช้รหัสแอดมิน' : 'ยังไม่ได้ตั้งรหัสแอดมิน'}</h2>
          <p>แก้ไขราคาต่อชิ้น แพ็คเกจ ข้อมูลร้าน รูปแบบใบเสร็จ หมวดหมู่ กฎระบบ ยอดลูกค้า และยกเลิก/ลบใบเสร็จ ได้เมื่อเข้าสู่โหมดแอดมิน</p>
          <button class="btn btn-primary btn-lg" data-act="adminLogin">${icon(hasPin() ? 'shield' : 'key')}${hasPin() ? 'ปลดล็อกด้วยรหัส PIN' : 'ตั้งรหัสแอดมิน'}</button>
        </div>`;
    }
    const tab = ADM[state.admTab] ? state.admTab : 'shop';
    return `${pageHead('ผู้ดูแลระบบ', 'แก้ไขทุกอย่างในระบบ · บันทึกอัตโนมัติทุกครั้งที่แก้',
      `<span class="admin-pill">${icon('shield')}โหมดแอดมิน</span><button class="btn btn-ghost" data-act="adminLock">${icon('lock')}ล็อก</button>`)}
      <nav class="adm-tabs" aria-label="หมวดการตั้งค่า">${ADM_TABS.map(([k, l, ic]) => `<button class="${tab === k ? 'on' : ''}" data-act="admTab" data-k="${k}">${icon(ic)}<span>${l}</span></button>`).join('')}</nav>
      <div class="settings">${ADM[tab]()}</div>`;
  }
};

/* ---------- actions (ทุก action ในหน้านี้ต้องเป็นแอดมิน) ---------- */
const A = (name, fn) => { ACT[name] = adminOnly(fn); };

ACT.admTab = el => { state.admTab = el.dataset.k; render(); };

A('shopSet', el => {
  db.shop[el.dataset.k] = el.value.trim();
  if (el.dataset.k === 'name' && !db.shop.name) db.shop.name = 'ร้านซักรีด';
  save(); toast('บันทึกข้อมูลร้านแล้ว');
  if (el.dataset.k === 'name') { renderSidebar(); renderTopbar(); }
});
A('cfgSet', el => {
  const k = el.dataset.k, t = el.dataset.type;
  let v = t === 'bool' ? el.checked : t === 'num' ? Math.max(+el.min || 0, Math.round(+el.value || 0)) : el.value.trim();
  if (k === 'rcPrefix') v = v.replace(/[^\w-]/g, '').slice(0, 6);
  db.cfg[k] = v;
  if (k === 'overDefault') state.over = v;
  save(); render(); toast('บันทึกการตั้งค่าแล้ว');
});
A('seqSet', el => { db.seq = Math.max(0, Math.round(+el.value || 0)); save(); render(); toast('ตั้งเลขลำดับใบเสร็จแล้ว'); });

/* ราคาต่อชิ้น */
A('garSet', el => {
  const g = db.garments.find(x => x.id == el.dataset.id); if (!g) return;
  const k = el.dataset.k;
  if (k === 'price') g.price = Math.max(0, +el.value || 0);
  else if (k === 'grp') {
    // ย้ายไปท้ายหมวดใหม่
    g.grp = el.value;
    if (g.unit !== grpOf(g).unit) { g.unit = grpOf(g).unit; delete state.cart[g.id]; }
    db.garments.splice(db.garments.indexOf(g), 1);
    insertGarments([g]);
  } else g[k] = el.value.trim() || g[k];
  if (k === 'unit') delete state.cart[g.id];
  save(); toast(k === 'grp' ? `ย้าย “${g.name}” ไปหมวด “${grpOf(g).name}” แล้ว` : 'บันทึก “' + g.name + '” แล้ว');
  if (k === 'unit' || k === 'grp') render();
});
A('garMove', el => {
  const g = db.garments.find(x => x.id == el.dataset.id); if (!g) return;
  const same = db.garments.filter(x => x.grp === g.grp), i = same.indexOf(g), other = same[i + +el.dataset.d];
  if (!other) return;
  const a = db.garments.indexOf(g), b = db.garments.indexOf(other);
  [db.garments[a], db.garments[b]] = [db.garments[b], db.garments[a]];
  save(); render();
});
A('addGar', el => {
  const grp = (el && el.dataset && el.dataset.grp) || db.groups[0].id;
  formDlg({
    title: 'เพิ่มรายการ', subtitle: `หมวด: ${esc(grpById(grp).name)} · คิดราคาตาม${grpById(grp).unit === 'กก.' ? 'น้ำหนัก (บาท/กก.)' : 'ชิ้น (บาท/ชิ้น)'}`, ic: grpById(grp).unit === 'กก.' ? 'scale' : 'shirt', tone: 'pink',
    fields: [
      { k: 'name', l: 'ชื่อรายการ', req: true, ph: grpById(grp).unit === 'กก.' ? 'เช่น ซักพับ / ซักผ้านวม' : 'เช่น เสื้อเชิ้ต' },
      { k: 'price', l: 'ราคา', t: 'number', suffix: 'บาท/' + grpById(grp).unit, half: true },
      { k: 'grp', l: 'หมวด', t: 'select', o: db.groups.map(gr => [gr.id, `${gr.name} (${gr.unit === 'กก.' ? 'ตามน้ำหนัก' : 'ตามชิ้น'})`]), half: true }
    ],
    values: { price: grpById(grp).unit === 'กก.' ? 40 : 20, grp }, okText: 'เพิ่มรายการ',
    onOk: o => {
      insertGarments([{ id: uid(), name: o.name, unit: grpById(o.grp).unit, price: o.price || 0, grp: o.grp }]);
      save(); render(); toast('เพิ่ม “' + o.name + '” แล้ว');
    }
  });
});

/* หมวดหมู่ */
A('grpAdd', () => {
  const used = db.groups.map(g => g.color), nextColor = Object.keys(GRP_COLORS).find(k => !used.includes(k)) || 'indigo';
  formDlg({
    title: 'เพิ่มหมวดใหม่', ic: 'layers', tone: 'pink',
    fields: [
      { k: 'name', l: 'ชื่อหมวด', req: true, ph: 'เช่น รีดอย่างเดียว / ซักแห้ง / ซักพับ' },
      { k: 'unit', l: 'คิดราคาแบบ', t: 'select', o: [['ชิ้น', 'คิดตามชิ้น (บาท/ชิ้น)'], ['กก.', 'คิดตามน้ำหนัก (บาท/กก.)']], half: true },
      { k: 'pkg', l: 'หักจากแพ็คเกจได้ไหม', t: 'select', o: [['yes', 'ได้ — ใช้ยอดแพ็คเกจ'], ['no', 'ไม่ได้ — คิดเงินทุกครั้ง']], half: true, hint: 'หมวดคิดตามน้ำหนักจะคิดเงินทุกครั้ง' },
      { k: 'color', l: 'สีของหมวด', t: 'select', o: Object.entries(GRP_COLORS).map(([k, c]) => [k, c[3]]), hint: 'เปลี่ยนภายหลังได้โดยกดวงกลมสีในหัวหมวด' },
      { k: 'copy', l: 'เริ่มจากรายการของหมวด (ไม่บังคับ)', t: 'select', o: [['', '— เริ่มจากหมวดว่าง —']].concat(db.groups.map(gr => [gr.id, `คัดลอกรายการจาก “${gr.name}”`])), hint: 'คัดลอกชื่อและราคามาให้ แล้วค่อยแก้ราคาทีหลังได้' }
    ],
    values: { unit: 'ชิ้น', pkg: 'yes', copy: '', color: nextColor }, okText: 'สร้างหมวด',
    onOk: o => {
      if (db.groups.some(gr => gr.name === o.name)) return { k: 'name', msg: 'มีหมวดชื่อนี้แล้ว' };
      const gr = { id: 'grp-' + uid(), name: o.name, unit: o.unit, pkg: o.unit !== 'กก.' && o.pkg === 'yes', color: GRP_COLORS[o.color] ? o.color : nextColor };
      db.groups.push(gr);
      const n = o.copy ? copyGroupItems(o.copy, gr.id) : 0;
      state.admTab = 'price';
      save(); render(); toast(`สร้างหมวด “${o.name}” แล้ว${n ? ` (คัดลอก ${n} รายการ)` : ''}`);
      setTimeout(() => { const el = $$('.grp-card').pop(); el && el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 50);
    }
  });
});
function copyGroupItems(fromId, toId) {
  const copies = db.garments.filter(g => g.grp === fromId).map(g => ({ id: uid(), name: g.name, unit: grpById(toId).unit, price: g.price, grp: toId }));
  insertGarments(copies);
  return copies.length;
}
/** แทรกรายการไว้ท้ายหมวดของมัน โดยเรียงตามลำดับหมวด */
function insertGarments(list) {
  if (!list.length) return;
  const order = db.groups.map(gr => gr.id), gi = order.indexOf(list[0].grp);
  let at = 0;
  db.garments.forEach((x, i) => { if (order.indexOf(x.grp) <= gi) at = i + 1; });
  db.garments.splice(at, 0, ...list);
}
A('grpUnit', async el => {
  const gr = db.groups.find(x => x.id == el.dataset.id), u = el.dataset.u;
  if (!gr || gr.unit === u) return;
  const items = db.garments.filter(g => g.grp === gr.id);
  if (items.length && !await confirmDlg({
    title: `เปลี่ยนหมวด “${esc(gr.name)}” เป็นคิดตาม${u === 'กก.' ? 'น้ำหนัก' : 'ชิ้น'}?`, tone: 'warning', ic: u === 'กก.' ? 'scale' : 'shirt', okText: 'เปลี่ยน',
    msg: `<p>รายการในหมวดนี้ ${items.length} รายการ จะคิดราคาเป็น <b>บาท/${u}</b> (ตัวเลขราคาเดิมไม่เปลี่ยน กรุณาตรวจราคาอีกครั้ง)</p>${u === 'กก.' ? '<p>หมวดคิดตามน้ำหนักจะคิดเงินทุกครั้ง ไม่หักแพ็คเกจ</p>' : ''}`
  })) return;
  gr.unit = u;
  gr.pkg = u !== 'กก.';   // หมวดตามน้ำหนักคิดเงินเสมอ · กลับเป็นตามชิ้นให้หักแพ็คเกจได้ตามปกติ (ปิดเองได้)
  items.forEach(g => { g.unit = u; delete state.cart[g.id]; });
  save(); render(); toast(`หมวด “${gr.name}” คิดตาม${u === 'กก.' ? 'น้ำหนัก' : 'ชิ้น'}แล้ว`);
});
A('grpColor', el => {
  const gr = db.groups.find(x => x.id == el.dataset.id); if (!gr || !GRP_COLORS[el.dataset.c]) return;
  gr.color = el.dataset.c;
  save(); render(); toast(`เปลี่ยนสีหมวด “${gr.name}” เป็น${GRP_COLORS[gr.color][3]}แล้ว`);
});
A('grpSet', el => {
  const gr = db.groups.find(x => x.id == el.dataset.id); if (!gr) return;
  if (el.dataset.k === 'pkg') gr.pkg = el.checked;
  else {
    const v = el.value.trim();
    if (!v || db.groups.some(x => x !== gr && x.name === v)) { el.value = gr.name; return toast(v ? 'มีหมวดชื่อนี้แล้ว' : 'ชื่อหมวดห้ามว่าง', 'error'); }
    gr.name = v;
  }
  save(); toast('บันทึกหมวด “' + gr.name + '” แล้ว');
});
A('grpMove', el => {
  const i = db.groups.findIndex(x => x.id == el.dataset.id), j = i + +el.dataset.d;
  if (i < 0 || j < 0 || j >= db.groups.length) return;
  [db.groups[i], db.groups[j]] = [db.groups[j], db.groups[i]];
  const order = db.groups.map(gr => gr.id);
  db.garments = db.garments.map((g, k) => [g, k]).sort((a, b) => order.indexOf(a[0].grp) - order.indexOf(b[0].grp) || a[1] - b[1]).map(x => x[0]);
  save(); render();
});
A('grpCopy', el => {
  const to = db.groups.find(x => x.id == el.dataset.id); if (!to) return;
  formDlg({
    title: 'คัดลอกรายการมาใส่หมวด “' + esc(to.name) + '”', ic: 'copy', tone: 'pink',
    fields: [{ k: 'from', l: 'คัดลอกจากหมวด', t: 'select', o: db.groups.filter(x => x !== to).map(gr => [gr.id, `${gr.name} (${db.garments.filter(g => g.grp === gr.id).length} รายการ)`]) }],
    values: {}, okText: 'คัดลอก',
    onOk: o => { const n = copyGroupItems(o.from, to.id); save(); render(); toast(`คัดลอก ${n} รายการแล้ว — แก้ราคาได้เลย`); }
  });
});
A('grpDel', async el => {
  const gr = db.groups.find(x => x.id == el.dataset.id); if (!gr || db.groups.length < 2) return;
  const n = db.garments.filter(g => g.grp === gr.id).length;
  if (!await confirmDlg({ title: `ลบหมวด “${esc(gr.name)}”?`, okText: 'ลบหมวด', msg: n ? `<p>รายการในหมวดนี้ <b>${n} รายการ</b> จะถูกลบด้วย (ใบเสร็จเดิมไม่ได้รับผลกระทบ)</p>` : '<p>หมวดนี้ไม่มีรายการ</p>' })) return;
  db.garments.filter(g => g.grp === gr.id).forEach(g => delete state.cart[g.id]);
  db.garments = db.garments.filter(g => g.grp !== gr.id);
  db.groups = db.groups.filter(x => x !== gr);
  save(); render(); toast('ลบหมวดแล้ว');
});
A('delGar', async el => {
  const g = db.garments.find(x => x.id == el.dataset.id); if (!g) return;
  if (!await confirmDlg({ title: `ลบ “${esc(g.name)}”?`, msg: '<p>รายการนี้จะไม่แสดงในหน้ารับผ้าอีก (ใบเสร็จเดิมไม่ได้รับผลกระทบ)</p>', okText: 'ลบ' })) return;
  db.garments = db.garments.filter(x => x.id != g.id);
  delete state.cart[g.id];
  save(); render(); toast('ลบประเภทผ้าแล้ว');
});

/* แพ็คเกจ */
A('pkgSet', el => {
  const p = pkgById(el.dataset.id); if (!p) return;
  const k = el.dataset.k;
  if (k === 'name') {
    const v = el.value.trim(); if (!v) { el.value = p.name; return toast('ชื่อแพ็คเกจห้ามว่าง', 'error'); }
    p.name = v; db.customers.forEach(c => { if (c.pkgId == p.id) c.pkgName = v; });
  } else if (k === 'type') p.type = el.value;
  else {
    const n = Math.max(k === 'price' ? 0 : 1, Math.round(+el.value || 0));
    p[k] = n; el.value = n;
  }
  save(); toast('บันทึกแพ็คเกจ “' + p.name + '” แล้ว');
});
A('admAddPkg', () => editPkg());
A('admDelPkg', el => deletePkg(el.dataset.id));

/* หมวดหมู่ */
const listArr = kind => kind === 'pkgTypes' ? db.pkgTypes : db.cats[kind];
A('listSet', el => {
  const arr = listArr(el.dataset.kind), i = +el.dataset.i, old = arr[i], v = el.value.trim();
  if (!v || (arr.includes(v) && v !== old)) { el.value = old; return toast(v ? 'มีชื่อนี้อยู่แล้ว' : 'ชื่อห้ามว่าง', 'error'); }
  arr[i] = v;
  if (el.dataset.kind === 'pkgTypes') db.packages.forEach(p => { if (p.type === old) p.type = v; });
  else db.ledger.forEach(x => { if (x.type === el.dataset.kind && x.cat === old) x.cat = v; });
  save(); toast('เปลี่ยนเป็น “' + v + '” แล้ว');
});
A('listDel', el => {
  const arr = listArr(el.dataset.kind); if (arr.length <= 1) return;
  const [v] = arr.splice(+el.dataset.i, 1);
  save(); render(); toast('ลบ “' + v + '” แล้ว');
});
document.addEventListener('submit', async e => {
  const f = e.target.closest('.list-add'); if (!f) return;
  e.preventDefault();
  if (!await requireAdmin()) return;
  const inp = f.querySelector('input'), v = inp.value.trim(), arr = listArr(f.dataset.kind);
  if (!v) return inp.focus();
  if (arr.includes(v)) return toast('มีชื่อนี้อยู่แล้ว', 'error');
  arr.push(v); save(); render(); toast('เพิ่ม “' + v + '” แล้ว');
  const again = $(`.list-add[data-kind="${f.dataset.kind}"] input`); again && again.focus();
});

/* รูปภาพ */
A('upImg', async el => {
  const f = el.files[0], k = el.dataset.k; if (!f) return;
  try { db.shop[k] = await imgToDataURL(f, k === 'logo' ? 300 : 500); save(); render(); toast(k === 'logo' ? 'อัปโหลดโลโก้แล้ว' : 'อัปโหลด QR แล้ว'); }
  catch (e) { toast('อ่านไฟล์รูปไม่ได้', 'error'); }
});
A('rmImg', async el => {
  const k = el.dataset.k;
  if (!await confirmDlg({ title: k === 'logo' ? 'ลบโลโก้ร้าน?' : 'ลบ QR โอนเงิน?', okText: 'ลบรูป' })) return;
  db.shop[k] = ''; save(); render(); toast('ลบรูปแล้ว');
});

/* ข้อมูล */
ACT.backup = () => {
  db.lastBackup = today();
  save();
  download('laundry-backup-' + today() + '.json', new Blob([JSON.stringify(db)], { type: 'application/json' }));
  render(); toast('ดาวน์โหลดไฟล์สำรองแล้ว');
};
A('restore', async el => {
  const f = el.files[0]; el.value = '';
  if (!f) return;
  if (!await confirmDlg({ title: 'กู้คืนข้อมูลจากไฟล์?', tone: 'warning', ic: 'upload', okText: 'กู้คืนข้อมูล', msg: `<p>ไฟล์: <b>${esc(f.name)}</b></p><p>ข้อมูลปัจจุบันทั้งหมดในเครื่องนี้จะถูก<b>แทนที่</b></p>` })) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || typeof d !== 'object' || !d.shop) throw new Error('bad');
      const pin = db.admin.pin;
      db = migrate(d);
      if (!db.admin.pin) db.admin.pin = pin; // ไฟล์จากระบบเดิมไม่มีรหัส ให้ใช้รหัสปัจจุบันต่อ
      state.cart = {}; state.sel = '';
      save(); render(); toast('กู้คืนข้อมูลสำเร็จ');
    } catch (e) { toast('ไฟล์ไม่ถูกต้อง', 'error'); }
  };
  rd.readAsText(f);
});
A('wipe', async el => {
  const all = el.dataset.k === 'all';
  if (!await confirmDlg({
    title: all ? 'ล้างข้อมูลทั้งหมด?' : 'ล้างใบเสร็จและบัญชี?', okText: 'ล้างข้อมูล',
    msg: `<p>${all ? 'ลูกค้า ใบเสร็จ และรายการบัญชีทั้งหมด' : 'ใบเสร็จและรายการบัญชีทั้งหมด'} จะถูกลบ <b>กู้คืนไม่ได้</b></p><div class="alert alert-warning">${icon('download')}<div>แนะนำให้ดาวน์โหลดไฟล์สำรองก่อน</div></div>`
  })) return;
  if (!await confirmDlg({ title: 'ยืนยันอีกครั้ง', msg: '<p>แน่ใจหรือไม่? การกระทำนี้ย้อนกลับไม่ได้</p>', okText: 'ใช่ ล้างเลย' })) return;
  db.rc = []; db.ledger = []; db.orders = []; db.seq = 0;
  if (all) { db.customers = []; state.sel = ''; }
  state.cart = {};
  save(); render(); toast('ล้างข้อมูลแล้ว', 'warning');
});
