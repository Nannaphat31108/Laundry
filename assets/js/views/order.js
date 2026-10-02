/* ==========================================================================
   รับผ้า / คิดเงิน (POS)
   ========================================================================== */
'use strict';

const pieceGarments = () => db.garments.filter(g => g.unit != 'กก.');
const weightGarments = () => db.garments.filter(g => g.unit == 'กก.');

/** คำนวณยอด: ใช้แพ็คเกจก่อน ส่วนเกินคิดเงินสด หรือต่อแพ็คเกจใหม่อัตโนมัติ (ตรรกะเดียวกับระบบเดิม) */
function calc() {
  const { cart, renew } = state, c = cust(state.sel), pieceG = pieceGarments(), wtG = weightGarments();
  const pcsTot = pieceG.reduce((a, g) => a + (cart[g.id] || 0), 0);
  const kgTot = wtG.reduce((a, g) => a + (cart[g.id] || 0), 0);
  const avail = c && active(c) ? c.left : 0, use = Math.min(avail, pcsTot), overflow = pcsTot - use;
  let renewInfo = null;
  if (renew && overflow > 0 && c && c.pkgId) {
    const pkg = pkgById(c.pkgId);
    if (pkg && pkg.pieces > 0) {
      const cycles = Math.ceil(overflow / pkg.pieces);
      renewInfo = { pkg, cycles, fee: cycles * pkg.price, newLeft: cycles * pkg.pieces - overflow, newExp: addDays(pkg.days) };
    }
  }
  let bud = use;
  const pieceLines = [];
  pieceG.forEach(g => {
    const q = cart[g.id] || 0; if (!q) return;
    const u = Math.min(bud, q); bud -= u;
    const pay = renewInfo ? 0 : (q - u);
    pieceLines.push({ g, q, used: u, pay, amt: pay * g.price });
  });
  const wtLines = wtG.filter(g => cart[g.id]).map(g => ({ g, q: cart[g.id], used: 0, pay: cart[g.id], amt: cart[g.id] * g.price }));
  const lines = pieceLines.concat(wtLines), itemPay = lines.reduce((a, l) => a + l.amt, 0);
  const pay = Math.round((itemPay + (renewInfo ? renewInfo.fee : 0)) * 100) / 100;
  return {
    lines, use, overflow, renewInfo, pay, pcsTot, kgTot: Math.round(kgTot * 100) / 100,
    before: c && c.pkgId ? avail : null,
    left: renewInfo ? renewInfo.newLeft : (c && active(c) ? avail - use : null),
    any: lines.some(l => l.q > 0)
  };
}

function tileHTML(g) {
  const q = state.cart[g.id] || 0;
  if (g.unit == 'กก.') {
    return `<div class="tile tile-kg ${q ? 'on' : ''}" id="t-${g.id}">
      <div class="tile-top"><span class="tile-ic">${icon('scale')}</span><span class="tile-q">${q ? fm(q) + ' กก.' : ''}</span></div>
      <b class="tile-name">${esc(g.name)}</b><span class="tile-price">${fm(g.price)} บาท/กก.</span>
      <div class="stepper kg">
        <button data-act="wstep" data-id="${g.id}" data-d="-0.5" aria-label="ลด 0.5 กก.">${icon('minus')}</button>
        <div class="kg-in"><input type="number" inputmode="decimal" min="0" step="0.1" placeholder="0" value="${q || ''}" data-input="wqty" data-id="${g.id}" aria-label="น้ำหนัก ${esc(g.name)}"><span>กก.</span></div>
        <button data-act="wstep" data-id="${g.id}" data-d="0.5" aria-label="เพิ่ม 0.5 กก.">${icon('plus')}</button>
      </div>
    </div>`;
  }
  return `<div class="tile ${q ? 'on' : ''}" id="t-${g.id}" data-act="tileAdd" data-id="${g.id}" role="button" tabindex="0" aria-label="เพิ่ม ${esc(g.name)}">
    <div class="tile-top"><span class="tile-ic">${icon('shirt')}</span><span class="tile-q">${q || ''}</span></div>
    <b class="tile-name">${esc(g.name)}</b><span class="tile-price">${fm(g.price)} บาท/ชิ้น</span>
    <div class="stepper">
      <button data-act="qty" data-id="${g.id}" data-d="-1" ${q ? '' : 'disabled'} aria-label="ลด">${icon('minus')}</button>
      <b>${q}</b>
      <button data-act="qty" data-id="${g.id}" data-d="1" aria-label="เพิ่ม">${icon('plus')}</button>
    </div>
  </div>`;
}

