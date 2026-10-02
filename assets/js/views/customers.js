/* ==========================================================================
   ลูกค้า + ซื้อ/ต่อแพ็คเกจ
   ========================================================================== */
'use strict';

const CUST_FILTERS = [
  ['all', 'ทั้งหมด', () => true],
  ['active', 'มีแพ็คเกจใช้งาน', c => active(c)],
  ['low', 'ใกล้หมด', c => needsFollow(c)],
  ['none', 'ไม่มี / หมดอายุ', c => !active(c)]
];

function custRows() {
  const q = state.q.trim().toLowerCase();
  const f = (CUST_FILTERS.find(x => x[0] === state.custFilter) || CUST_FILTERS[0])[2];
  const l = db.customers.filter(c => f(c) && (c.name + c.phone + (c.line || '')).toLowerCase().includes(q));
  if (!db.customers.length) return empty('users', 'ยังไม่มีลูกค้า', 'เพิ่มลูกค้าเพื่อขายแพ็คเกจและติดตามยอดคงเหลือ', `<button class="btn btn-primary" data-act="editCust">${icon('userPlus')}เพิ่มลูกค้า</button>`);
  if (!l.length) return empty('search', 'ไม่พบลูกค้าที่ตรงกัน', 'ลองเปลี่ยนคำค้นหาหรือตัวกรอง');
  return `<div class="table-wrap"><table class="table resp">
    <thead><tr><th>ลูกค้า</th><th>เบอร์ / ไลน์ไอดี</th><th>แพ็คเกจ</th><th>คงเหลือ</th><th class="r">จัดการ</th></tr></thead>
    <tbody>${l.map(c => {
      const st = pkgStatus(c), p = pkgById(c.pkgId), total = p ? p.pieces : Math.max(c.left, 1);
      return `<tr>
        <td data-l="ลูกค้า"><div class="who">${avatar(c)}<b>${esc(c.name)}</b></div></td>
        <td data-l="ติดต่อ"><div class="contact">${c.phone ? `<span>${icon('phone')}${esc(c.phone)}</span>` : ''}${c.line ? `<span class="line">${icon('message')}LINE: ${esc(c.line)}</span>` : ''}${!c.phone && !c.line ? '<span class="muted">-</span>' : ''}</div></td>
        <td data-l="แพ็คเกจ">${c.pkgId ? `<div class="pkg-cell"><b>${esc(c.pkgName)}</b><small>ถึง ${dTh(c.exp)}</small></div>` : '<span class="muted">-</span>'}</td>
        <td data-l="คงเหลือ">${c.pkgId ? `<div class="left-cell">${badge(pcs(c.left), st.tone)}<div class="meter sm ${st.tone}"><span style="width:${Math.max(0, Math.min(100, c.left / total * 100))}%"></span></div></div>` : badge('ไม่มีแพ็คเกจ', 'neutral')}</td>
        <td class="r actions">
          <button class="btn btn-sm btn-primary" data-act="buyPkg" data-id="${c.id}">${icon('package')}ซื้อ/ต่อแพ็คเกจ</button>
          <button class="icon-btn" data-act="selCust" data-id="${c.id}" title="รับผ้าให้ลูกค้านี้" aria-label="รับผ้าให้ ${esc(c.name)}">${icon('washer')}</button>
          <button class="icon-btn" data-act="editCust" data-id="${c.id}" title="แก้ไข" aria-label="แก้ไข ${esc(c.name)}">${icon('edit')}</button>
        </td></tr>`;
    }).join('')}</tbody></table></div>`;
}

function custChips() {
  return CUST_FILTERS.map(([k, l, f]) => `<button class="chip ${state.custFilter === k ? 'on' : ''}" data-act="custFilter" data-k="${k}">${l}<span class="chip-n">${db.customers.filter(f).length}</span></button>`).join('');
}

V.cust = {
  render() {
    return `${pageHead('ลูกค้า', `ทั้งหมด ${db.customers.length} ราย · ใช้งานแพ็คเกจอยู่ ${db.customers.filter(active).length} ราย`,
      `<button class="btn btn-primary" data-act="editCust">${icon('userPlus')}เพิ่มลูกค้า</button>`)}
      <div class="card">
        <div class="toolbar">
          <div class="search-box grow">${icon('search')}<input type="search" placeholder="ค้นหาชื่อ / เบอร์ / ไลน์ไอดี" value="${esc(state.q)}" data-input="custSearch" aria-label="ค้นหาลูกค้า"></div>
          <div class="chips" id="cust-chips">${custChips()}</div>
        </div>
        <div id="cust-list">${custRows()}</div>
      </div>`;
  }
};

