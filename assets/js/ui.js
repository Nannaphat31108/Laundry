/* ==========================================================================
   UI kit: modal, form, confirm, toast, print, helpers
   ========================================================================== */
'use strict';

/* ---------- toast ---------- */
function toast(msg, type = 'success', ms = 2600) {
  const box = $('#toasts');
  if (!box) return;
  const ic = { success: 'checkCircle', error: 'alert', info: 'info', warning: 'alert' }[type] || 'info';
  const t = document.createElement('div');
  t.className = `toast toast-${type}`;
  t.innerHTML = `<span class="toast-ic">${icon(ic)}</span><span class="toast-msg">${esc(msg)}</span>`;
  box.appendChild(t);
  requestAnimationFrame(() => t.classList.add('in'));
  setTimeout(() => { t.classList.remove('in'); t.addEventListener('transitionend', () => t.remove(), { once: true }); setTimeout(() => t.remove(), 400); }, ms);
}

/* ---------- modal ---------- */
const modalStack = [];

function openModal({ title = '', subtitle = '', ic = '', tone = 'primary', body = '', footer = '', size = 'md', cls = '', onClose } = {}) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `
    <div class="modal-backdrop" data-close></div>
    <div class="modal modal-${size} ${cls}" role="dialog" aria-modal="true" ${title ? 'aria-labelledby="mt-' + modalStack.length + '"' : ''}>
      ${title ? `<div class="modal-head">
        ${ic ? `<span class="modal-ic tone-${tone}">${icon(ic)}</span>` : ''}
        <div class="modal-titles"><h2 id="mt-${modalStack.length}">${title}</h2>${subtitle ? `<p>${subtitle}</p>` : ''}</div>
        <button class="icon-btn modal-x" data-close aria-label="ปิด">${icon('x')}</button>
      </div>` : ''}
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
    </div>`;
  const api = {
    el: wrap,
    q: s => wrap.querySelector(s),
    close() {
      if (api.closed) return;
      api.closed = true;
      const i = modalStack.indexOf(api);
      if (i > -1) modalStack.splice(i, 1);
      wrap.classList.remove('in');
      wrap.classList.add('out');
      setTimeout(() => wrap.remove(), 180);
      if (!modalStack.length) document.body.classList.remove('modal-open');
      api.prevFocus && api.prevFocus.focus && api.prevFocus.focus({ preventScroll: true });
      onClose && onClose();
    }
  };
  api.prevFocus = document.activeElement;
  wrap.addEventListener('click', e => { if (e.target.closest('[data-close]')) api.close(); });
  $('#layer').appendChild(wrap);
  modalStack.push(api);
  document.body.classList.add('modal-open');
  requestAnimationFrame(() => {
    wrap.classList.add('in');
    const f = wrap.querySelector('[autofocus], .modal-body input:not([type=checkbox]):not([type=file]), .modal-body select');
    (f || wrap.querySelector('.modal')).focus({ preventScroll: true });
  });
  return api;
}

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && modalStack.length) { e.preventDefault(); modalStack[modalStack.length - 1].close(); }
});

/* ---------- confirm ---------- */
function confirmDlg({ title, msg = '', okText = 'ยืนยัน', cancelText = 'ยกเลิก', tone = 'danger', ic } = {}) {
  return new Promise(res => {
    let done = false;
    const m = openModal({
      size: 'sm', cls: 'modal-confirm',
      body: `<div class="confirm">
        <span class="confirm-ic tone-${tone}">${icon(ic || (tone === 'danger' ? 'trash' : tone === 'warning' ? 'alert' : 'info'))}</span>
        <h2>${title}</h2>${msg ? `<div class="confirm-msg">${msg}</div>` : ''}</div>`,
      footer: `<button class="btn btn-ghost" data-close>${cancelText}</button>
               <button class="btn btn-${tone === 'primary' ? 'primary' : tone}" data-ok>${okText}</button>`,
      onClose: () => { if (!done) res(false); }
    });
    m.q('[data-ok]').addEventListener('click', () => { done = true; res(true); m.close(); });
    setTimeout(() => m.q('[data-ok]').focus(), 30);
  });
}