function customerCard() {
  const c = cust(state.sel);
  if (!c) {
    return `<button class="cust-pick" data-act="pickCust">
      <span class="avatar av-walkin">${icon('user')}</span>
      <span class="cust-pick-main"><b>ลูกค้าทั่วไป</b><small>จ่ายรายวัน · คิดราคาตามรายการ</small></span>
      <span class="cust-pick-cta">${icon('search')}เลือกลูกค้า</span></button>`;
  }
  const st = pkgStatus(c), p = pkgById(c.pkgId), total = p ? p.pieces : Math.max(c.left, 1);
  return `<div class="cust-pick-wrap">
    <button class="cust-pick" data-act="pickCust">
      ${avatar(c)}
      <span class="cust-pick-main"><b>${esc(c.name)}</b><small>${[c.phone, c.line && 'LINE: ' + c.line].filter(Boolean).map(esc).join(' · ') || 'ไม่มีข้อมูลติดต่อ'}</small></span>
      <span class="cust-pick-cta">${icon('refresh')}เปลี่ยน</span>
    </button>
    ${active(c) ? `<div class="pkg-strip">
      <div class="pkg-strip-main">
        <div class="pkg-strip-top">${badge(esc(c.pkgName), 'primary', 'package')}<span>คงเหลือ <b>${c.left}</b> ชิ้น · ถึง ${dTh(c.exp)}</span></div>
        <div class="meter ${st.tone}"><span style="width:${Math.min(100, c.left / total * 100)}%"></span></div>
      </div></div>`
      : `<div class="alert alert-danger slim">${icon('alert')}<div>ไม่มีแพ็คเกจที่ใช้งานได้ — คิดราคาตามรายการ</div>
         <button class="btn btn-sm btn-soft" data-act="buyPkg" data-id="${c.id}">${icon('package')}ซื้อแพ็คเกจ</button></div>`}
    <button class="icon-btn cust-clear" data-act="selCust" data-id="" title="เปลี่ยนเป็นลูกค้าทั่วไป" aria-label="ล้างลูกค้า">${icon('x')}</button>
  </div>`;
}