ACT.custSearch = el => { state.q = el.value; renderPart('#cust-list', custRows()); };
ACT.custFilter = el => { state.custFilter = el.dataset.k; renderPart('#cust-chips', custChips()); renderPart('#cust-list', custRows()); };
ACT.editCust = el => editCust(el.dataset.id);

function editCust(id, onCreated) {
  const c = id ? cust(id) : {}, adm = isAdmin();
  let fields = [
    { k: 'name', l: 'ชื่อลูกค้า', req: true, ph: 'เช่น คุณสมชาย' },
    { k: 'phone', l: 'เบอร์โทร', t: 'tel', ph: '08x-xxx-xxxx', half: true },
    { k: 'line', l: 'ไลน์ไอดี (ถ้ามี)', ph: '@lineid', half: true }
  ];
  // แอดมิน: แก้แพ็คเกจ ยอดคงเหลือ และวันหมดอายุได้ทั้งหมด
  if (id && adm) fields = fields.concat([
    { k: 'pkgId', l: 'แพ็คเกจ', t: 'select', o: [['', '— ไม่มีแพ็คเกจ —']].concat(db.packages.map(p => [p.id, p.name])).concat(c.pkgId && !pkgById(c.pkgId) ? [[c.pkgId, c.pkgName + ' (ถูกลบแล้ว)']] : []) },
    { k: 'left', l: 'จำนวนคงเหลือ (ชิ้น)', t: 'number', step: 1, min: -9999, suffix: 'ชิ้น', half: true, hint: 'ติดลบ = ชิ้นที่เกินแพ็คเกจ รอหักแพ็คเกจถัดไป' },
    { k: 'exp', l: 'วันหมดอายุ', t: 'date', half: true }
  ]);
  const intro = id && !adm && c.pkgId ? `<div class="alert alert-info slim lock-hint">${icon('lock')}<div>แก้แพ็คเกจ ยอดคงเหลือ หรือวันหมดอายุ ต้องเข้าสู่โหมดแอดมิน</div><button class="btn btn-sm btn-soft" data-unlock>${icon('shield')}แอดมิน</button></div>` : '';
  const m = formDlg({
    title: id ? 'แก้ไขลูกค้า' : 'เพิ่มลูกค้า', subtitle: id && c.pkgId ? 'แพ็คเกจ: ' + esc(c.pkgName) : '', ic: id ? 'edit' : 'userPlus',
    fields, values: c, okText: id ? 'บันทึก' : 'เพิ่มลูกค้า', intro,
    onOk: o => {
      if (!o.name) return { k: 'name', msg: 'กรุณาใส่ชื่อ' };
      if (id) {
        if ('pkgId' in o) {
          const p = pkgById(o.pkgId);
          if (!o.pkgId) Object.assign(o, { pkgName: '', left: 0, exp: '' });
          else {
            if (p) o.pkgName = p.name;
            if (!o.exp) return { k: 'exp', msg: 'กรุณาระบุวันหมดอายุ' };
          }
        }
        if ('left' in o) o.left = Math.round(o.left) || 0;
        Object.assign(c, o); toast('บันทึกข้อมูลลูกค้าแล้ว');
      } else {
        const n = { id: uid(), name: o.name, phone: o.phone, line: o.line, pkgId: '', pkgName: '', left: 0, exp: '' };
        db.customers.push(n); toast('เพิ่มลูกค้า ' + o.name + ' แล้ว');
        if (onCreated) { save(); setTimeout(() => onCreated(n)); return; }
      }
      save(); render();
    },
    danger: id ? {
      text: 'ลบ', onClick: async m2 => {
        if (!await requireAdmin()) return;
        if (!await confirmDlg({ title: `ลบลูกค้า “${esc(c.name)}”?`, msg: '<p>ข้อมูลลูกค้าและยอดแพ็คเกจคงเหลือจะถูกลบ (ใบเสร็จเดิมยังอยู่)</p>', okText: 'ลบลูกค้า' })) return;
        db.customers = db.customers.filter(x => x.id != id);
        if (state.sel == id) state.sel = '';
        save(); m2.close(); render(); toast('ลบลูกค้าแล้ว');
      }
    } : null
  });
  const ub = m.q('[data-unlock]');
  if (ub) ub.addEventListener('click', async () => { if (await requireAdmin()) { m.close(); setTimeout(() => editCust(id, onCreated), 200); } });
}

ACT.buyPkg = el => buyPkg(el.dataset.id);

