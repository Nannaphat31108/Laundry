/* ==========================================================================
   ใบเสร็จ 80mm + รายงานสรุป A4
   ========================================================================== */
'use strict';

/** บิลรับผ้าของลูกค้าแพ็คเกจ: ไม่แสดงราคาต่อชิ้นในใบเสร็จ */
const isPkgOrder = r => r.kind !== 'pkg' && r.left != null;

function receiptHTML(r) {
  const s = db.shop;
  const L = (a, b, cls = '') => `<div class="rc-l ${cls}"><span>${a}</span><span>${b}</span></div>`;
  const noPrice = isPkgOrder(r);
  const lines = r.lines.map(l => {
    const showAmt = l.a !== '' && !(noPrice && !+l.a);
    const head = L(`${esc(l.t)}${l.q ? ' x' + l.q + (l.unit || '') : ''}`, l.price != null && !noPrice ? '@' + fm(l.price) : '');
    const sub = (l.note || showAmt) ? L(`<small>${esc(l.note || '')}</small>`, showAmt ? fm(l.a) + ' บาท' : '') : '';
    return head + sub;
  }).join('');
  let pk = '';
  if (r.left != null) {
    if (r.used != null) {
      pk = (r.before < 0 ? L('เกินแพ็คเกจจากรอบก่อน', -r.before + ' ชิ้น') : L('ยอดคงเหลือก่อนหน้า', r.before + ' ชิ้น')) +
        L('ใช้จากแพ็คเกจ', r.used + ' ชิ้น') +
        (r.renewed ? L('เกินแพ็คเกจเดิม', r.overflow + ' ชิ้น') + L('ค่าต่อแพ็คเกจใหม่', fm(r.renewFee) + ' บาท') : '') +
        (r.carried ? L('เกินแพ็คเกจครั้งนี้', r.carried + ' ชิ้น') : '');
    } else {
      pk = (r.pieces ? L('แพ็คเกจใหม่', '+' + r.pieces + ' ชิ้น') : '') +
        (r.owedBefore ? L('หักยอดเกินจากรอบก่อน', '−' + r.owedBefore + ' ชิ้น') : '') +
        (r.kept ? L('ทบยอดคงเหลือเดิม', '+' + r.kept + ' ชิ้น') : '');
    }
    pk += L(`<b>${r.used != null ? 'คงเหลือ' + (r.renewed ? 'หลังต่อแพ็คเกจ' : '') : 'แพ็คเกจคงเหลือ'}</b>`, `<b>${Math.max(0, r.left)} ชิ้น</b>`);
    if (r.left < 0) pk += L('<b>เกินแพ็คเกจรวม</b>', `<b>${-r.left} ชิ้น</b>`) + '<div class="rc-note">* ส่วนที่เกินแพ็คเกจจะหักจากแพ็คเกจถัดไป</div>';
  }
  return `<div class="rc">
    ${r.void ? '<div class="rc-void">*** ใบเสร็จนี้ถูกยกเลิกแล้ว ***</div>' : ''}
    <div class="rc-c">
      ${s.logo ? `<img class="rc-logo" src="${s.logo}" alt="">` : ''}
      <div class="rc-shop">${esc(s.name)}</div>
      ${s.phone ? `<div>โทร ${esc(s.phone)}</div>` : ''}
      ${s.addr ? `<div>${esc(s.addr)}</div>` : ''}
      ${s.tax ? `<div>เลขประจำตัวผู้เสียภาษี ${esc(s.tax)}</div>` : ''}
    </div>
    <hr>
    ${L('เลขที่ ' + r.no, dSlash(r.date) + ' ' + (r.time || ''))}
    <div>ลูกค้า: <b>${esc(r.name)}</b>${r.phone ? ' (' + esc(r.phone) + ')' : ''}</div>
    <hr>${lines}<hr>
    ${L('<b>รวมเป็นเงิน</b>', `<b>${fm(r.total)} บาท</b>`, 'rc-total')}
    ${pk}
    ${r.exp ? L('หมดอายุ', dSlash(r.exp)) : ''}
    <hr>
    ${s.qr ? `<div class="rc-c"><img class="rc-qr" src="${s.qr}" alt=""><div><small>สแกนเพื่อชำระเงิน</small></div></div><hr>` : ''}
    <div class="rc-c">${esc(s.foot)}</div>
  </div>`;
}