function summaryHTML() {
  const c = cust(state.sel), cl = calc();
  const renewBox = c && active(c) ? `
    <label class="switch-row">
      <span class="switch"><input type="checkbox" ${state.renew ? 'checked' : ''} data-change="toggleRenew"><i></i></span>
      <span>ถ้าชิ้นเกินแพ็คเกจ ให้<b>ต่อแพ็คเกจใหม่ทันที</b> (แทนคิดเงินสดส่วนเกิน)</span>
    </label>
    ${cl.renewInfo ? `<div class="alert alert-warning slim">${icon('refresh')}<div>เกินแพ็คเกจเดิม <b>${cl.overflow}</b> ชิ้น → ต่อแพ็คเกจ <b>${esc(cl.renewInfo.pkg.name)}</b>${cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : ''} ราคา <b>${fm(cl.renewInfo.fee)}</b> บาท<br><small>เหลือใหม่ ${cl.renewInfo.newLeft} ชิ้น ถึง ${dTh(cl.renewInfo.newExp)}</small></div></div>` : ''}` : '';

  const lines = cl.lines.map(l => `
    <div class="sum-line">
      <div class="sum-line-main"><b>${esc(l.g.name)}</b><small>${fm(l.q)} ${l.g.unit} × ${fm(l.g.price)}</small>
        ${l.used ? `<span class="mini-tag">ใช้แพ็คเกจ ${l.used}${l.g.unit}${l.pay ? ` · จ่าย ${l.pay}${l.g.unit}` : ''}</span>` : ''}</div>
      <span class="sum-line-amt">${l.amt ? fm(l.amt) : l.used || cl.renewInfo ? '<span class="free">แพ็คเกจ</span>' : '0'}</span>
    </div>`).join('');

  return `
    <div class="sum-head"><h2>${icon('receipt')}สรุปรายการ</h2>${cl.any ? `<button class="btn btn-ghost btn-sm" data-act="clearCart">${icon('trash')}ล้าง</button>` : ''}</div>
    ${renewBox}
    <div class="sum-lines">${cl.any ? lines + (cl.renewInfo ? `<div class="sum-line"><div class="sum-line-main"><b>${esc(cl.renewInfo.pkg.name)}</b><small>ต่อแพ็คเกจใหม่อัตโนมัติ${cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : ''}</small></div><span class="sum-line-amt">${fm(cl.renewInfo.fee)}</span></div>` : '')
      : `<div class="sum-empty">${icon('shirt')}<p>แตะที่รายการผ้าเพื่อเพิ่มลงบิล</p></div>`}</div>
    <div class="sum-foot">
      <div class="sum-row"><span>จำนวน</span><b>${cl.pcsTot} ชิ้น${cl.kgTot ? ' + ' + fm(cl.kgTot) + ' กก.' : ''}</b></div>
      ${cl.use ? `<div class="sum-row"><span>ใช้แพ็คเกจ</span><b>${cl.use} ชิ้น <small>(เหลือ ${cl.left})</small></b></div>` : ''}
      <div class="sum-total"><span>ต้องชำระ</span><b>${fm(cl.pay)}<small> บาท</small></b></div>
      <button class="btn btn-primary btn-lg btn-block" data-act="checkout" ${cl.any ? '' : 'disabled'}>${icon('printer')}บันทึก + พิมพ์ใบเสร็จ</button>
    </div>`;
}

function barHTML() {
  const cl = calc();
  return `<div class="pos-bar-info"><small>${cl.pcsTot} ชิ้น${cl.kgTot ? ' + ' + fm(cl.kgTot) + ' กก.' : ''}${cl.use ? ' · ใช้แพ็คเกจ ' + cl.use : ''}</small><b>${fm(cl.pay)} <small>บาท</small></b></div>
    <button class="btn btn-primary" data-act="checkout" ${cl.any ? '' : 'disabled'}>${icon('printer')}บันทึก + พิมพ์</button>`;
}

function refreshOrder(ids) {
  (ids || []).forEach(id => { const g = db.garments.find(x => x.id == id), el = $('#t-' + id); if (g && el && g.unit != 'กก.') el.outerHTML = tileHTML(g); else if (g && el) { el.classList.toggle('on', !!state.cart[id]); const tq = el.querySelector('.tile-q'); if (tq) tq.textContent = state.cart[id] ? fm(state.cart[id]) + ' กก.' : ''; } });
  renderPart('#pos-sum', summaryHTML());
  renderPart('#pos-bar', barHTML());
  const ph = $('#pg-piece-h'); if (ph) ph.innerHTML = pieceHead();
}
const pieceHead = () => { const c = cust(state.sel); return `<h2>รายการคิดตามชิ้น</h2>${c && active(c) ? badge('ใช้แพ็คเกจได้', 'success', 'check') : ''}`; };

