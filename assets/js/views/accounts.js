/* ==========================================================================
   บัญชีรายรับ-รายจ่าย
   ========================================================================== */
'use strict';

function ledTable() {
  const all = db.ledger.filter(x => x.date >= state.from && x.date <= state.to).sort((a, b) => b.date.localeCompare(a.date));
  const l = state.ledFilter === 'all' ? all : all.filter(x => x.type === state.ledFilter);
  if (!l.length) return empty('wallet', 'ไม่มีรายการในช่วงนี้', 'เพิ่มรายรับหรือรายจ่ายได้จากปุ่มด้านบน');
  const more = l.length - state.ledLimit;
  return `<div class="table-wrap"><table class="table resp">
    <thead><tr><th>วันที่</th><th>รายการ</th><th>หมวดหมู่</th><th class="r">จำนวนเงิน (บาท)</th><th class="r">จัดการ</th></tr></thead>
    <tbody>${l.slice(0, state.ledLimit).map(x => `<tr>
      <td data-l="วันที่">${dTh(x.date)}</td>
      <td data-l="รายการ"><div class="led-title"><span class="led-ic ${x.type}">${icon(x.type == 'in' ? 'trendUp' : 'trendDown')}</span><span>${esc(x.title)}</span></div></td>
      <td data-l="หมวดหมู่">${badge(esc(x.cat || 'อื่นๆ'), 'neutral')}</td>
      <td data-l="จำนวนเงิน" class="r num amt-${x.type}"><b>${x.type == 'in' ? '+' : '−'}${fm(x.amt)}</b></td>
      <td class="r actions">
        ${x.rc ? `<button class="btn btn-sm btn-soft" data-act="reprint" data-no="${esc(x.rc)}">${icon('receipt')}ใบเสร็จ</button>` : ''}
        <button class="icon-btn" data-act="editLed" data-id="${x.id}" title="แก้ไข (แอดมิน)" aria-label="แก้ไขรายการ">${icon('edit')}</button>
        <button class="icon-btn danger" data-act="delLed" data-id="${x.id}" title="ลบ (แอดมิน)" aria-label="ลบรายการ">${icon('trash')}</button>
      </td></tr>`).join('')}</tbody></table></div>
    ${more > 0 ? `<div class="more-row"><button class="btn btn-ghost" data-act="ledMore">${icon('chevronDown')}แสดงเพิ่มอีก ${Math.min(more, 50)} รายการ (เหลือ ${more})</button></div>` : ''}`;
}
ACT.ledMore = () => { state.ledLimit += 50; renderPart('#led-list', ledTable()); };

function catBars(obj, color) {
  const ks = Object.keys(obj).sort((a, b) => obj[b] - obj[a]);
  if (!ks.length) return '<p class="muted small">ไม่มีข้อมูล</p>';
  const max = obj[ks[0]] || 1, tot = sumBy(ks, k => obj[k]);
  return `<div class="hbars">${ks.map(k => `<div class="hbar" title="${esc(k)}: ${money(obj[k])}">
    <div class="hbar-top"><span>${esc(k)}</span><b>${fm(obj[k])} <small>${Math.round(obj[k] / tot * 100)}%</small></b></div>
    <div class="hbar-track"><span style="width:${obj[k] / max * 100}%;background:${color}"></span></div></div>`).join('')}</div>`;
}

