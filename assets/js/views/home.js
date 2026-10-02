/* ==========================================================================
   หน้าหลัก (Dashboard)
   ========================================================================== */
'use strict';

function niceMax(v) {
  if (!(v > 0)) return 100;
  const p = Math.pow(10, Math.floor(Math.log10(v)));
  for (const s of [1, 2, 2.5, 5, 10]) if (s * p >= v) return s * p;
  return 10 * p;
}

/** กราฟแท่งแนวตั้ง (series เดียวหรือหลาย series) แบบ HTML พร้อม tooltip */
function columnChart({ cats, series, height = 200, label = '' }) {
  const max = niceMax(Math.max(0, ...series.flatMap(s => s.data)));
  const ticks = [0, .25, .5, .75, 1].map(f => max * f);
  const multi = series.length > 1;
  const fmtK = n => n >= 1000 ? fm(Math.round(n / 100) / 10) + 'k' : fm(n);
  const cols = cats.map((c, i) => {
    const tip = `<b>${c.full || c.label}</b>${series.map(s => `<span><i style="background:${s.color}"></i>${s.name}<em>${money(s.data[i])}</em></span>`).join('')}`;
    const bars = series.map(s => {
      const v = s.data[i], h = v > 0 ? Math.max(2, v / max * 100) : 0;
      return `<span class="cc-bar" style="height:${h}%;--c:${s.color}">${s.labelAt && s.labelAt(i) && v > 0 ? `<em class="cc-val">${fmtK(v)}</em>` : ''}</span>`;
    }).join('');
    return `<div class="cc-col ${c.hl ? 'hl' : ''}" tabindex="0"><div class="cc-bars ${multi ? 'multi' : ''}">${bars}</div>
      <div class="cc-tip" role="tooltip">${tip}</div><span class="cc-x">${c.label}</span></div>`;
  }).join('');
  return `<div class="cc" style="--h:${height}px" role="img" aria-label="${esc(label)}">
    <div class="cc-y">${ticks.slice().reverse().map(t => `<span>${fmtK(t)}</span>`).join('')}</div>
    <div class="cc-plot"><div class="cc-grid">${ticks.map(() => '<i></i>').join('')}</div><div class="cc-cols">${cols}</div></div>
  </div>`;
}

function followItem(c) {
  const st = pkgStatus(c), p = pkgById(c.pkgId), total = p ? p.pieces : Math.max(c.left, 1);
  const pct = Math.max(0, Math.min(100, c.left / total * 100));
  const dl = daysBetween(today(), c.exp);
  return `<div class="follow">
    ${avatar(c)}
    <div class="follow-main">
      <div class="follow-top"><b>${esc(c.name)}</b>${badge(st.label, st.tone)}</div>
      <div class="follow-sub">${esc(c.pkgName)} · ${dl < 0 ? 'หมดอายุแล้ว ' + Math.abs(dl) + ' วัน' : dl === 0 ? 'หมดอายุวันนี้' : 'หมดอายุใน ' + dl + ' วัน'} (${dTh(c.exp)})</div>
      <div class="meter ${st.tone}"><span style="width:${pct}%"></span></div>
      <div class="follow-meta"><span>${c.left < 0 ? `<b class="owed">เกิน ${-c.left} ชิ้น</b> · หักจากแพ็คเกจถัดไป` : `เหลือ <b>${c.left}</b> / ${total} ชิ้น`}</span></div>
    </div>
    <button class="btn btn-soft btn-sm" data-act="buyPkg" data-id="${c.id}">${icon('refresh')}ต่อแพ็คเกจ</button>
  </div>`;
}

function rcRow(r) {
  return `<div class="rc-row ${r.void ? 'is-void' : ''}">
    <span class="rc-row-ic ${r.kind === 'pkg' ? 'pink' : 'indigo'}">${icon(r.kind === 'pkg' ? 'package' : 'washer')}</span>
    <div class="rc-row-main"><b>${esc(r.name)}</b><small>${esc(r.no)} · ${dTh(r.date)} ${r.time || ''}</small></div>
    ${r.void ? badge('ยกเลิกแล้ว', 'danger') : ''}
    <span class="rc-row-amt">${money(r.total)}</span>
    <button class="icon-btn" data-act="reprint" data-no="${esc(r.no)}" title="ดู / พิมพ์" aria-label="ดูใบเสร็จ ${esc(r.no)}">${icon('eye')}</button>
  </div>`;
}