V.order = {
  render() {
    const pg = pieceGarments(), wg = weightGarments();
    return `
      <div class="pos">
        <div class="pos-main">
          ${pageHead('รับผ้า / คิดเงิน', 'เลือกลูกค้า เพิ่มรายการผ้า แล้วบันทึกเพื่อพิมพ์ใบเสร็จ')}
          <div class="card cust-card">${customerCard()}</div>
          <div class="sec-head" id="pg-piece-h">${pieceHead()}</div>
          ${pg.length ? `<div class="tile-grid">${pg.map(tileHTML).join('')}</div>`
            : `<div class="card">${empty('shirt', 'ยังไม่มีรายการผ้า', 'เพิ่มประเภทผ้าและราคาได้ในหน้าตั้งค่าร้าน', `<a class="btn btn-soft" href="#/set">${icon('settings')}ไปตั้งค่าร้าน</a>`)}</div>`}
          ${wg.length ? `<div class="sec-head"><h2>รายการคิดตามน้ำหนัก (กก.)</h2>${badge('ไม่หักจากแพ็คเกจ', 'neutral')}</div><div class="tile-grid">${wg.map(tileHTML).join('')}</div>` : ''}
        </div>
        <aside class="pos-side"><div class="card sum" id="pos-sum">${summaryHTML()}</div></aside>
      </div>
      <div class="pos-bar" id="pos-bar">${barHTML()}</div>`;
  }
};

/* ---------- actions ---------- */
ACT.tileAdd = (el, e) => {
  if (e.target.closest('.stepper')) return;
  ACT.qty({ dataset: { id: el.dataset.id, d: '1' } });
};
ACT.qty = el => {
  const id = el.dataset.id, d = +el.dataset.d;
  state.cart[id] = Math.max(0, (state.cart[id] || 0) + d);
  if (!state.cart[id]) delete state.cart[id];
  refreshOrder([id]);
  const t = $('#t-' + id); if (t && d > 0) { t.classList.remove('bump'); void t.offsetWidth; t.classList.add('bump'); }
};
ACT.wqty = el => {
  const n = parseFloat(el.value);
  if (n > 0) state.cart[el.dataset.id] = n; else delete state.cart[el.dataset.id];
  refreshOrder([el.dataset.id]);
};
ACT.wstep = el => {
  const id = el.dataset.id, v = Math.max(0, Math.round(((state.cart[id] || 0) + +el.dataset.d) * 10) / 10);
  if (v > 0) state.cart[id] = v; else delete state.cart[id];
  const inp = $(`#t-${id} input`); if (inp) inp.value = v || '';
  refreshOrder([id]);
};
ACT.clearCart = () => { state.cart = {}; state.renew = false; render(); };
ACT.toggleRenew = el => { state.renew = el.checked; refreshOrder(); };
ACT.selCust = el => { state.sel = el.dataset.id; state.renew = false; if (state.route === 'order') render(); else go('order'); };

document.addEventListener('keydown', e => {
  if ((e.key === 'Enter' || e.key === ' ') && e.target.matches && e.target.matches('.tile[data-act="tileAdd"]')) { e.preventDefault(); ACT.tileAdd(e.target, e); }
});