V.acct = {
  render() {
    const { l, ms, ci, co } = ledgerStats(state.from, state.to);
    const I = sumBy(l.filter(x => x.type == 'in'), x => x.amt), O = sumBy(l.filter(x => x.type == 'out'), x => x.amt), N = I - O;
    const keys = Object.keys(ms);
    const shown = keys.slice(-12);
    const chart = columnChart({
      label: 'รายรับและรายจ่ายรายเดือน', height: 220,
      cats: shown.map(k => ({ label: monthLabel(k), full: TH_MONTHS_FULL[+k.slice(5) - 1] + ' ' + (+k.slice(0, 4) + 543) })),
      series: [
        { name: 'รายรับ', color: 'var(--c-income)', data: shown.map(k => ms[k].i), labelAt: i => i === shown.length - 1 },
        { name: 'รายจ่าย', color: 'var(--c-expense)', data: shown.map(k => ms[k].o) }
      ]
    });
    const tabs = [['all', 'ทั้งหมด', l.length], ['in', 'รายรับ', l.filter(x => x.type == 'in').length], ['out', 'รายจ่าย', l.filter(x => x.type == 'out').length]];
    return `${pageHead('บัญชี', 'รายรับ-รายจ่ายของร้าน พร้อมส่งออกและพิมพ์รายงาน',
      `<button class="btn btn-success" data-act="addLed" data-t="in">${icon('plus')}รายรับ</button>
       <button class="btn btn-danger" data-act="addLed" data-t="out">${icon('minus')}รายจ่าย</button>`)}
      <div class="card">
        ${rangeBar(`<div class="toolbar-end"><button class="btn btn-soft btn-sm" data-act="csv">${icon('sheet')}ส่งออก Excel (CSV)</button><button class="btn btn-soft btn-sm" data-act="report">${icon('file')}รายงานสรุป (พิมพ์/PDF)</button></div>`)}
      </div>
      <section class="stat-grid three">
        <div class="stat big"><span class="stat-ic tone-green">${icon('trendUp')}</span><div><small>รายรับ</small><b class="pos">${fm(I)}</b></div></div>
        <div class="stat big"><span class="stat-ic tone-rose">${icon('trendDown')}</span><div><small>รายจ่าย</small><b class="neg">${fm(O)}</b></div></div>
        <div class="stat big"><span class="stat-ic tone-indigo">${icon('coins')}</span><div><small>คงเหลือสุทธิ</small><b>${fm(N)}</b>${I ? `<em class="${N >= 0 ? 'up' : 'down'}">อัตรากำไร ${Math.round(N / I * 100)}%</em>` : ''}</div></div>
      </section>
      <section class="split wide-left">
        <div class="card">
          <div class="card-head"><div><h2>รายรับ-รายจ่ายรายเดือน</h2><p>${keys.length > 12 ? '12 เดือนล่าสุดของช่วงที่เลือก' : dTh(state.from) + ' – ' + dTh(state.to)}</p></div>
            <div class="legend"><span><i style="background:var(--c-income)"></i>รายรับ</span><span><i style="background:var(--c-expense)"></i>รายจ่าย</span></div></div>
          ${chart}
        </div>
        <div class="card">
          <div class="card-head"><div><h2>แยกตามหมวดหมู่</h2><p>สัดส่วนในช่วงที่เลือก</p></div></div>
          <h3 class="mini-h">รายรับ</h3>${catBars(ci, 'var(--c-income)')}
          <h3 class="mini-h">รายจ่าย</h3>${catBars(co, 'var(--c-expense)')}
        </div>
      </section>
      <div class="card">
        <div class="card-head"><div><h2>รายการบัญชี</h2></div>
          <div class="seg" id="led-tabs">${tabs.map(([k, t, n]) => `<button class="${state.ledFilter === k ? 'on' : ''}" data-act="ledFilter" data-k="${k}">${t} <span>${n}</span></button>`).join('')}</div></div>
        <div id="led-list">${ledTable()}</div>
      </div>`;
  }
};

ACT.ledFilter = el => { state.ledFilter = el.dataset.k; state.ledLimit = 50; $$('#led-tabs button').forEach(b => b.classList.toggle('on', b === el)); renderPart('#led-list', ledTable()); };
ACT.report = () => showReport();

