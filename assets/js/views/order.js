/* ==========================================================================
   รับผ้า / คิดเงิน (POS)
   ========================================================================== */
'use strict';

/** รายการที่หักแพ็คเกจได้ / รายการที่คิดเงินเสมอ (หน่วย กก. หรือหมวดที่ไม่หักแพ็คเกจ) */
const pieceGarments = () => db.garments.filter(pkgEligible);
const weightGarments = () => db.garments.filter(g => !pkgEligible(g));

/**
 * คำนวณยอด: ใช้แพ็คเกจก่อน ส่วนที่เกินจัดการได้ 3 แบบ (state.over)
 *  - carry: ทบเป็นยอดเกิน ไปหักจากแพ็คเกจถัดไป (ค่าเริ่มต้น)
 *  - renew: ต่อแพ็คเกจใหม่ทันที แล้วหักส่วนเกิน (รวมยอดเกินเดิม)
 *  - cash:  คิดเงินสดตามราคาต่อชิ้น
 */
function calc() {
  const { cart } = state, c = cust(state.sel), pieceG = pieceGarments(), wtG = weightGarments();
  const hasPkg = !!(c && c.pkgId);
  const pcsTot = pieceG.reduce((a, g) => a + (cart[g.id] || 0), 0);
  const kgTot = db.garments.filter(g => g.unit == 'กก.').reduce((a, g) => a + (cart[g.id] || 0), 0);
  const allPcs = db.garments.filter(g => g.unit != 'กก.').reduce((a, g) => a + (cart[g.id] || 0), 0);
  const avail = c && active(c) ? c.left : 0, use = Math.min(avail, pcsTot), overflow = pcsTot - use;
  const owed = owedOf(c);
  // ยอดตั้งต้น: แพ็คเกจหมดอายุแล้ว ยอดบวกที่เหลือใช้ไม่ได้ แต่ยอดเกินยังอยู่
  const base = hasPkg ? (active(c) ? c.left : Math.min(0, c.left)) : 0;
  const mode = hasPkg && overflow > 0 ? state.over : 'cash';
  let renewInfo = null;
  if (mode === 'renew') {
    const pkg = pkgById(c.pkgId);
    if (pkg && pkg.pieces > 0) {
      const need = overflow + owed, cycles = Math.max(1, Math.ceil(need / pkg.pieces));
      renewInfo = { pkg, cycles, need, fee: cycles * pkg.price, newLeft: cycles * pkg.pieces - need, newExp: addDays(pkg.days) };
    }
  }
  const carry = mode === 'carry' ? overflow : 0;
  const free = !!renewInfo || carry > 0;
  let bud = use;
  const pieceLines = [];
  pieceG.forEach(g => {
    const q = cart[g.id] || 0; if (!q) return;
    const u = Math.min(bud, q); bud -= u;
    const pay = free ? 0 : (q - u);
    pieceLines.push({ g, q, used: u, over: free ? q - u : 0, pay, amt: pay * g.price });
  });
  const wtLines = wtG.filter(g => cart[g.id]).map(g => ({ g, q: cart[g.id], used: 0, over: 0, pay: cart[g.id], amt: cart[g.id] * g.price }));
  const lines = pieceLines.concat(wtLines), itemPay = lines.reduce((a, l) => a + l.amt, 0);
  const pay = Math.round((itemPay + (renewInfo ? renewInfo.fee : 0)) * 100) / 100;
  return {
    lines: lines.sort((a, b) => db.garments.indexOf(a.g) - db.garments.indexOf(b.g)),
    use, overflow, owed, mode, renewInfo, carry, pay, pcsTot: allPcs, kgTot: Math.round(kgTot * 100) / 100,
    hasPkg, before: hasPkg ? c.left : null,
    left: renewInfo ? renewInfo.newLeft : (hasPkg ? base - use - carry : null),
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
  const st = pkgStatus(c), p = pkgById(c.pkgId), total = p ? p.pieces : Math.max(c.left, 1), owed = owedOf(c);
  const strip = c.pkgId ? `<div class="pkg-strip ${active(c) ? '' : 'off'}">
      <div class="pkg-strip-main">
        <div class="pkg-strip-top">${badge(esc(c.pkgName), active(c) ? 'primary' : 'neutral', 'package')}
          <span>${owed ? `<b class="owed">เกิน ${owed}</b> ชิ้น` : `คงเหลือ <b>${active(c) ? c.left : 0}</b> ชิ้น`} · ${c.exp < today() ? 'หมดอายุ ' : 'ถึง '}${dTh(c.exp)}</span></div>
        <div class="meter ${st.tone}"><span style="width:${Math.max(0, Math.min(100, c.left / total * 100))}%"></span></div>
        ${owed ? `<p class="strip-note">${icon('info')}ใช้เกินแพ็คเกจรอบก่อน ${owed} ชิ้น — จะหักอัตโนมัติเมื่อซื้อ/ต่อแพ็คเกจใหม่</p>`
          : !active(c) ? `<p class="strip-note">${icon('alert')}แพ็คเกจ${c.exp < today() ? 'หมดอายุแล้ว' : 'ใช้ครบแล้ว'} — ชิ้นที่ส่งมาเลือกทบไปแพ็คเกจถัดไปหรือคิดเงินสดได้</p>` : ''}
      </div>
      ${active(c) ? '' : `<button class="btn btn-sm btn-primary" data-act="buyPkg" data-id="${c.id}">${icon('refresh')}ต่อแพ็คเกจ</button>`}
    </div>`
    : `<div class="alert alert-info slim">${icon('info')}<div>ลูกค้ายังไม่มีแพ็คเกจ — คิดราคาตามรายการ</div>
         <button class="btn btn-sm btn-soft" data-act="buyPkg" data-id="${c.id}">${icon('package')}ซื้อแพ็คเกจ</button></div>`;
  return `<div class="cust-pick-wrap">
    <button class="cust-pick" data-act="pickCust">
      ${avatar(c)}
      <span class="cust-pick-main"><b>${esc(c.name)}</b><small>${[c.phone, c.line && 'LINE: ' + c.line].filter(Boolean).map(esc).join(' · ') || 'ไม่มีข้อมูลติดต่อ'}</small></span>
      <span class="cust-pick-cta">${icon('refresh')}เปลี่ยน</span>
    </button>
    ${strip}
    <button class="icon-btn cust-clear" data-act="selCust" data-id="" title="เปลี่ยนเป็นลูกค้าทั่วไป" aria-label="ล้างลูกค้า">${icon('x')}</button>
  </div>`;
}

function summaryHTML() {
  const c = cust(state.sel), cl = calc();
  let overBox = '';
  if (cl.hasPkg && cl.overflow > 0) {
    const p = pkgById(c.pkgId);
    const cashAmt = cl.lines.reduce((a, l) => a + (l.g.unit != 'กก.' ? (l.q - l.used) * l.g.price : 0), 0);
    const opts = [
      ['carry', 'ทบไปหักแพ็คเกจถัดไป', `เกินรวม ${cl.overflow + cl.owed} ชิ้น · ไม่เก็บเงินตอนนี้`, 'layers'],
      ['renew', 'ต่อแพ็คเกจใหม่ทันที', p && p.pieces > 0 ? `${esc(p.name)} ${money(p.price * Math.max(1, Math.ceil((cl.overflow + cl.owed) / p.pieces)))}` : 'ไม่พบแพ็คเกจเดิม', 'refresh'],
      ['cash', 'คิดเงินสดส่วนเกิน', money(cashAmt), 'coins']
    ];
    overBox = `<div class="over-box">
      <div class="over-head">${icon('alert')}<span>เกินแพ็คเกจ <b>${cl.overflow}</b> ชิ้น${cl.owed ? ` (มียอดเกินจากรอบก่อน ${cl.owed} ชิ้น)` : ''} — เลือกวิธีจัดการ</span></div>
      <div class="over-opts" role="radiogroup">${opts.map(([k, t, d, ic]) => `<button class="over-opt ${state.over === k ? 'on' : ''}" data-act="setOver" data-k="${k}" role="radio" aria-checked="${state.over === k}" ${k === 'renew' && !(p && p.pieces > 0) ? 'disabled' : ''}>
        <span class="over-ic">${icon(ic)}</span><span class="over-txt"><b>${t}</b><small>${d}</small></span><span class="radio"></span></button>`).join('')}</div>
      ${cl.renewInfo ? `<p class="over-note">ต่อแพ็คเกจ${cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : ''} แล้วหัก ${cl.renewInfo.need} ชิ้น → เหลือใหม่ <b>${cl.renewInfo.newLeft}</b> ชิ้น ถึง ${dTh(cl.renewInfo.newExp)}</p>`
        : cl.mode === 'carry' ? `<p class="over-note">ยอดเกินรวม <b>${-cl.left}</b> ชิ้น จะหักจากแพ็คเกจถัดไปอัตโนมัติ และพิมพ์แจ้งในใบเสร็จ</p>` : ''}
    </div>`;
  }

  const lines = cl.lines.map(l => `
    <div class="sum-line">
      <div class="sum-line-main"><b>${esc(l.g.name)}</b><small>${fm(l.q)} ${l.g.unit} × ${fm(l.g.price)}</small>
        ${l.used ? `<span class="mini-tag">ใช้แพ็คเกจ ${l.used}${l.g.unit}${l.pay ? ` · จ่าย ${l.pay}${l.g.unit}` : ''}</span>` : ''}${l.over ? `<span class="mini-tag warn">เกิน ${l.over}${l.g.unit} · ${cl.mode === 'carry' ? 'ทบแพ็คเกจถัดไป' : 'หักแพ็คเกจใหม่'}</span>` : ''}</div>
      <span class="sum-line-amt">${l.amt ? fm(l.amt) : l.used || l.over ? '<span class="free">แพ็คเกจ</span>' : '0'}</span>
    </div>`).join('');

  return `
    <div class="sum-head"><h2>${icon('receipt')}สรุปรายการ</h2>${cl.any ? `<button class="btn btn-ghost btn-sm" data-act="clearCart">${icon('trash')}ล้าง</button>` : ''}</div>
    ${overBox}
    <div class="sum-lines">${cl.any ? lines + (cl.renewInfo ? `<div class="sum-line"><div class="sum-line-main"><b>${esc(cl.renewInfo.pkg.name)}</b><small>ต่อแพ็คเกจใหม่อัตโนมัติ${cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : ''}</small></div><span class="sum-line-amt">${fm(cl.renewInfo.fee)}</span></div>` : '')
      : `<div class="sum-empty">${icon('shirt')}<p>แตะที่รายการผ้าเพื่อเพิ่มลงบิล</p></div>`}</div>
    <div class="sum-foot">
      <div class="sum-row"><span>จำนวน</span><b>${cl.pcsTot} ชิ้น${cl.kgTot ? ' + ' + fm(cl.kgTot) + ' กก.' : ''}</b></div>
      ${cl.use ? `<div class="sum-row"><span>ใช้แพ็คเกจ</span><b>${cl.use} ชิ้น</b></div>` : ''}
      ${cl.hasPkg && cl.any ? `<div class="sum-row"><span>คงเหลือหลังบิลนี้</span><b class="${cl.left < 0 ? 'owed' : ''}">${pcs(cl.left)}</b></div>` : ''}
      <div class="sum-total"><span>ต้องชำระ</span><b>${fm(cl.pay)}<small> บาท</small></b></div>
      <button class="btn btn-primary btn-lg btn-block" data-act="checkout" ${cl.any ? '' : 'disabled'}>${icon('printer')}บันทึก + พิมพ์ใบเสร็จ</button>
    </div>`;
}

function barHTML() {
  const cl = calc();
  return `<div class="pos-bar-info"><small>${cl.pcsTot} ชิ้น${cl.kgTot ? ' + ' + fm(cl.kgTot) + ' กก.' : ''}${cl.use ? ' · ใช้แพ็คเกจ ' + cl.use : ''}${cl.carry ? ' · ทบ ' + cl.carry : ''}</small><b>${fm(cl.pay)} <small>บาท</small></b></div>
    <button class="btn btn-primary" data-act="checkout" ${cl.any ? '' : 'disabled'}>${icon('printer')}บันทึก + พิมพ์</button>`;
}

function refreshOrder(ids) {
  (ids || []).forEach(id => { const g = db.garments.find(x => x.id == id), el = $('#t-' + id); if (g && el && g.unit != 'กก.') el.outerHTML = tileHTML(g); else if (g && el) { el.classList.toggle('on', !!state.cart[id]); const tq = el.querySelector('.tile-q'); if (tq) tq.textContent = state.cart[id] ? fm(state.cart[id]) + ' กก.' : ''; } });
  renderPart('#pos-sum', summaryHTML());
  renderPart('#pos-bar', barHTML());
}

/** หัวข้อของแต่ละหมวด พร้อมป้ายบอกว่าหักแพ็คเกจได้หรือไม่ */
function groupHead(gr, items) {
  const c = cust(state.sel), pcsItems = items.some(g => g.unit != 'กก.');
  const tag = !gr.pkg || !pcsItems ? badge('ไม่หักจากแพ็คเกจ', 'neutral')
    : c && active(c) ? badge('ใช้แพ็คเกจได้', 'success', 'check')
    : c && c.pkgId ? badge('ทบไปแพ็คเกจถัดไปได้', 'warning', 'layers')
    : badge('หักแพ็คเกจได้', 'primary', 'package');
  return `<div class="sec-head" id="grp-${gr.id}"><h2>${esc(gr.name)}</h2>${tag}</div>`;
}

V.order = {
  render() {
    const groups = db.groups.map(gr => ({ gr, items: db.garments.filter(g => grpOf(g) === gr) })).filter(x => x.items.length);
    return `
      <div class="pos">
        <div class="pos-main">
          ${pageHead('รับผ้า / คิดเงิน', 'เลือกลูกค้า เพิ่มรายการผ้า แล้วบันทึกเพื่อพิมพ์ใบเสร็จ')}
          <div class="card cust-card">${customerCard()}</div>
          ${groups.length > 1 ? `<nav class="grp-jump" aria-label="ไปยังหมวด">${groups.map(({ gr, items }) => `<button class="chip" data-act="grpJump" data-id="${gr.id}">${esc(gr.name)}<span class="chip-n">${items.length}</span></button>`).join('')}</nav>` : ''}
          ${groups.length ? groups.map(({ gr, items }) => `${groupHead(gr, items)}<div class="tile-grid">${items.map(tileHTML).join('')}</div>`).join('')
              + `<button class="btn btn-ghost manage-link" data-act="goPrice">${icon('layers')}เพิ่มหมวด / แก้ราคา (แอดมิน)</button>`
            : `<div class="card">${empty('shirt', 'ยังไม่มีรายการผ้า', 'เพิ่มหมวดและรายการผ้าได้ในหน้าผู้ดูแลระบบ', `<button class="btn btn-soft" data-act="goPrice">${icon('layers')}เพิ่มหมวดและราคา</button>`)}</div>`}
        </div>
        <aside class="pos-side"><div class="card sum" id="pos-sum">${summaryHTML()}</div></aside>
      </div>
      <div class="pos-bar" id="pos-bar">${barHTML()}</div>`;
  }
};

/* ---------- actions ---------- */
ACT.goPrice = () => { state.admTab = 'price'; if (state.route === 'set') render(); else go('set'); };
ACT.grpJump = el => { const h = $('#grp-' + el.dataset.id); if (h) h.scrollIntoView({ behavior: 'smooth', block: 'start' }); };
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
ACT.clearCart = () => { state.cart = {}; state.over = cfg().overDefault; render(); };
ACT.setOver = el => { state.over = el.dataset.k; refreshOrder(); };
ACT.selCust = el => { state.sel = el.dataset.id; state.over = cfg().overDefault; if (state.route === 'order') render(); else go('order'); };

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
    state.sel = b.dataset.pick; state.over = cfg().overDefault; m.close(); render();
  });
  m.q('[data-new]').addEventListener('click', () => { m.close(); editCust(null, c => { state.sel = c.id; state.over = cfg().overDefault; render(); }); });
};