ACT.pickCust = () => {
  const listHTML = q => {
    q = q.trim().toLowerCase();
    const l = db.customers.filter(c => (c.name + c.phone + (c.line || '')).toLowerCase().includes(q));
    const walk = !q || 'ลูกค้าทั่วไป'.includes(q) ? `<button class="pick-item ${!state.sel ? 'on' : ''}" data-pick="">
        <span class="avatar av-walkin">${icon('user')}</span><span class="pick-main"><b>ลูกค้าทั่วไป</b><small>จ่ายรายวัน</small></span>${!state.sel ? icon('check', 'pick-check') : ''}</button>` : '';
    return walk + l.map(c => {
      const st = pkgStatus(c);
      return `<button class="pick-item ${state.sel == c.id ? 'on' : ''}" data-pick="${c.id}">
        ${avatar(c)}<span class="pick-main"><b>${esc(c.name)}</b><small>${esc(c.phone || '-')}${c.line ? ' · LINE: ' + esc(c.line) : ''}</small></span>
        ${c.pkgId ? `<span class="pick-pkg">${badge(active(c) ? 'เหลือ ' + c.left + ' ชิ้น' : st.label, st.tone)}</span>` : ''}
        ${state.sel == c.id ? icon('check', 'pick-check') : ''}</button>`;
    }).join('') || `<div class="pick-none">ไม่พบลูกค้า “${esc(q)}”</div>`;
  };
  const m = openModal({
    title: 'เลือกลูกค้า', subtitle: 'ค้นหาด้วยชื่อ เบอร์โทร หรือไลน์ไอดี', ic: 'users', size: 'md',
    body: `<div class="search-box">${icon('search')}<input type="search" placeholder="พิมพ์เพื่อค้นหา…" autofocus></div>
           <div class="pick-list">${listHTML('')}</div>`,
    footer: `<button class="btn btn-soft" data-new>${icon('userPlus')}เพิ่มลูกค้าใหม่</button><span class="grow"></span><button class="btn btn-ghost" data-close>ปิด</button>`
  });
  const inp = m.q('input');
  inp.addEventListener('input', () => { m.q('.pick-list').innerHTML = listHTML(inp.value); });
  m.q('.pick-list').addEventListener('click', e => {
    const b = e.target.closest('[data-pick]'); if (!b) return;
    state.sel = b.dataset.pick; state.renew = false; m.close(); render();
  });
  m.q('[data-new]').addEventListener('click', () => { m.close(); editCust(null, c => { state.sel = c.id; state.renew = false; render(); }); });
};

ACT.checkout = () => {
  const cl = calc();
  if (!cl.any) return toast('กรุณาเลือกจำนวนผ้าก่อน', 'error');
  const c = cust(state.sel);
  const lines = cl.lines.map(l => ({ t: l.g.name, q: l.q, unit: l.g.unit, price: l.g.price, a: l.pay * l.g.price, note: l.used ? `ใช้แพ็คเกจ ${l.used}${l.g.unit}, จ่าย ${l.pay}${l.g.unit}` : '' }));
  let exp = (c && active(c)) || cl.use ? c.exp : '';
  if (cl.renewInfo) {
    lines.push({ t: cl.renewInfo.pkg.name + ' (ต่อแพ็คเกจใหม่อัตโนมัติ' + (cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : '') + ')', q: '', a: cl.renewInfo.fee });
    c.left = cl.renewInfo.newLeft; c.exp = cl.renewInfo.newExp; exp = c.exp;
  } else if (c && cl.use) { c.left = cl.left; }
  const r = mkRc({
    kind: 'order', name: c ? c.name : 'ลูกค้าทั่วไป', phone: c ? c.phone : '', lines, total: cl.pay,
    left: cl.renewInfo ? cl.renewInfo.newLeft : cl.left, before: cl.before, used: cl.use, overflow: cl.overflow,
    renewed: !!cl.renewInfo, renewFee: cl.renewInfo ? cl.renewInfo.fee : 0, exp
  });
  const svcPay = cl.pay - (cl.renewInfo ? cl.renewInfo.fee : 0);
  if (svcPay > 0) db.ledger.push({ id: uid(), date: r.date, type: 'in', title: 'ซักรีด ' + r.name + ' (' + r.no + ')', cat: 'ค่าบริการซักรีด', amt: svcPay, rc: r.no });
  if (cl.renewInfo) db.ledger.push({ id: uid(), date: r.date, type: 'in', title: 'ต่อแพ็คเกจอัตโนมัติ ' + cl.renewInfo.pkg.name + ' - ' + r.name + ' (' + r.no + ')', cat: 'ค่าแพ็คเกจ', amt: cl.renewInfo.fee, rc: r.no });
  save();
  state.cart = {}; state.renew = false;
  render(); showRc(r);
  toast('บันทึกบิล ' + r.no + ' เรียบร้อย');
};