/* ---------- form ---------- */
/**
 * fields: [{k, l, t:'text'|'tel'|'number'|'date'|'select'|'textarea', o:[options], ph, hint, req, suffix, min, step, half}]
 * onOk(values) → คืน {k, msg} หรือข้อความ เพื่อแสดงข้อผิดพลาดและไม่ปิดหน้าต่าง
 */
function formDlg({ title, subtitle = '', ic = 'edit', tone = 'primary', fields, values = {}, okText = 'บันทึก', onOk, danger, intro = '' }) {
  const fid = 'f' + uid();
  const fieldHTML = f => {
    const v = values[f.k] ?? '';
    const id = fid + '-' + f.k;
    let ctl;
    if (f.t === 'select') ctl = `<select id="${id}" data-k="${f.k}">${f.o.map(o => `<option ${o == v ? 'selected' : ''}>${esc(o)}</option>`).join('')}</select>`;
    else if (f.t === 'textarea') ctl = `<textarea id="${id}" data-k="${f.k}" rows="3" placeholder="${esc(f.ph || '')}">${esc(v)}</textarea>`;
    else ctl = `<input id="${id}" data-k="${f.k}" type="${f.t || 'text'}" value="${esc(v)}" placeholder="${esc(f.ph || '')}"
      ${f.t === 'number' ? `inputmode="decimal" min="${f.min ?? 0}" step="${f.step ?? 'any'}"` : ''} ${f.t === 'tel' ? 'inputmode="tel"' : ''} autocomplete="off">`;
    if (f.suffix) ctl = `<div class="input-affix">${ctl}<span class="affix">${f.suffix}</span></div>`;
    return `<div class="field ${f.half ? 'half' : ''}" data-field="${f.k}">
      <label for="${id}">${f.l}${f.req ? ' <span class="req">*</span>' : ''}</label>${ctl}
      ${f.hint ? `<div class="hint">${f.hint}</div>` : ''}<div class="err"></div></div>`;
  };
  const m = openModal({
    title, subtitle, ic, tone,
    body: `${intro}<form class="form-grid" id="${fid}" novalidate>${fields.map(fieldHTML).join('')}<button type="submit" hidden></button></form>`,
    footer: `${danger ? `<button class="btn btn-danger-soft" data-danger>${icon('trash')}${danger.text}</button><span class="grow"></span>` : ''}
             <button class="btn btn-ghost" data-close>ยกเลิก</button>
             <button class="btn btn-primary" data-ok>${icon('check')}${okText}</button>`
  });
  const form = m.q('form');
  const submit = () => {
    $$('.field', form).forEach(f => f.classList.remove('invalid'));
    const o = {};
    $$('[data-k]', form).forEach(e => { o[e.dataset.k] = e.type === 'number' ? (e.value === '' ? NaN : +e.value) : e.value.trim(); });
    for (const f of fields) {
      if (f.req && (o[f.k] === '' || (f.t === 'number' && !(o[f.k] > 0)))) return showErr(f.k, f.t === 'number' ? 'กรุณาใส่ตัวเลขที่มากกว่า 0' : 'กรุณากรอกข้อมูลช่องนี้');
      if (f.t === 'number' && Number.isNaN(o[f.k])) o[f.k] = 0;
    }
    const r = onOk(o);
    if (r && typeof r === 'object') return showErr(r.k, r.msg);
    if (typeof r === 'string') return toast(r, 'error');
    if (r === false) return;
    m.close();
  };
  const showErr = (k, msg) => {
    const f = form.querySelector(`[data-field="${k}"]`);
    if (!f) return toast(msg, 'error');
    f.classList.add('invalid');
    f.querySelector('.err').textContent = msg;
    const inp = f.querySelector('[data-k]');
    inp && inp.focus();
  };
  form.addEventListener('submit', e => { e.preventDefault(); submit(); });
  form.addEventListener('input', e => { const f = e.target.closest('.field'); f && f.classList.remove('invalid'); });
  m.q('[data-ok]').addEventListener('click', submit);
  if (danger) m.q('[data-danger]').addEventListener('click', () => danger.onClick(m));
  return m;
}

