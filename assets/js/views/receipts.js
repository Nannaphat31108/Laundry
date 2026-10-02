/* ==========================================================================
   ใบเสร็จ
   ========================================================================== */
'use strict';

function rcTable() {
  const q = state.rcQ.trim().toLowerCase();
  const l = db.rc.filter(r => r.date >= state.from && r.date <= state.to && (r.no + r.name + (r.phone || '')).toLowerCase().includes(q)).slice().reverse();
  if (!l.length) return empty('receipt', 'ไม่มีใบเสร็จในช่วงนี้', 'ลองเปลี่ยนช่วงวันที่หรือคำค้นหา');
  const more = l.length - state.rcLimit;
  return `<div class="table-wrap"><table class="table resp">
    <thead><tr><th>เลขที่</th><th>วันที่</th><th>ลูกค้า</th><th>ประเภท</th><th class="r">ยอด (บาท)</th><th>สถานะ</th><th class="r">จัดการ</th></tr></thead>
    <tbody>${l.slice(0, state.rcLimit).map(r => `<tr class="${r.void ? 'is-void' : ''}">
      <td data-l="เลขที่"><span class="mono">${esc(r.no)}</span></td>
      <td data-l="วันที่">${dTh(r.date)}<small class="sub">${r.time ? r.time + ' น.' : ''}</small></td>
      <td data-l="ลูกค้า"><b>${esc(r.name)}</b></td>
      <td data-l="ประเภท">${r.kind === 'pkg' ? badge('แพ็คเกจ', 'pink', 'package') : badge('รับผ้า', 'primary', 'washer')}</td>
      <td data-l="ยอด" class="r num"><b>${fm(r.total)}</b></td>
      <td data-l="สถานะ">${r.void ? badge('ยกเลิกแล้ว', 'danger') : badge('ปกติ', 'success')}</td>
      <td class="r actions">
        <button class="btn btn-sm btn-soft" data-act="reprint" data-no="${esc(r.no)}">${icon('printer')}ดู/พิมพ์</button>
        ${r.void ? '' : `<button class="icon-btn warn" data-act="voidRc" data-no="${esc(r.no)}" title="ยกเลิกใบเสร็จ" aria-label="ยกเลิกใบเสร็จ ${esc(r.no)}">${icon('ban')}</button>`}
        <button class="icon-btn danger" data-act="delRc" data-no="${esc(r.no)}" title="ลบถาวร" aria-label="ลบใบเสร็จ ${esc(r.no)}">${icon('trash')}</button>
      </td></tr>`).join('')}</tbody></table></div>
    ${more > 0 ? `<div class="more-row"><button class="btn btn-ghost" data-act="rcMore">${icon('chevronDown')}แสดงเพิ่มอีก ${Math.min(more, 50)} ใบ (เหลือ ${more})</button></div>` : ''}`;
}
ACT.rcMore = () => { state.rcLimit += 50; renderPart('#rc-list', rcTable()); };

V.rc = {
  render() {
    const l = db.rc.filter(r => r.date >= state.from && r.date <= state.to);
    const ok = l.filter(r => !r.void);
    return `${pageHead('ใบเสร็จ', 'ดู พิมพ์ซ้ำ ยกเลิก หรือลบใบเสร็จ')}
      <div class="card">
        ${rangeBar(`<div class="search-box">${icon('search')}<input type="search" placeholder="ค้นหาเลขที่ / ชื่อลูกค้า" value="${esc(state.rcQ)}" data-input="rcSearch" aria-label="ค้นหาใบเสร็จ"></div>`)}
        <div class="mini-stats">
          <div><small>จำนวนใบเสร็จ</small><b>${l.length}</b></div>
          <div><small>ยอดรวม (ไม่รวมที่ยกเลิก)</small><b>${money(sumBy(ok, r => r.total))}</b></div>
          <div><small>รับผ้า / แพ็คเกจ</small><b>${ok.filter(r => r.kind !== 'pkg').length} / ${ok.filter(r => r.kind === 'pkg').length}</b></div>
          <div><small>ยกเลิกแล้ว</small><b>${l.length - ok.length}</b></div>
        </div>
        <div id="rc-list">${rcTable()}</div>
      </div>`;
  }
};
ACT.rcSearch = el => { state.rcQ = el.value; state.rcLimit = 50; renderPart('#rc-list', rcTable()); };