/** ข้อความสรุปสำหรับแจ้งลูกค้า (LINE / คัดลอก) */
function rcMessage(r) {
  const s = db.shop, out = [];
  out.push(`🧺 ${s.name}`, `ใบเสร็จ ${r.no} · ${dSlash(r.date)} ${r.time || ''}`, `ลูกค้า: ${r.name}`, '');
  const noPrice = isPkgOrder(r);
  r.lines.forEach(l => out.push(`• ${l.t}${l.q ? ' x' + l.q + (l.unit || '') : ''}${l.a !== '' && l.a != null && !(noPrice && !+l.a) ? ' = ' + fm(l.a) + ' บาท' : ''}${l.note ? '\n   (' + l.note + ')' : ''}`));
  out.push('', `💰 ยอดชำระ ${fm(r.total)} บาท`);
  if (r.left != null) {
    out.push('', '📦 แพ็คเกจ');
    if (r.used != null) {
      out.push(r.before < 0 ? `เกินแพ็คเกจจากรอบก่อน ${-r.before} ชิ้น` : `ยอดก่อนหน้า ${r.before} ชิ้น`, `ใช้ครั้งนี้ ${r.used} ชิ้น`);
      if (r.carried) out.push(`เกินแพ็คเกจครั้งนี้ ${r.carried} ชิ้น`);
      if (r.renewed) out.push(`เกินแพ็คเกจ ${r.overflow} ชิ้น → ต่อแพ็คเกจใหม่ ${fm(r.renewFee)} บาท`);
    } else {
      if (r.pieces) out.push(`แพ็คเกจใหม่ +${r.pieces} ชิ้น`);
      if (r.owedBefore) out.push(`หักยอดเกินจากรอบก่อน −${r.owedBefore} ชิ้น`);
      if (r.kept) out.push(`ทบยอดคงเหลือเดิม +${r.kept} ชิ้น`);
    }
    out.push(`คงเหลือ ${Math.max(0, r.left)} ชิ้น`);
    if (r.left < 0) out.push(`เกินแพ็คเกจรวม ${-r.left} ชิ้น (จะหักจากแพ็คเกจถัดไป)`);
    if (r.exp) out.push(`ใช้ได้ถึง ${dSlash(r.exp)}`);
  }
  if (r.void) out.unshift('*** ใบเสร็จนี้ถูกยกเลิกแล้ว ***');
  if (s.foot) out.push('', s.foot);
  return out.join('\n');
}

async function copyText(t) {
  try { await navigator.clipboard.writeText(t); return true; }
  catch (e) {
    const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    let ok = false; try { ok = document.execCommand('copy'); } catch (e2) { /* ignore */ }
    ta.remove(); return ok;
  }
}

function showRc(r) {
  if (!r) return toast('ไม่พบใบเสร็จ', 'error');
  const m = openModal({
    title: 'ใบเสร็จ ' + esc(r.no),
    subtitle: `${dTh(r.date)} · ${r.time || ''} น. · ${r.kind === 'pkg' ? 'ซื้อแพ็คเกจ' : 'รับผ้า'}`,
    ic: 'receipt', tone: r.void ? 'danger' : 'primary', size: 'rc',
    body: `${r.void ? `<div class="alert alert-danger">${icon('ban')}<div><b>ใบเสร็จนี้ถูกยกเลิกแล้ว</b><br><small>ยอดถูกตัดออกจากบัญชีรายรับแล้ว</small></div></div>` : ''}
      <div class="paper"><div class="paper-inner">${receiptHTML(r)}</div></div>`,
    footer: `<button class="btn btn-ghost" data-close>ปิด</button>
             <button class="btn btn-soft" data-copy>${icon('copy')}คัดลอกข้อความ</button>
             <a class="btn btn-line" href="https://line.me/R/share?text=${encodeURIComponent(rcMessage(r))}" target="_blank" rel="noopener">${icon('message')}แจ้งลูกค้าทาง LINE</a>
             <button class="btn btn-primary" data-print>${icon('printer')}พิมพ์ 80mm</button>`
  });
  m.q('[data-print]').addEventListener('click', () => printDoc(receiptHTML(r), 'rc'));
  m.q('[data-copy]').addEventListener('click', async () => toast(await copyText(rcMessage(r)) ? 'คัดลอกข้อความแล้ว วางส่งให้ลูกค้าได้เลย' : 'คัดลอกไม่สำเร็จ', 'info'));
}

async function voidRc(no) {
  const r = rcByNo(no);
  if (!r || r.void) return;
  const ok = await confirmDlg({
    title: `ยกเลิกใบเสร็จ ${esc(no)}?`, tone: 'warning', ic: 'ban', okText: 'ยกเลิกใบเสร็จ', cancelText: 'ไม่ยกเลิก',
    msg: `<p>รายการนี้จะถูก<b>ตัดออกจากยอดรายรับ</b>ในบัญชีทันที</p>
          <div class="alert alert-warning">${icon('info')}<div>ระบบจะไม่คืนยอดคงเหลือแพ็คเกจของลูกค้าให้อัตโนมัติ หากต้องการคืนยอด กรุณาแก้ไขที่หน้าลูกค้า</div></div>`
  });
  if (!ok) return;
  r.void = true; r.voidAt = new Date().toISOString();
  db.ledger = db.ledger.filter(l => l.rc != no);
  save(); render();
  toast('ยกเลิกใบเสร็จ ' + no + ' แล้ว', 'warning');
}

