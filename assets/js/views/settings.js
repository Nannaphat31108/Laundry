/* ==========================================================================
   ตั้งค่าร้าน: ข้อมูลร้าน, ประเภทผ้า/ราคา, QR, สำรองข้อมูล
   ========================================================================== */
'use strict';

const SHOP_FIELDS = [
  ['name', 'ชื่อร้าน', 'store', 'เช่น ร้านซักรีดสะอาดใส'],
  ['tax', 'เลขประจำตัวผู้เสียภาษี (ถ้ามี)', 'hash', '13 หลัก'],
  ['phone', 'เบอร์โทรศัพท์', 'phone', '08x-xxx-xxxx'],
  ['addr', 'ที่อยู่ (ถ้ามี)', 'home', 'บ้านเลขที่ ถนน เขต จังหวัด'],
  ['foot', 'ข้อความท้ายใบเสร็จ', 'message', 'ขอบคุณที่ใช้บริการ']
];

function garmentRows() {
  if (!db.garments.length) return empty('shirt', 'ยังไม่มีประเภทผ้า/บริการ', 'เพิ่มรายการเพื่อใช้ในหน้ารับผ้า');
  return `<div class="gar-head"><span>ชื่อรายการ</span><span>ราคา</span><span>หน่วย</span><span></span></div>` +
    db.garments.map(g => `<div class="gar-row">
      <div class="gar-name"><span class="gar-ic ${g.unit == 'กก.' ? 'kg' : ''}">${icon(g.unit == 'กก.' ? 'scale' : 'shirt')}</span>
        <input value="${esc(g.name)}" data-change="garSet" data-id="${g.id}" data-k="name" aria-label="ชื่อรายการ"></div>
      <div class="input-affix"><input type="number" inputmode="decimal" min="0" value="${g.price}" data-change="garSet" data-id="${g.id}" data-k="price" aria-label="ราคา"><span class="affix">บาท/${g.unit}</span></div>
      <select data-change="garSet" data-id="${g.id}" data-k="unit" aria-label="หน่วย">${UNITS.map(u => `<option ${u == g.unit ? 'selected' : ''}>${u}</option>`).join('')}</select>
      <button class="icon-btn danger" data-act="delGar" data-id="${g.id}" title="ลบ" aria-label="ลบ ${esc(g.name)}">${icon('trash')}</button>
    </div>`).join('');
}

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

V.set = {
  render() {
    const s = db.shop, age = backupAge();
    return `${pageHead('ตั้งค่าร้าน', 'ข้อมูลบนใบเสร็จ ประเภทผ้าและราคา และการสำรองข้อมูล')}
      <div class="settings">
        <section class="card">
          <div class="card-head"><div class="ch-ic"><span class="tone-indigo">${icon('store')}</span><div><h2>ข้อมูลร้าน</h2><p>แสดงบนใบเสร็จและรายงาน · บันทึกอัตโนมัติ</p></div></div></div>
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
          <div class="card-head"><div class="ch-ic"><span class="tone-pink">${icon('shirt')}</span><div><h2>ประเภทผ้า / บริการ และราคา</h2><p>${db.garments.length} รายการ · แก้ไขแล้วบันทึกทันที</p></div></div>
            <button class="btn btn-primary btn-sm" data-act="addGar">${icon('plus')}เพิ่มประเภทผ้า/บริการ</button></div>
          <div class="gar-list" id="gar-list">${garmentRows()}</div>
          <div class="alert alert-info slim">${icon('info')}<div>ตัวอย่างประเภทบริการ: ผ้ารีด, ซักรีด, ซักพับ (ตั้งหน่วยเป็น “กก.”), ซักแห้ง, เครื่องนอน — รายการหน่วย “ชิ้น” ใช้หักจากแพ็คเกจได้ ส่วนหน่วย “กก.” จะคิดราคาตามน้ำหนักเสมอ</div></div>
        </section>

        <section class="card">
          <div class="card-head"><div class="ch-ic"><span class="tone-green">${icon('shield')}</span><div><h2>สำรองข้อมูล</h2><p>ข้อมูลอยู่ในเครื่องนี้ ควรสำรองสัปดาห์ละครั้ง</p></div></div></div>
          <div class="backup-grid">
            <div class="backup-box">
              <span class="stat-ic tone-green">${icon('download')}</span>
              <div><b>ดาวน์โหลดไฟล์สำรอง</b><small>${age == null ? 'ยังไม่เคยสำรอง' : 'สำรองล่าสุด ' + dTh(db.lastBackup)}</small></div>
              <button class="btn btn-success" data-act="backup">${icon('download')}ดาวน์โหลด</button>
            </div>
            <div class="backup-box">
              <span class="stat-ic tone-amber">${icon('upload')}</span>
              <div><b>กู้คืนจากไฟล์</b><small>ข้อมูลปัจจุบันจะถูกแทนที่ทั้งหมด</small></div>
              <label class="btn btn-soft">${icon('upload')}เลือกไฟล์ .json<input type="file" accept=".json,application/json" hidden data-change="restore"></label>
            </div>
          </div>
          <div class="data-sum">
            <span>${icon('users')}ลูกค้า <b>${db.customers.length}</b></span>
            <span>${icon('receipt')}ใบเสร็จ <b>${db.rc.length}</b></span>
            <span>${icon('wallet')}รายการบัญชี <b>${db.ledger.length}</b></span>
            <span>${icon('package')}แพ็คเกจ <b>${db.packages.length}</b></span>
          </div>
        </section>
      </div>`;
  }
};