function buyPkg(id) {
  const c = cust(id);
  if (!c) return;
  if (!db.packages.length) {
    toast('ยังไม่มีแพ็คเกจ กรุณาเพิ่มในหน้าแพ็คเกจ', 'error');
    return go('pkg');
  }
  let pick = db.packages.find(p => p.id == c.pkgId) ? c.pkgId : db.packages[0].id;
  const owed = owedOf(c), leftover = active(c) ? c.left : 0;
  let keep = leftover > 0;
  const optHTML = () => db.packages.map(p => `
    <button class="pkg-opt ${pick == p.id ? 'on' : ''}" data-p="${p.id}" role="radio" aria-checked="${pick == p.id}">
      <span class="radio"></span>
      <span class="pkg-opt-main"><b>${esc(p.name)}</b><small>${p.pieces} ชิ้น · ใช้ได้ ${p.days} วัน · ${esc(p.type || '')}</small></span>
      <span class="pkg-opt-price">${money(p.price)}</span>
    </button>`).join('');
  const calcHTML = () => {
    const p = pkgById(pick); if (!p) return '';
    const net = p.pieces - owed + (keep ? leftover : 0);
    return `<div class="net-box">
      <div class="net-row"><span>แพ็คเกจใหม่</span><b>+${p.pieces} ชิ้น</b></div>
      ${owed ? `<div class="net-row neg"><span>หักยอดเกินจากรอบก่อน</span><b>−${owed} ชิ้น</b></div>` : ''}
      ${leftover > 0 ? `<label class="net-row check"><span><input type="checkbox" ${keep ? 'checked' : ''} data-keep> ทบยอดคงเหลือเดิม (ถึง ${dTh(c.exp)})</span><b>${keep ? '+' + leftover : '0'} ชิ้น</b></label>` : ''}
      <div class="net-row total"><span>คงเหลือหลังซื้อ</span><b class="${net < 0 ? 'owed' : ''}">${pcs(net)}</b></div>
      <div class="net-row sub"><span>ใช้ได้ถึง</span><span>${dTh(addDays(p.days))}</span></div>
    </div>`;
  };
  const m = openModal({
    title: 'ซื้อ / ต่อแพ็คเกจ', subtitle: 'ให้ ' + esc(c.name), ic: 'package', tone: 'pink',
    body: `${owed ? `<div class="alert alert-warning slim">${icon('layers')}<div>ลูกค้าใช้เกินแพ็คเกจรอบก่อน <b>${owed}</b> ชิ้น — ระบบจะหักออกจากแพ็คเกจใหม่ให้อัตโนมัติ</div></div>` : ''}
           <div class="pkg-opts" role="radiogroup">${optHTML()}</div>
           <div class="net-wrap">${calcHTML()}</div>`,
    footer: `<button class="btn btn-ghost" data-close>ยกเลิก</button><button class="btn btn-primary" data-ok>${icon('receipt')}ชำระเงิน + ออกใบเสร็จ</button>`
  });
  m.q('.pkg-opts').addEventListener('click', e => { const b = e.target.closest('[data-p]'); if (!b) return; pick = b.dataset.p; m.q('.pkg-opts').innerHTML = optHTML(); m.q('.net-wrap').innerHTML = calcHTML(); });
  m.q('.net-wrap').addEventListener('change', e => { if (e.target.matches('[data-keep]')) { keep = e.target.checked; m.q('.net-wrap').innerHTML = calcHTML(); } });
  m.q('[data-ok]').addEventListener('click', () => {
    const p = pkgById(pick); if (!p) return;
    m.close();
    const kept = keep ? leftover : 0, net = p.pieces - owed + kept;
    Object.assign(c, { pkgId: p.id, pkgName: p.name, left: net, exp: addDays(p.days) });
    const lines = [{ t: p.name, q: '', a: p.price }, { t: p.pieces + ' ชิ้น / ' + p.days + ' วัน', q: '', a: '' }];
    const r = mkRc({ kind: 'pkg', name: c.name, phone: c.phone, lines, total: p.price, left: c.left, exp: c.exp, pieces: p.pieces, owedBefore: owed, kept });
    db.ledger.push({ id: uid(), date: r.date, type: 'in', title: 'แพ็คเกจ ' + p.name + ' - ' + c.name + ' (' + r.no + ')', cat: 'ค่าแพ็คเกจ', amt: p.price, rc: r.no });
    save(); render(); issueRc(r);
    toast(`ขายแพ็คเกจ ${p.name} ให้ ${c.name} แล้ว · คงเหลือ ${pcs(net)}`);
  });
}
