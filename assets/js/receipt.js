/* ==========================================================================
   ใบเสร็จ 80mm + รายงานสรุป A4
   ========================================================================== */
'use strict';

/** บิลรับผ้าของลูกค้าแพ็คเกจ */
const isPkgOrder = r => r.kind !== 'pkg' && r.left != null;

/**
 * โครงสร้างใบเสร็จ (ใช้ร่วมกันทั้งหน้าจอ, พิมพ์ผ่านเบราว์เซอร์ และพิมพ์ตรงเครื่องพิมพ์ความร้อน)
 * แถว: hr | c (กลาง) | lr (ซ้าย-ขวา) | note | img
 */
function receiptRows(r) {
  const s = db.shop, R = [];
  const lr = (l, rt = '', o = {}) => R.push(Object.assign({ t: 'lr', l, r: rt }, o));
  const hideZero = isPkgOrder(r) && !cfg().showPkgAmt;
  if (r.void) R.push({ t: 'c', text: '*** ใบเสร็จนี้ถูกยกเลิกแล้ว ***', bold: true });
  if (s.logo) R.push({ t: 'img', src: s.logo, w: 40, h: 22 });
  R.push({ t: 'c', text: s.name, bold: true, size: 'lg' });
  if (s.phone) R.push({ t: 'c', text: 'โทร ' + s.phone });
  if (s.addr) R.push({ t: 'c', text: s.addr });
  if (s.tax) R.push({ t: 'c', text: 'เลขประจำตัวผู้เสียภาษี ' + s.tax });
  R.push({ t: 'hr' });
  lr('เลขที่ ' + r.no, dSlash(r.date) + ' ' + (r.time || ''));
  lr('ลูกค้า: ' + r.name + (r.phone ? ' (' + r.phone + ')' : ''));
  R.push({ t: 'hr' });
  r.lines.forEach(l => {
    const showAmt = l.a !== '' && !(hideZero && !+l.a);
    lr(`${l.t}${l.q ? ' x' + l.q + (l.unit || '') : ''}`, l.price != null && cfg().showUnitPrice ? '@' + fm(l.price) : '');
    if (l.note || showAmt) lr(l.note || '', showAmt ? fm(l.a) + ' บาท' : '', { small: true });
  });
  R.push({ t: 'hr' });
  lr('รวมเป็นเงิน', fm(r.total) + ' บาท', { bold: true, size: 'md' });
  if (r.left != null) {
    if (r.used != null) {
      r.before < 0 ? lr('เกินแพ็คเกจจากรอบก่อน', -r.before + ' ชิ้น') : lr('ยอดคงเหลือก่อนหน้า', r.before + ' ชิ้น');
      lr('ใช้จากแพ็คเกจ', r.used + ' ชิ้น');
      if (r.renewed) { lr('เกินแพ็คเกจเดิม', r.overflow + ' ชิ้น'); lr('ค่าต่อแพ็คเกจใหม่', fm(r.renewFee) + ' บาท'); }
      if (r.carried) lr('เกินแพ็คเกจครั้งนี้', r.carried + ' ชิ้น');
    } else {
      if (r.pieces) lr('แพ็คเกจใหม่', '+' + r.pieces + ' ชิ้น');
      if (r.owedBefore) lr('หักยอดเกินจากรอบก่อน', '−' + r.owedBefore + ' ชิ้น');
      if (r.kept) lr('ทบยอดคงเหลือเดิม', '+' + r.kept + ' ชิ้น');
    }
    lr(r.used != null ? 'คงเหลือ' + (r.renewed ? 'หลังต่อแพ็คเกจ' : '') : 'แพ็คเกจคงเหลือ', Math.max(0, r.left) + ' ชิ้น', { bold: true });
    if (r.left < 0) { lr('เกินแพ็คเกจรวม', -r.left + ' ชิ้น', { bold: true }); R.push({ t: 'note', text: '* ส่วนที่เกินแพ็คเกจจะหักจากแพ็คเกจถัดไป' }); }
  }
  if (r.exp) lr('หมดอายุ', dSlash(r.exp));
  R.push({ t: 'hr' });
  if (s.qr) { R.push({ t: 'img', src: s.qr, w: 40, h: 40 }); R.push({ t: 'c', text: 'สแกนเพื่อชำระเงิน', small: true }); R.push({ t: 'hr' }); }
  if (s.foot) R.push({ t: 'c', text: s.foot });
  return R;
}

function receiptHTML(r) {
  const body = receiptRows(r).map(x => {
    if (x.t === 'hr') return '<hr>';
    if (x.t === 'img') return `<div class="rc-c"><img class="${x.h > 30 ? 'rc-qr' : 'rc-logo'}" src="${x.src}" alt=""></div>`;
    if (x.t === 'note') return `<div class="rc-note">${esc(x.text)}</div>`;
    const cls = [x.bold && 'b', x.size && 'sz-' + x.size, x.small && 'sm'].filter(Boolean).join(' ');
    if (x.t === 'c') return `<div class="rc-c ${cls}">${esc(x.text)}</div>`;
    return `<div class="rc-l ${cls}"><span>${esc(x.l)}</span><span>${esc(x.r)}</span></div>`;
  }).join('');
  return `<div class="rc">${body}</div>`;
}

/** ข้อความสรุปสำหรับแจ้งลูกค้า (LINE / คัดลอก) */
function rcMessage(r) {
  const s = db.shop, out = [];
  out.push(`🧺 ${s.name}`, `ใบเสร็จ ${r.no} · ${dSlash(r.date)} ${r.time || ''}`, `ลูกค้า: ${r.name}`, '');
  const hideZero = isPkgOrder(r) && !cfg().showPkgAmt;
  r.lines.forEach(l => out.push(`• ${l.t}${l.q ? ' x' + l.q + (l.unit || '') : ''}${l.a !== '' && l.a != null && !(hideZero && !+l.a) ? ' = ' + fm(l.a) + ' บาท' : ''}${l.note ? '\n   (' + l.note + ')' : ''}`));
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

/** หลังออกใบเสร็จใหม่: แสดงใบเสร็จ และพิมพ์อัตโนมัติถ้าเปิดไว้ */
function issueRc(r) {
  showRc(r);
  if (prn().auto) printReceipt(r);
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
             <button class="btn btn-primary" data-print>${icon(prn().mode === 'image' ? 'image' : 'printer')}${prn().mode === 'image' ? 'บันทึกรูปใบเสร็จ' : 'พิมพ์ใบเสร็จ'}</button>`
  });
  m.q('[data-print]').addEventListener('click', () => printReceipt(r));
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