ACT.addLed = el => {
  const t = el.dataset.t;
  formDlg({
    title: t == 'in' ? 'เพิ่มรายรับ' : 'เพิ่มรายจ่าย', ic: t == 'in' ? 'trendUp' : 'trendDown', tone: t == 'in' ? 'green' : 'danger',
    fields: [
      { k: 'title', l: 'รายการ', req: true, ph: t == 'in' ? 'เช่น ค่าบริการเพิ่มเติม' : 'เช่น ซื้อน้ำยาปรับผ้านุ่ม' },
      { k: 'cat', l: 'หมวดหมู่', t: 'select', o: t == 'in' ? CAT_IN_LIST() : CAT_OUT_LIST(), half: true },
      { k: 'date', l: 'วันที่', t: 'date', half: true },
      { k: 'amt', l: 'จำนวนเงิน', t: 'number', suffix: 'บาท', req: true }
    ],
    values: { date: today() }, okText: 'บันทึก',
    onOk: o => {
      if (!o.title) return { k: 'title', msg: 'กรุณาใส่รายการ' };
      if (!(o.amt > 0)) return { k: 'amt', msg: 'กรุณาใส่จำนวนเงิน' };
      if (!o.date) o.date = today();
      db.ledger.push({ id: uid(), type: t, ...o });
      save(); render(); toast(t == 'in' ? 'บันทึกรายรับแล้ว' : 'บันทึกรายจ่ายแล้ว');
    }
  });
};

ACT.delLed = adminOnly(async el => {
  const x = db.ledger.find(l => l.id == el.dataset.id); if (!x) return;
  if (!await confirmDlg({ title: 'ลบรายการนี้?', msg: `<p>${esc(x.title)} · ${money(x.amt)}</p>`, okText: 'ลบรายการ' })) return;
  db.ledger = db.ledger.filter(l => l.id != x.id);
  save(); render(); toast('ลบรายการแล้ว');
});

ACT.editLed = adminOnly(el => {
  const x = db.ledger.find(l => l.id == el.dataset.id); if (!x) return;
  formDlg({
    title: 'แก้ไขรายการบัญชี', subtitle: x.rc ? 'ผูกกับใบเสร็จ ' + esc(x.rc) : '', ic: 'edit', tone: x.type == 'in' ? 'green' : 'danger',
    fields: [
      { k: 'type', l: 'ประเภท', t: 'select', o: [['in', 'รายรับ'], ['out', 'รายจ่าย']], half: true },
      { k: 'date', l: 'วันที่', t: 'date', half: true },
      { k: 'title', l: 'รายการ', req: true },
      { k: 'cat', l: 'หมวดหมู่', t: 'select', o: [...new Set([...CAT_IN_LIST(), ...CAT_OUT_LIST(), x.cat || 'อื่นๆ'])], half: true },
      { k: 'amt', l: 'จำนวนเงิน', t: 'number', suffix: 'บาท', req: true, half: true }
    ],
    values: x, okText: 'บันทึก',
    onOk: o => {
      if (!o.title) return { k: 'title', msg: 'กรุณาใส่รายการ' };
      if (!(o.amt > 0)) return { k: 'amt', msg: 'กรุณาใส่จำนวนเงิน' };
      if (!o.date) o.date = x.date;
      Object.assign(x, o);
      save(); render(); toast('แก้ไขรายการบัญชีแล้ว');
    }
  });
});

ACT.csv = () => {
  const { l } = ledgerStats(state.from, state.to), e = v => '"' + String(v ?? '').replace(/"/g, '""') + '"';
  const rows = [['วันที่', 'เลขที่ใบเสร็จ', 'ประเภท', 'หมวดหมู่', 'รายการ', 'รายรับ', 'รายจ่าย']]
    .concat(l.slice().sort((a, b) => a.date.localeCompare(b.date)).map(x => [dSlash(x.date), x.rc || '', x.type == 'in' ? 'รายรับ' : 'รายจ่าย', x.cat || '', x.title, x.type == 'in' ? x.amt : '', x.type == 'out' ? x.amt : '']));
  download('accounts_' + state.from + '_to_' + state.to + '.csv', new Blob(['﻿' + rows.map(r => r.map(e).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
  toast('ส่งออกไฟล์ CSV แล้ว (' + l.length + ' รายการ)');
};
