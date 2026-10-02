/* ==========================================================================
   แพ็คเกจ
   ========================================================================== */
'use strict';

const PKG_TONES = ['indigo', 'pink', 'cyan', 'amber', 'green', 'violet'];

V.pkg = {
  render() {
    const cards = db.packages.map((p, i) => {
      const users = db.customers.filter(c => c.pkgId == p.id && active(c)).length;
      const per = p.pieces > 0 ? p.price / p.pieces : 0;
      return `<article class="pkg-card tone-${PKG_TONES[i % PKG_TONES.length]}">
        <div class="pkg-card-top">
          <span class="pkg-card-ic">${icon('package')}</span>
          ${badge(esc(p.type || 'อื่นๆ'), 'neutral')}
          <button class="icon-btn" data-act="editPkg" data-id="${p.id}" title="แก้ไข" aria-label="แก้ไข ${esc(p.name)}">${icon('edit')}</button>
        </div>
        <h3>${esc(p.name)}</h3>
        <div class="pkg-price"><b>${fm(p.price)}</b><span>บาท</span></div>
        <ul class="pkg-feats">
          <li>${icon('shirt')}<span><b>${fm(p.pieces)}</b> ชิ้น</span></li>
          <li>${icon('calendar')}<span>ใช้ได้ <b>${fm(p.days)}</b> วัน</span></li>
          <li>${icon('tag')}<span>เฉลี่ย <b>${fm(Math.round(per * 100) / 100)}</b> บาท/ชิ้น</span></li>
        </ul>
        <div class="pkg-card-foot">${icon('users')}<span>ลูกค้าใช้งานอยู่ <b>${users}</b> ราย</span></div>
      </article>`;
    }).join('');
    return `${pageHead('แพ็คเกจ', 'แพ็คเกจแบบเหมาจ่ายสำหรับลูกค้าประจำ หักยอดตามจำนวนชิ้น',
      `<button class="btn btn-primary" data-act="editPkg">${icon('plus')}เพิ่มแพ็คเกจ</button>`)}
      ${db.packages.length ? `<div class="pkg-grid">${cards}
        <button class="pkg-add" data-act="editPkg"><span>${icon('plus')}</span><b>เพิ่มแพ็คเกจใหม่</b><small>กำหนดจำนวนชิ้น ราคา และอายุการใช้งาน</small></button></div>`
        : `<div class="card">${empty('package', 'ยังไม่มีแพ็คเกจ', 'สร้างแพ็คเกจเพื่อขายให้ลูกค้าประจำ', `<button class="btn btn-primary" data-act="editPkg">${icon('plus')}เพิ่มแพ็คเกจ</button>`)}</div>`}
      <div class="alert alert-info">${icon('info')}<div>ลูกค้าทั่วไป/รายวัน คิดตามราคาต่อชิ้นในหน้า <a href="#/set">ตั้งค่าร้าน</a> · รายการหน่วย “ชิ้น” หักจากแพ็คเกจได้ ส่วนหน่วย “กก.” คิดราคาตามน้ำหนักเสมอ</div></div>`;
  }
};

ACT.editPkg = el => editPkg(el.dataset.id);

function editPkg(id) {
  const p = id ? pkgById(id) : { type: 'รายเดือน', days: 30 };
  formDlg({
    title: id ? 'แก้ไขแพ็คเกจ' : 'เพิ่มแพ็คเกจ', ic: 'package', tone: 'pink',
    fields: [
      { k: 'name', l: 'ชื่อแพ็คเกจ', ph: 'เช่น รายเดือน 50 ชิ้น', req: true },
      { k: 'type', l: 'ประเภท', t: 'select', o: PKG_TYPES, half: true },
      { k: 'pieces', l: 'จำนวนชิ้น', t: 'number', step: 1, suffix: 'ชิ้น', req: true, half: true },
      { k: 'price', l: 'ราคา', t: 'number', suffix: 'บาท', half: true },
      { k: 'days', l: 'ใช้ได้กี่วัน', t: 'number', step: 1, suffix: 'วัน', half: true }
    ],
    values: p, okText: id ? 'บันทึก' : 'เพิ่มแพ็คเกจ',
    onOk: o => {
      if (!o.name) return { k: 'name', msg: 'กรุณาใส่ชื่อแพ็คเกจ' };
      if (!(o.pieces > 0)) return { k: 'pieces', msg: 'กรุณาใส่จำนวนชิ้น' };
      if (id) Object.assign(p, o); else db.packages.push({ id: uid(), ...o });
      save(); render(); toast(id ? 'บันทึกแพ็คเกจแล้ว' : 'เพิ่มแพ็คเกจแล้ว');
    },
    danger: id ? {
      text: 'ลบ', onClick: async m => {
        if (!await confirmDlg({ title: `ลบแพ็คเกจ “${esc(p.name)}”?`, msg: '<p>ลูกค้าที่ซื้อแพ็คเกจนี้ไปแล้วยังใช้ยอดคงเหลือเดิมได้ แต่จะต่อแพ็คเกจอัตโนมัติไม่ได้</p>', okText: 'ลบแพ็คเกจ' })) return;
        db.packages = db.packages.filter(x => x.id != id);
        save(); m.close(); render(); toast('ลบแพ็คเกจแล้ว');
      }
    } : null
  });
}