ACT.checkout = () => {
  const cl = calc();
  if (!cl.any) return toast('กรุณาเลือกจำนวนผ้าก่อน', 'error');
  const c = cust(state.sel);
  const overTxt = cl.mode === 'carry' ? 'ทบแพ็คเกจถัดไป' : 'หักแพ็คเกจใหม่';
  const lines = cl.lines.map(l => ({
    t: l.g.name, grp: grpOf(l.g).name, q: l.q, unit: l.g.unit, price: l.g.price, a: l.pay * l.g.price,
    note: [l.used ? `ใช้แพ็คเกจ ${l.used}${l.g.unit}` : '', l.over ? `เกิน ${l.over}${l.g.unit} (${overTxt})` : '', l.used && l.pay ? `จ่าย ${l.pay}${l.g.unit}` : ''].filter(Boolean).join(', ')
  }));
  let exp = cl.hasPkg ? c.exp : '';
  if (cl.renewInfo) {
    lines.push({ t: cl.renewInfo.pkg.name + ' (ต่อแพ็คเกจใหม่อัตโนมัติ' + (cl.renewInfo.cycles > 1 ? ' x' + cl.renewInfo.cycles : '') + ')', q: '', a: cl.renewInfo.fee });
    c.left = cl.renewInfo.newLeft; c.exp = cl.renewInfo.newExp; exp = c.exp;
  } else if (cl.hasPkg && (cl.use || cl.carry)) { c.left = cl.left; }
  const r = mkRc({
    kind: 'order', name: c ? c.name : 'ลูกค้าทั่วไป', phone: c ? c.phone : '', lines, total: cl.pay,
    left: cl.hasPkg ? (cl.renewInfo ? cl.renewInfo.newLeft : cl.left) : null,
    before: cl.before, used: cl.use, overflow: cl.overflow, carried: cl.carry, owedBefore: cl.owed,
    renewed: !!cl.renewInfo, renewFee: cl.renewInfo ? cl.renewInfo.fee : 0, exp
  });
  const svcPay = cl.pay - (cl.renewInfo ? cl.renewInfo.fee : 0);
  if (svcPay > 0) db.ledger.push({ id: uid(), date: r.date, type: 'in', title: 'ซักรีด ' + r.name + ' (' + r.no + ')', cat: 'ค่าบริการซักรีด', amt: svcPay, rc: r.no });
  if (cl.renewInfo) db.ledger.push({ id: uid(), date: r.date, type: 'in', title: 'ต่อแพ็คเกจอัตโนมัติ ' + cl.renewInfo.pkg.name + ' - ' + r.name + ' (' + r.no + ')', cat: 'ค่าแพ็คเกจ', amt: cl.renewInfo.fee, rc: r.no });
  save();
  state.cart = {}; state.over = cfg().overDefault;
  render(); issueRc(r);
  toast('บันทึกบิล ' + r.no + ' เรียบร้อย');
};