async function delRc(no) {
  const ok = await confirmDlg({
    title: `ลบใบเสร็จ ${esc(no)} ถาวร?`, okText: 'ลบถาวร',
    msg: '<p>การลบนี้<b>กู้คืนไม่ได้</b> และจะลบรายการรายรับที่เกี่ยวข้องในบัญชีด้วย</p>'
  });
  if (!ok) return;
  db.rc = db.rc.filter(r => r.no != no);
  db.ledger = db.ledger.filter(l => l.rc != no);
  save(); render();
  toast('ลบใบเสร็จ ' + no + ' แล้ว');
}

/* ---------- รายงานสรุป A4 ---------- */
function reportHTML(from, to) {
  const { ms, ci, co } = ledgerStats(from, to), s = db.shop;
  const sum = o => Object.values(o).reduce((a, b) => a + b, 0), I = sum(ci), O = sum(co), n = Object.keys(ms).length || 1;
  const yb = k => TH_MONTHS_FULL[+k.slice(5) - 1] + ' ' + (+k.slice(0, 4) + 543);
  const tr = (a, b, c, d, bold) => `<tr class="${bold ? 'tot' : ''}"><td>${a}</td><td class="r">${b}</td>${c != null ? `<td class="r">${c}</td><td class="r">${d}</td>` : ''}</tr>`;
  return `<div class="rp">
    <div class="rp-head">
      ${s.logo ? `<img src="${s.logo}" alt="">` : ''}
      <div><h1>รายงานสรุปรายรับ-รายจ่าย</h1>
      <div class="rp-shop"><b>${esc(s.name)}</b>${s.tax ? ' · เลขประจำตัวผู้เสียภาษี ' + esc(s.tax) : ''}${s.phone ? ' · โทร ' + esc(s.phone) : ''}</div>
      <div>ช่วงวันที่ ${dSlash(from)} ถึง ${dSlash(to)}</div></div>
    </div>
    <div class="rp-kpi">
      <div><span>รายรับรวม</span><b>${fm(I)}</b></div>
      <div><span>รายจ่ายรวม</span><b>${fm(O)}</b></div>
      <div><span>กำไรสุทธิ</span><b>${fm(I - O)}</b></div>
    </div>
    <h2>สรุปรายเดือน</h2>
    <table><thead><tr><th>เดือน</th><th class="r">รายรับ</th><th class="r">รายจ่าย</th><th class="r">สุทธิ</th></tr></thead>
    <tbody>${Object.keys(ms).map(k => { const v = ms[k]; return tr(yb(k), fm(v.i), fm(v.o), fm(v.i - v.o)); }).join('')}${tr('รวม', fm(I), fm(O), fm(I - O), 1)}</tbody></table>
    <div class="rp-2">
      <div><h2>รายรับแยกตามหมวด</h2><table><tbody>${Object.keys(ci).map(k => tr(esc(k), fm(ci[k]))).join('') || tr('-', '')}${tr('รวมรายรับ', fm(I), null, null, 1)}</tbody></table></div>
      <div><h2>รายจ่ายแยกตามหมวด</h2><table><tbody>${Object.keys(co).map(k => tr(esc(k), fm(co[k]))).join('') || tr('-', '')}${tr('รวมรายจ่าย', fm(O), null, null, 1)}</tbody></table></div>
    </div>
    <h2>ค่าเฉลี่ยต่อเดือน (${n} เดือน)</h2>
    <table><tbody>${tr('รายรับเฉลี่ย', fm(Math.round(I / n)))}${tr('รายจ่ายเฉลี่ย', fm(Math.round(O / n)))}${tr('กำไรสุทธิเฉลี่ย', fm(Math.round((I - O) / n)), null, null, 1)}</tbody></table>
    <p class="rp-foot">หน่วย: บาท · จัดทำจากบันทึกของร้าน · วันที่พิมพ์ ${dSlash(today())} (ปี พ.ศ.)</p>
  </div>`;
}

function showReport() {
  const { from, to } = state;
  const m = openModal({
    title: 'รายงานสรุปรายรับ-รายจ่าย', subtitle: `${dTh(from)} – ${dTh(to)}`, ic: 'file', size: 'lg',
    body: `<div class="a4-preview">${reportHTML(from, to)}</div>`,
    footer: `<button class="btn btn-ghost" data-close>ปิด</button>
             <button class="btn btn-primary" data-print>${icon('printer')}พิมพ์ / บันทึกเป็น PDF</button>`
  });
  m.q('[data-print]').addEventListener('click', () => printDoc(reportHTML(from, to), 'a4'));
}