/* ---------- print ---------- */
function printDoc(html, kind) {
  const root = $('#print-root');
  root.innerHTML = html;
  const st = document.createElement('style');
  st.textContent = kind === 'a4' ? '@page{size:A4;margin:14mm}' : '@page{size:80mm auto;margin:2mm}';
  document.head.appendChild(st);
  document.body.classList.add('printing', 'print-' + kind);
  let cleaned = false;
  const clean = () => { if (cleaned) return; cleaned = true; st.remove(); root.innerHTML = ''; document.body.classList.remove('printing', 'print-' + kind); };
  window.addEventListener('afterprint', clean, { once: true });
  // รอให้รูป (โลโก้/QR) โหลดเสร็จก่อนสั่งพิมพ์
  const imgs = $$('img', root).filter(i => !i.complete);
  Promise.all(imgs.map(i => new Promise(r => { i.onload = i.onerror = r; }))).then(() => {
    setTimeout(() => { window.print(); setTimeout(clean, 1500); }, 60);
  });
}

/* ---------- helpers ---------- */
function imgToDataURL(file, maxW) {
  return new Promise((res, rej) => {
    const rd = new FileReader();
    rd.onerror = rej;
    rd.onload = () => {
      const im = new Image();
      im.onerror = rej;
      im.onload = () => {
        const k = Math.min(1, maxW / im.width), c = document.createElement('canvas');
        c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
        const x = c.getContext('2d');
        x.fillStyle = '#fff'; x.fillRect(0, 0, c.width, c.height);
        x.drawImage(im, 0, 0, c.width, c.height);
        res(c.toDataURL('image/png'));
      };
      im.src = rd.result;
    };
    rd.readAsDataURL(file);
  });
}

function download(name, blob) {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 500);
}

const empty = (ic, title, text = '', action = '') => `
  <div class="empty">
    <div class="empty-art"><span>${icon(ic)}</span></div>
    <h3>${title}</h3>${text ? `<p>${text}</p>` : ''}${action}
  </div>`;

const badge = (text, tone = 'neutral', ic = '') => `<span class="badge badge-${tone}">${ic ? icon(ic) : '<i class="dot"></i>'}${text}</span>`;

const avatar = (c, size = '') => `<span class="avatar ${size} av-${avatarTone(c ? c.id : 'walkin')}">${c ? esc(initials(c.name)) : icon('user')}</span>`;

const pageHead = (title, sub = '', actions = '') => `
  <div class="page-head">
    <div><h1>${title}</h1>${sub ? `<p class="page-sub">${sub}</p>` : ''}</div>
    ${actions ? `<div class="page-actions">${actions}</div>` : ''}
  </div>`;

/** ตัวเลือกช่วงวันที่ (ใช้ร่วมกันในหน้าใบเสร็จและบัญชี) */
function rangeBar(extra = '') {
  const chips = [[1, 'เดือนนี้'], [3, '3 เดือน'], [12, '12 เดือน']].map(([n, l]) => {
    const [f, t] = monthRange(n);
    return `<button class="chip ${state.from === f && state.to === t ? 'on' : ''}" data-act="range" data-n="${n}">${l}</button>`;
  }).join('');
  return `<div class="toolbar">
    <div class="range">
      <label class="date-field"><span>ตั้งแต่</span><input type="date" value="${state.from}" max="${state.to}" data-change="setFrom"></label>
      <span class="range-sep">${icon('arrowRight')}</span>
      <label class="date-field"><span>ถึง</span><input type="date" value="${state.to}" min="${state.from}" data-change="setTo"></label>
    </div>
    <div class="chips">${chips}</div>
    ${extra}
  </div>`;
}