V.home = {
  render() {
    const t = today();
    const incOf = d => sumBy(db.ledger.filter(l => l.date == d && l.type == 'in'), l => l.amt);
    const inc = incOf(t), incY = incOf(addDays(-1));
    const bills = db.rc.filter(r => r.date == t && r.kind == 'order' && !r.void).length;
    const actives = db.customers.filter(active).length;
    const low = db.customers.filter(needsFollow).sort((a, b) => a.exp.localeCompare(b.exp));
    const rec = db.rc.slice(-6).reverse();
    const h = new Date().getHours();
    const greet = h < 12 ? 'สวัสดีตอนเช้า' : h < 17 ? 'สวัสดีตอนบ่าย' : 'สวัสดีตอนเย็น';
    const diff = inc - incY;

    const days = Array.from({ length: 7 }, (_, i) => addDays(i - 6));
    const chart = columnChart({
      label: 'รายรับ 7 วันล่าสุด',
      cats: days.map(d => { const dd = parseD(d); return { label: d === t ? 'วันนี้' : TH_DAYS[dd.getDay()].slice(0, 2) + '.', full: dTh(d), hl: d === t }; }),
      series: [{ name: 'รายรับ', color: 'var(--c-income)', data: days.map(incOf), labelAt: i => i === 6 }]
    });
    const week = sumBy(days, incOf);

    const age = backupAge();
    const backupTip = age == null || age > 7
      ? `<div class="alert alert-info slim">${icon('shield')}<div>ข้อมูลทั้งหมดอยู่ในเครื่องนี้ ${age == null ? 'และยังไม่เคยสำรองข้อมูล' : 'สำรองล่าสุด ' + age + ' วันก่อน'} — แนะนำให้สำรองสัปดาห์ละครั้ง</div><button class="btn btn-sm btn-soft" data-act="backup">${icon('download')}สำรองเลย</button></div>` : '';

    const qa = [
      ['order', 'รับผ้า / คิดเงิน', 'บันทึกรายการและออกใบเสร็จ', 'washer', 'indigo'],
      ['cust', 'ลูกค้า / ต่อแพ็คเกจ', 'ค้นหา เพิ่ม และต่ออายุสมาชิก', 'users', 'green'],
      ['acct', 'บัญชี', 'รายรับ รายจ่าย และรายงาน', 'wallet', 'amber'],
      ['pkg', 'แพ็คเกจ', 'ตั้งราคาแพ็คเกจรายเดือน', 'package', 'pink']
    ];

    return `
      <section class="hero">
        <div class="hero-bubbles" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
        <div class="hero-text">
          <span class="hero-eyebrow">${icon('sparkles')}${greet}</span>
          <h1>${esc(db.shop.name)}</h1>
          <p>${dLong()}</p>
          <div class="hero-actions">
            <a class="btn btn-white" href="#/order">${icon('plus')}รับผ้าใหม่</a>
            <a class="btn btn-glass" href="#/rc">${icon('receipt')}ใบเสร็จทั้งหมด</a>
          </div>
        </div>
        <div class="hero-kpi">
          <span>รายรับวันนี้</span>
          <b>${money(inc)}</b>
          <small class="${diff >= 0 ? 'up' : 'down'}">${icon(diff >= 0 ? 'trendUp' : 'trendDown')}${diff === 0 ? 'เท่ากับเมื่อวาน' : (diff > 0 ? 'มากกว่า' : 'น้อยกว่า') + 'เมื่อวาน ' + money(Math.abs(diff))}</small>
        </div>
      </section>

      ${backupTip}

      <section class="qa-grid">
        ${qa.map(([k, l, d, ic, tone]) => `<a class="qa qa-${tone}" href="#/${k}"><span class="qa-ic">${icon(ic)}</span><span class="qa-text"><b>${l}</b><small>${d}</small></span><span class="qa-go">${icon('arrowRight')}</span></a>`).join('')}
      </section>

      <section class="stat-grid">
        <div class="stat"><span class="stat-ic tone-indigo">${icon('coins')}</span><div><small>รายรับวันนี้ (บาท)</small><b>${fm(inc)}</b></div></div>
        <div class="stat"><span class="stat-ic tone-cyan">${icon('receipt')}</span><div><small>บิลรับผ้าวันนี้</small><b>${bills}</b></div></div>
        <div class="stat"><span class="stat-ic tone-green">${icon('users')}</span><div><small>ลูกค้าแพ็คเกจที่ใช้งานอยู่</small><b>${actives}</b></div></div>
        <div class="stat"><span class="stat-ic tone-amber">${icon('bell')}</span><div><small>ใกล้หมด / ใกล้หมดอายุ</small><b>${low.length}</b></div></div>
      </section>

      <section class="split">
        <div class="card">
          <div class="card-head"><div><h2>รายรับ 7 วันล่าสุด</h2><p>รวม ${money(week)}</p></div><a class="link" href="#/acct">ดูบัญชี ${icon('chevronRight')}</a></div>
          ${chart}
        </div>
        <div class="card">
          <div class="card-head"><div><h2>ต้องติดตาม</h2><p>แพ็คเกจเหลือ ≤ 5 ชิ้น หรือหมดอายุภายใน 3 วัน</p></div>${low.length ? `<span class="count-pill">${low.length}</span>` : ''}</div>
          ${low.length ? `<div class="follow-list">${low.map(followItem).join('')}</div>` : empty('checkCircle', 'ไม่มีรายการต้องติดตาม', 'ลูกค้าแพ็คเกจทุกคนยังมียอดคงเหลือเพียงพอ')}
        </div>
      </section>

      <section class="card">
        <div class="card-head"><div><h2>ใบเสร็จล่าสุด</h2><p>6 รายการล่าสุด</p></div><a class="link" href="#/rc">ดูทั้งหมด / ยกเลิก-ลบ ${icon('chevronRight')}</a></div>
        ${rec.length ? `<div class="rc-list">${rec.map(rcRow).join('')}</div>` : empty('receipt', 'ยังไม่มีใบเสร็จ', 'เริ่มรับผ้ารายการแรกได้เลย', `<a class="btn btn-primary" href="#/order">${icon('plus')}รับผ้าใหม่</a>`)}
      </section>`;
  }
};