ACT.shopSet = el => {
  db.shop[el.dataset.k] = el.value.trim();
  if (el.dataset.k === 'name' && !db.shop.name) db.shop.name = 'ร้านซักรีด';
  save(); toast('บันทึกข้อมูลร้านแล้ว');
  if (el.dataset.k === 'name') { renderSidebar(); renderTopbar(); }
};
ACT.garSet = el => {
  const g = db.garments.find(x => x.id == el.dataset.id); if (!g) return;
  const k = el.dataset.k;
  g[k] = k === 'price' ? Math.max(0, +el.value || 0) : el.value.trim() || g[k];
  save(); toast('บันทึก “' + g.name + '” แล้ว');
  if (k === 'unit') { if (g.unit == 'กก.') delete state.cart[g.id]; renderPart('#gar-list', garmentRows()); }
};
ACT.addGar = () => {
  formDlg({
    title: 'เพิ่มประเภทผ้า/บริการ', ic: 'shirt', tone: 'pink',
    fields: [
      { k: 'name', l: 'ชื่อรายการ', req: true, ph: 'เช่น ผ้าม่าน' },
      { k: 'price', l: 'ราคา', t: 'number', suffix: 'บาท', half: true },
      { k: 'unit', l: 'หน่วย', t: 'select', o: UNITS, half: true, hint: '“กก.” คิดตามน้ำหนัก ไม่หักแพ็คเกจ' }
    ],
    values: { unit: 'ชิ้น', price: 20 }, okText: 'เพิ่มรายการ',
    onOk: o => { db.garments.push({ id: uid(), name: o.name, unit: o.unit, price: o.price || 0 }); save(); render(); toast('เพิ่ม “' + o.name + '” แล้ว'); }
  });
};
ACT.delGar = async el => {
  const g = db.garments.find(x => x.id == el.dataset.id); if (!g) return;
  if (!await confirmDlg({ title: `ลบ “${esc(g.name)}”?`, msg: '<p>รายการนี้จะไม่แสดงในหน้ารับผ้าอีก (ใบเสร็จเดิมไม่ได้รับผลกระทบ)</p>', okText: 'ลบ' })) return;
  db.garments = db.garments.filter(x => x.id != g.id);
  delete state.cart[g.id];
  save(); render(); toast('ลบประเภทผ้าแล้ว');
};
ACT.upImg = async el => {
  const f = el.files[0], k = el.dataset.k; if (!f) return;
  try { db.shop[k] = await imgToDataURL(f, k === 'logo' ? 300 : 500); save(); render(); toast(k === 'logo' ? 'อัปโหลดโลโก้แล้ว' : 'อัปโหลด QR แล้ว'); }
  catch (e) { toast('อ่านไฟล์รูปไม่ได้', 'error'); }
};
ACT.rmImg = async el => {
  const k = el.dataset.k;
  if (!await confirmDlg({ title: k === 'logo' ? 'ลบโลโก้ร้าน?' : 'ลบ QR โอนเงิน?', okText: 'ลบรูป' })) return;
  db.shop[k] = ''; save(); render(); toast('ลบรูปแล้ว');
};
ACT.backup = () => {
  db.lastBackup = today();
  save();
  download('laundry-backup-' + today() + '.json', new Blob([JSON.stringify(db)], { type: 'application/json' }));
  render(); toast('ดาวน์โหลดไฟล์สำรองแล้ว');
};
ACT.restore = async el => {
  const f = el.files[0]; el.value = '';
  if (!f) return;
  if (!await confirmDlg({ title: 'กู้คืนข้อมูลจากไฟล์?', tone: 'warning', ic: 'upload', okText: 'กู้คืนข้อมูล', msg: `<p>ไฟล์: <b>${esc(f.name)}</b></p><p>ข้อมูลปัจจุบันทั้งหมดในเครื่องนี้จะถูก<b>แทนที่</b></p>` })) return;
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || typeof d !== 'object' || !d.shop) throw new Error('bad');
      db = migrate(d); state.cart = {}; state.sel = '';
      save(); render(); toast('กู้คืนข้อมูลสำเร็จ');
    } catch (e) { toast('ไฟล์ไม่ถูกต้อง', 'error'); }
  };
  rd.readAsText(f);
};
