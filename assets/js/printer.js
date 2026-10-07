/* ==========================================================================
   เครื่องพิมพ์ใบเสร็จความร้อน (ทดสอบตามสเปก Xprinter XP-N160II: 80mm, 203dpi, 576 จุด, ESC/POS)
   ใบเสร็จถูกวาดเป็นรูปภาพก่อนส่ง (raster) จึงพิมพ์ภาษาไทยได้ถูกต้อง
   ไม่ต้องพึ่งชุดอักษรไทยในเครื่องพิมพ์

   วิธีพิมพ์:
   - browser : หน้าต่างพิมพ์ของเบราว์เซอร์ (คอมพิวเตอร์ที่ติดตั้งไดรเวอร์ Xprinter)
   - ble     : ส่งตรงผ่าน Bluetooth LE (Web Bluetooth: Chrome บน Android) ไม่ต้องติดตั้งแอป
   - usb     : ส่งตรงผ่าน USB (WebUSB: Chrome/Edge บนคอมพิวเตอร์ หรือแท็บเล็ต/มือถือ Android ต่อสาย OTG)
   - serial  : ส่งตรงผ่านพอร์ต COM / Bluetooth ที่จับคู่แล้ว (Web Serial: Chrome/Edge บนคอมพิวเตอร์)
   - rawbt   : ส่งต่อให้แอป RawBT บน Android (รองรับ Bluetooth / USB / LAN)
   - image   : บันทึก/แชร์เป็นรูปภาพ (สำหรับ iPhone/iPad แล้วพิมพ์ผ่านแอปของเครื่องพิมพ์)
   ========================================================================== */
'use strict';

const PRN_KEY = 'laundry_printer';
const PRN_DEF = { mode: 'browser', paper: 80, cut: true, drawer: false, copies: 1, feed: 4, auto: false, scale: 1, baud: 9600 };
const PRN_MODES = [
  { k: 'ble', l: 'Bluetooth โดยตรง', d: 'ไม่ต้องติดตั้งแอป · Chrome บน Android (Xiaomi ฯลฯ) · เครื่องพิมพ์ต้องรองรับ Bluetooth LE', ic: 'bluetooth', free: true },
  { k: 'usb', l: 'USB โดยตรง', d: 'ไม่ต้องติดตั้งแอป · Chrome บน Android ต่อสาย USB OTG หรือ Chrome/Edge บนคอมพิวเตอร์', ic: 'zap', free: true },
  { k: 'browser', l: 'หน้าต่างพิมพ์ของเบราว์เซอร์', d: 'คอมพิวเตอร์ Windows/Mac ที่ติดตั้งไดรเวอร์ Xprinter แล้ว', ic: 'printer' },
  { k: 'rawbt', l: 'แอป RawBT (Android)', d: 'พิมพ์ผ่าน Bluetooth / USB / LAN บนมือถือ-แท็บเล็ต Android', ic: 'phone' },
  { k: 'serial', l: 'Bluetooth / พอร์ต COM', d: 'Chrome/Edge บนคอมพิวเตอร์ ที่จับคู่ Bluetooth กับเครื่องพิมพ์แล้ว', ic: 'refresh' },
  { k: 'image', l: 'บันทึกเป็นรูปภาพ', d: 'iPhone / iPad — แชร์รูปไปพิมพ์ด้วยแอปของเครื่องพิมพ์', ic: 'image' }
];

function prn() {
  let p = {};
  try { p = JSON.parse(localStorage.getItem(PRN_KEY)) || {}; } catch (e) { /* ignore */ }
  // ยังไม่เคยตั้งค่า: เลือกวิธีที่เหมาะกับเครื่องให้อัตโนมัติ (Android เช่น Xiaomi → RawBT, iPhone/iPad → รูปภาพ)
  return Object.assign({}, PRN_DEF, { mode: recommendMode() }, p);
}
function prnSave(patch) {
  const p = Object.assign(prn(), patch);
  try { localStorage.setItem(PRN_KEY, JSON.stringify(p)); } catch (e) { /* ignore */ }
  return p;
}

const isAndroid = () => /Android/i.test(navigator.userAgent);
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const prnSupport = k => ({
  browser: true,
  usb: 'usb' in navigator,
  ble: 'bluetooth' in navigator,
  serial: 'serial' in navigator,
  rawbt: isAndroid(),
  image: true
}[k]);

/* ---------- วาดใบเสร็จเป็นรูป (ความกว้างตามจำนวนจุดของหัวพิมพ์) ---------- */
const loadImg = src => new Promise(res => { const i = new Image(); i.onload = () => res(i); i.onerror = () => res(null); i.src = src; });

function segments(text) {
  if (window.Intl && Intl.Segmenter) return Array.from(new Intl.Segmenter('th', { granularity: 'word' }).segment(text), s => s.segment);
  return Array.from(text);
}
function wrap(ctx, text, maxW) {
  if (!text) return [''];
  if (ctx.measureText(text).width <= maxW) return [text];
  const out = []; let line = '';
  for (const seg of segments(text)) {
    if (ctx.measureText(line + seg).width <= maxW || !line) {
      if (!line && ctx.measureText(seg).width > maxW) {
        // คำยาวเกินบรรทัด: ตัดตามตัวอักษร (เก็บสระ/วรรณยุกต์ไว้กับพยัญชนะ)
        for (const ch of (window.Intl && Intl.Segmenter ? Array.from(new Intl.Segmenter('th', { granularity: 'grapheme' }).segment(seg), s => s.segment) : Array.from(seg))) {
          if (ctx.measureText(line + ch).width > maxW && line) { out.push(line); line = ''; }
          line += ch;
        }
      } else line += seg;
    } else { out.push(line.trimEnd()); line = seg.trimStart(); }
  }
  if (line) out.push(line);
  return out;
}

async function receiptCanvas(r, opt = prn()) {
  const W = opt.paper === 58 ? 384 : 576;          // จุดที่พิมพ์ได้จริง (203dpi)
  const mm = W / (opt.paper === 58 ? 48 : 72);      // จุดต่อมิลลิเมตร
  const k = (W / 576) * (+opt.scale || 1);
  const F = { sm: 21 * k, n: 25 * k, md: 29 * k, lg: 36 * k };
  const family = 'Anuphan, "Noto Sans Thai", Sarabun, Tahoma, sans-serif';
  try { await Promise.all(['400', '700'].map(w => document.fonts.load(`${w} ${F.n}px Anuphan`, 'กขค'))); } catch (e) { /* ใช้ฟอนต์สำรอง */ }

  const rows = receiptRows(r);
  const imgs = {};
  for (const x of rows) if (x.t === 'img' && !imgs[x.src]) imgs[x.src] = await loadImg(x.src);

  const c = document.createElement('canvas');
  c.width = W; c.height = 6000;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, W, c.height);
  ctx.fillStyle = '#000'; ctx.textBaseline = 'alphabetic';
  const font = (sz, b) => { ctx.font = `${b ? 700 : 400} ${sz}px ${family}`; };
  const imgRects = [];
  const P = Math.round(W * 0.012), CW = W - P * 2;   // ขอบซ้าย-ขวาเล็กน้อย กันตัวอักษรชิดขอบ
  let y = 6;

  for (let x of rows) {
    if (x.t === 'grp') x = { t: 'c', text: '[ ' + x.text + ' ]', bold: true, small: true };
    if (x.t === 'hr') {
      y += 8;
      for (let i = P; i < W - P; i += 14) ctx.fillRect(i, y, 8, 2);
      y += 12;
      continue;
    }
    if (x.t === 'img') {
      const im = imgs[x.src]; if (!im) continue;
      const s = Math.min(x.w * mm / im.width, x.h * mm / im.height, 1.0 * W / im.width);
      const w = Math.round(im.width * s), h = Math.round(im.height * s), ix = Math.round((W - w) / 2);
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(im, ix, y + 4, w, h);
      imgRects.push([ix, y + 4, w, h]);
      y += h + 10;
      continue;
    }
    const sz = x.size ? F[x.size] : x.small || x.t === 'note' ? F.sm : F.n, lh = Math.round(sz * 1.42);
    font(sz, x.bold);
    if (x.t === 'c' || x.t === 'note') {
      for (const ln of wrap(ctx, x.text, CW)) {
        y += lh;
        const w = ctx.measureText(ln).width;
        ctx.fillText(ln, x.t === 'c' ? (W - w) / 2 : P, y - lh * 0.28);
      }
      continue;
    }
    // ซ้าย-ขวา
    const rw = x.r ? ctx.measureText(x.r).width : 0;
    const left = wrap(ctx, x.l, CW - (rw ? rw + 16 : 0));
    left.forEach((ln, i) => {
      y += lh;
      ctx.fillText(ln, P, y - lh * 0.28);
      if (i === 0 && x.r) ctx.fillText(x.r, W - P - rw, y - lh * 0.28);
    });
  }
  y += 10;

  const out = document.createElement('canvas');
  out.width = W; out.height = Math.ceil(y);
  out.getContext('2d').drawImage(c, 0, 0);
  toMono(out, imgRects);
  return out;
}

/** แปลงเป็นขาว-ดำ: ตัวหนังสือใช้ threshold, รูปภาพใช้ dithering (Floyd–Steinberg) */
function toMono(canvas, imgRects) {
  const ctx = canvas.getContext('2d'), { width: W, height: H } = canvas;
  const d = ctx.getImageData(0, 0, W, H), px = d.data;
  const g = new Float32Array(W * H);
  for (let i = 0; i < W * H; i++) g[i] = px[i * 4] * 0.299 + px[i * 4 + 1] * 0.587 + px[i * 4 + 2] * 0.114;
  const inImg = new Uint8Array(W * H);
  imgRects.forEach(([x0, y0, w, h]) => { for (let y = y0; y < Math.min(H, y0 + h); y++) for (let x = x0; x < Math.min(W, x0 + w); x++) inImg[y * W + x] = 1; });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = y * W + x, old = g[i];
    const v = inImg[i] ? (old < 128 ? 0 : 255) : (old < 165 ? 0 : 255);
    g[i] = v;
    if (inImg[i]) {
      const e = old - v;
      if (x + 1 < W && inImg[i + 1]) g[i + 1] += e * 7 / 16;
      if (y + 1 < H) {
        if (x > 0 && inImg[i + W - 1]) g[i + W - 1] += e * 3 / 16;
        if (inImg[i + W]) g[i + W] += e * 5 / 16;
        if (x + 1 < W && inImg[i + W + 1]) g[i + W + 1] += e / 16;
      }
    }
  }
  for (let i = 0; i < W * H; i++) { const v = g[i] < 128 ? 0 : 255; px[i * 4] = px[i * 4 + 1] = px[i * 4 + 2] = v; px[i * 4 + 3] = 255; }
  ctx.putImageData(d, 0, 0);
}

/* ---------- คำสั่ง ESC/POS ---------- */
function escpos(canvas, opt = prn()) {
  const { width: W, height: H } = canvas, bw = Math.ceil(W / 8);
  const px = canvas.getContext('2d').getImageData(0, 0, W, H).data;
  const out = [0x1B, 0x40];                                   // ESC @  เริ่มต้นเครื่องพิมพ์
  if (opt.drawer) out.push(0x1B, 0x70, 0x00, 0x19, 0xFA);     // ESC p  เปิดลิ้นชักเก็บเงิน
  const BAND = 200;                                           // ส่งเป็นช่วง ๆ กันบัฟเฟอร์เต็ม
  for (let y0 = 0; y0 < H; y0 += BAND) {
    const h = Math.min(BAND, H - y0);
    out.push(0x1D, 0x76, 0x30, 0x00, bw & 255, bw >> 8, h & 255, h >> 8);  // GS v 0
    for (let y = y0; y < y0 + h; y++) for (let b = 0; b < bw; b++) {
      let byte = 0;
      for (let bit = 0; bit < 8; bit++) {
        const x = b * 8 + bit;
        if (x < W && px[(y * W + x) * 4] < 128) byte |= 0x80 >> bit;
      }
      out.push(byte);
    }
  }
  out.push(0x1B, 0x64, Math.max(0, Math.min(10, +opt.feed || 0)));        // ESC d n  ฟีดกระดาษ
  if (opt.cut) out.push(0x1D, 0x56, 0x42, 0x00);                          // GS V B   ตัดกระดาษ
  return new Uint8Array(out);
}

/* ---------- ช่องทางส่งข้อมูล ---------- */
let usbDev = null, serialPort = null;

async function usbConnect(ask) {
  if (!('usb' in navigator)) throw new Error('เบราว์เซอร์นี้ไม่รองรับ USB โดยตรง (ใช้ Chrome หรือ Edge)');
  if (usbDev && usbDev.opened) return usbDev;
  let dev = (await navigator.usb.getDevices())[0];
  if (!dev && ask) dev = await navigator.usb.requestDevice({ filters: [] });
  if (!dev) throw new Error('ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ USB');
  await dev.open();
  if (dev.configuration === null) await dev.selectConfiguration(1);
  let iface, ep;
  for (const it of dev.configuration.interfaces) for (const alt of it.alternates) {
    const o = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
    if (o && (!iface || alt.interfaceClass === 7)) { iface = it; ep = o; }
  }
  if (!iface) throw new Error('ไม่พบช่องส่งข้อมูลของเครื่องพิมพ์');
  try { await dev.claimInterface(iface.interfaceNumber); }
  catch (e) { throw new Error('เครื่องพิมพ์ถูกโปรแกรมอื่นใช้อยู่ (บน Windows ต้องเปลี่ยนไดรเวอร์เป็น WinUSB ด้วย Zadig หรือใช้วิธี “หน้าต่างพิมพ์ของเบราว์เซอร์”)'); }
  dev._ep = ep.endpointNumber;
  usbDev = dev;
  prnSave({ usbName: dev.productName || 'USB Printer' });
  return dev;
}
async function usbSend(bytes, ask) {
  const dev = await usbConnect(ask);
  for (let i = 0; i < bytes.length; i += 4096) await dev.transferOut(dev._ep, bytes.slice(i, i + 4096));
}

async function serialConnect(ask) {
  if (!('serial' in navigator)) throw new Error('เบราว์เซอร์นี้ไม่รองรับพอร์ต COM (ใช้ Chrome หรือ Edge บนคอมพิวเตอร์)');
  if (serialPort && serialPort.writable) return serialPort;
  let port = (await navigator.serial.getPorts())[0];
  if (!port && ask) port = await navigator.serial.requestPort();
  if (!port) throw new Error('ยังไม่ได้เลือกพอร์ตเครื่องพิมพ์');
  if (!port.writable) await port.open({ baudRate: +prn().baud || 9600 });
  serialPort = port;
  prnSave({ serialName: 'พอร์ต COM' });
  return port;
}
async function serialSend(bytes, ask) {
  const port = await serialConnect(ask);
  const w = port.writable.getWriter();
  try { for (let i = 0; i < bytes.length; i += 2048) await w.write(bytes.slice(i, i + 2048)); }
  finally { w.releaseLock(); }
}

/* Bluetooth LE (Web Bluetooth): บริการส่งข้อมูลที่เครื่องพิมพ์ความร้อนจีนนิยมใช้ */
const BLE_SERVICES = [
  '000018f0-0000-1000-8000-00805f9b34fb', 'e7810a71-73ae-499d-8c15-faa9aef0c3f2',
  '49535343-fe7d-4ae5-8fa9-9fafd205e455', '0000ff00-0000-1000-8000-00805f9b34fb',
  '0000ffe0-0000-1000-8000-00805f9b34fb', '0000fee7-0000-1000-8000-00805f9b34fb',
  '0000ae30-0000-1000-8000-00805f9b34fb', '0000ffb0-0000-1000-8000-00805f9b34fb'
];
let bleDev = null, bleChar = null;
async function bleConnect(ask) {
  if (!('bluetooth' in navigator)) throw new Error('เบราว์เซอร์นี้ไม่รองรับ Bluetooth โดยตรง (ใช้ Chrome บน Android)');
  if (bleDev && bleDev.gatt.connected && bleChar) return bleChar;
  if (!bleDev && navigator.bluetooth.getDevices) bleDev = (await navigator.bluetooth.getDevices())[0] || null;
  if (!bleDev) {
    if (!ask) throw new Error('ยังไม่ได้เชื่อมต่อเครื่องพิมพ์ Bluetooth');
    bleDev = await navigator.bluetooth.requestDevice({ acceptAllDevices: true, optionalServices: BLE_SERVICES });
    bleDev.addEventListener('gattserverdisconnected', () => { bleChar = null; });
  }
  const server = await bleDev.gatt.connect();
  let found = null;
  for (const svc of await server.getPrimaryServices().catch(() => [])) {
    for (const ch of await svc.getCharacteristics().catch(() => [])) {
      if (ch.properties.writeWithoutResponse || ch.properties.write) { found = ch; break; }
    }
    if (found) break;
  }
  if (!found) { bleDev.gatt.disconnect(); bleDev = null; throw new Error('เครื่องพิมพ์นี้ไม่รองรับ Bluetooth LE — ใช้สาย USB OTG (วิธี “USB โดยตรง”) หรือแอป RawBT แทน'); }
  bleChar = found;
  prnSave({ bleName: bleDev.name || 'Bluetooth Printer' });
  return bleChar;
}
async function bleSend(bytes, ask) {
  const ch = await bleConnect(ask);
  const fast = ch.properties.writeWithoutResponse, size = fast ? 180 : 240;
  for (let i = 0, n = 0; i < bytes.length; i += size, n++) {
    const part = bytes.slice(i, i + size);
    if (fast) { await ch.writeValueWithoutResponse(part); if (n % 8 === 7) await new Promise(r => setTimeout(r, 25)); }
    else await ch.writeValueWithResponse(part);
  }
}

function rawbtSend(bytes) {
  let bin = '';
  for (let i = 0; i < bytes.length; i += 8192) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 8192));
  location.href = 'intent:base64,' + btoa(bin) + '#Intent;scheme=rawbt;package=ru.a402d.rawbtprinter;end;';
}

async function imageShare(canvas, name) {
  const blob = await new Promise(r => canvas.toBlob(r, 'image/png'));
  const file = new File([blob], name + '.png', { type: 'image/png' });
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try { await navigator.share({ files: [file], title: name }); return; } catch (e) { if (e.name === 'AbortError') return; }
  }
  download(name + '.png', blob);
}

/* ---------- พิมพ์ใบเสร็จ ---------- */
let printing = false;
async function printReceipt(r, { ask = true } = {}) {
  const opt = prn();
  if (opt.mode === 'browser') return printDoc(receiptHTML(r), 'rc');
  if (printing) return;
  printing = true;
  try {
    // USB/Serial: ขอสิทธิ์ทันทีขณะยังอยู่ในจังหวะที่ผู้ใช้กดปุ่ม
    if (opt.mode === 'usb') await usbConnect(ask);
    if (opt.mode === 'ble') await bleConnect(ask);
    if (opt.mode === 'serial') await serialConnect(ask);
    const canvas = await receiptCanvas(r, opt);
    if (opt.mode === 'image') return await imageShare(canvas, 'ใบเสร็จ-' + r.no);
    const one = escpos(canvas, opt), n = Math.max(1, Math.min(5, +opt.copies || 1));
    const bytes = new Uint8Array(one.length * n);
    for (let i = 0; i < n; i++) bytes.set(one, i * one.length);
    if (opt.mode === 'usb') await usbSend(bytes, ask);
    else if (opt.mode === 'serial') await serialSend(bytes, ask);
    else if (opt.mode === 'ble') { toast('กำลังส่งไปเครื่องพิมพ์ทาง Bluetooth…', 'info', 2000); await bleSend(bytes, ask); }
    else if (opt.mode === 'rawbt') rawbtSend(bytes);
    toast('ส่งไปเครื่องพิมพ์แล้ว' + (n > 1 ? ` (${n} ใบ)` : ''));
  } catch (e) {
    if (e && e.name === 'NotFoundError') toast('ยังไม่ได้เลือกเครื่องพิมพ์', 'warning');
    else toast('พิมพ์ไม่สำเร็จ: ' + (e && e.message || e), 'error', 6000);
    usbDev = null; bleChar = null;
  } finally { printing = false; }
}

/** ใบเสร็จตัวอย่างสำหรับทดสอบเครื่องพิมพ์ */
function testReceipt() {
  return {
    no: 'TEST-001', date: today(), time: new Date().toTimeString().slice(0, 5), kind: 'order', name: 'ทดสอบเครื่องพิมพ์', phone: '',
    lines: [{ t: 'เสื้อ', q: 3, unit: 'ชิ้น', price: 20, a: 60, note: '' }, { t: 'ภาษาไทย ก้ ญู ฎ๋ ปั่น ฟ้า สระอำ', q: '', a: '' }],
    total: 60, left: null
  };
}

/* ---------- หน้าตั้งค่าเครื่องพิมพ์ (แท็บในหน้าผู้ดูแลระบบ) ---------- */
function printerPanel() {
  const p = prn();
  const status = p.mode === 'ble' ? (bleChar ? `เชื่อมต่อแล้ว: ${esc(bleDev.name || p.bleName || 'Bluetooth')}` : p.bleName ? `เคยเชื่อมต่อ: ${esc(p.bleName)} (กดเชื่อมต่ออีกครั้งหลังเปิดแอปใหม่)` : 'ยังไม่ได้เชื่อมต่อ')
    : p.mode === 'usb' ? (usbDev && usbDev.opened ? `เชื่อมต่อแล้ว: ${esc(usbDev.productName || p.usbName || 'USB')}` : p.usbName ? `เคยเชื่อมต่อ: ${esc(p.usbName)}` : 'ยังไม่ได้เชื่อมต่อ')
    : p.mode === 'serial' ? (serialPort ? 'เชื่อมต่อพอร์ตแล้ว' : 'ยังไม่ได้เลือกพอร์ต') : '';
  const help = {
    ble: `<ol><li>เปิดเว็บนี้ด้วย <b>Chrome</b> และเปิด Bluetooth + ตำแหน่ง (Location) ของเครื่อง</li><li>เปิดเครื่องพิมพ์ <b>ไม่ต้องจับคู่ในการตั้งค่า Bluetooth ของมือถือ</b></li><li>กด “เชื่อมต่อเครื่องพิมพ์” แล้วเลือกชื่อเครื่องพิมพ์ (เช่น Printer001 / XP-N160II)</li><li>ถ้าไม่เจอเครื่องพิมพ์ในรายการ หรือขึ้นว่าไม่รองรับ แปลว่ารุ่นนี้ใช้ Bluetooth แบบเดิม (ไม่ใช่ LE) ให้ใช้ “USB โดยตรง” ด้วยสาย OTG แทน (ไม่ต้องติดตั้งแอปเหมือนกัน)</li></ol>`,
    browser: `<ol><li>ติดตั้งไดรเวอร์ Xprinter (XP-N160II) บนคอมพิวเตอร์</li><li>ตั้งขนาดกระดาษเป็น 80mm (72mm × Receipt) ในไดรเวอร์</li><li>กด “พิมพ์” แล้วเลือกเครื่องพิมพ์ Xprinter · ตั้ง ระยะขอบ = ไม่มี, สเกล = 100%</li><li>แนะนำให้ตั้งเป็นเครื่องพิมพ์เริ่มต้น</li></ol>`,
    usb: `<ol><li>ใช้ Chrome หรือ Edge · ต่อสาย USB (มือถือ/แท็บเล็ต Android เช่น Xiaomi ใช้สาย/หัวแปลง USB OTG ต่อเข้าช่อง Type-C)</li><li>กด “เชื่อมต่อเครื่องพิมพ์” แล้วเลือก XP-N160II / USB Printer (ทำครั้งเดียว)</li><li>บน Windows ถ้าเชื่อมไม่ได้ ให้ใช้วิธี “หน้าต่างพิมพ์ของเบราว์เซอร์” แทน (หรือเปลี่ยนไดรเวอร์เป็น WinUSB ด้วยโปรแกรม Zadig)</li></ol>`,
    rawbt: `<ol><li>เปิดเว็บนี้ด้วย <b>Chrome</b> (เบราว์เซอร์ในเครื่อง เช่น Mi Browser อาจเปิดแอป RawBT ไม่ได้)</li><li>ติดตั้งแอป <a href="https://play.google.com/store/apps/details?id=ru.a402d.rawbtprinter" target="_blank" rel="noopener">RawBT</a> จาก Play Store</li><li>ในแอป RawBT เลือกเครื่องพิมพ์ (Bluetooth จับคู่ก่อน / USB / LAN ใส่ IP) และตั้งกระดาษ 80mm</li><li>กลับมากด “พิมพ์ทดสอบ” — ครั้งแรกให้กดอนุญาตเปิดแอป RawBT</li><li><b>Xiaomi / Redmi / POCO:</b> ไปที่ ตั้งค่า → แอป → RawBT → เปิด “เริ่มอัตโนมัติ (Autostart)” และ ประหยัดแบตเตอรี่ = “ไม่จำกัด” และอนุญาต “แสดงหน้าต่างป๊อปอัปขณะทำงานในเบื้องหลัง” ไม่เช่นนั้นระบบอาจปิด RawBT จนพิมพ์ไม่ออก</li></ol>`,
    serial: `<ol><li>จับคู่ Bluetooth ของเครื่องพิมพ์กับคอมพิวเตอร์ (รหัสมักเป็น 0000 หรือ 1234)</li><li>ใช้ Chrome/Edge กด “เชื่อมต่อเครื่องพิมพ์” แล้วเลือกพอร์ต COM ของเครื่องพิมพ์</li></ol>`,
    image: `<ol><li>กดพิมพ์ ระบบจะสร้างรูปใบเสร็จขนาดพอดีกระดาษ 80mm</li><li>แชร์รูปไปที่แอปพิมพ์ของ Xprinter (เช่น แอปที่มากับเครื่อง หรือ “Thermer”) แล้วสั่งพิมพ์</li></ol>`
  }[p.mode];
  return `<section class="card">
      ${secHead('printer', 'indigo', 'เครื่องพิมพ์ใบเสร็จ', 'ตั้งค่าแยกตามเครื่อง (มือถือ/แท็บเล็ต/คอมพิวเตอร์ แต่ละเครื่องตั้งได้ไม่เหมือนกัน)')}
      <div class="prn-model">${icon('printer')}<div><b>Xprinter XP-N160II</b><small>เครื่องพิมพ์ความร้อน 80mm · 203dpi · ESC/POS · มีใบตัดกระดาษอัตโนมัติ</small></div></div>
      <h3 class="mini-h">วิธีพิมพ์บนเครื่องนี้</h3>
      <div class="prn-modes">${PRN_MODES.map(m => `<button class="prn-mode ${p.mode === m.k ? 'on' : ''}" data-act="prnMode" data-k="${m.k}">
        <span class="over-ic">${icon(m.ic)}</span><span class="over-txt"><b>${m.l}</b><small>${m.d}</small>
        ${prnSupport(m.k) ? (m.k === recommendMode() ? badge('แนะนำสำหรับเครื่องนี้', 'success') : m.free ? badge('ไม่ต้องติดตั้งแอป', 'primary') : '') : badge('ไม่รองรับบนเครื่องนี้', 'neutral')}</span><span class="radio"></span></button>`).join('')}</div>
      <div class="prn-help">${icon('info')}<div>${help}</div></div>
      ${['usb', 'serial', 'ble'].includes(p.mode) ? `<div class="prn-status"><span class="dot ${(p.mode === 'usb' ? usbDev && usbDev.opened : p.mode === 'ble' ? bleChar : serialPort) ? 'on' : ''}"></span><span>${status}</span>
        <button class="btn btn-soft btn-sm" data-act="prnConnect">${icon('zap')}เชื่อมต่อเครื่องพิมพ์</button></div>` : ''}
      <div class="prn-actions"><button class="btn btn-primary" data-act="prnTest">${icon('printer')}พิมพ์ทดสอบ</button></div>
    </section>
    <section class="card">
      ${secHead('sliders', 'amber', 'ตัวเลือกการพิมพ์', 'ใช้กับการพิมพ์ตรง (USB / RawBT / Bluetooth / รูปภาพ)')}
      <div class="opt-list">
        <div class="opt-row"><span class="opt-txt"><b>ความกว้างกระดาษ</b><small>XP-N160II ใช้ 80mm (พิมพ์ได้ 72mm = 576 จุด)</small></span>
          <select class="opt-sel" data-change="prnSet" data-k="paper" data-type="num"><option value="80" ${p.paper == 80 ? 'selected' : ''}>80mm (576 จุด)</option><option value="58" ${p.paper == 58 ? 'selected' : ''}>58mm (384 จุด)</option></select></div>
        <div class="opt-row"><span class="opt-txt"><b>ขนาดตัวอักษร</b><small>ปรับให้อ่านง่ายขึ้นหรือประหยัดกระดาษ</small></span>
          <select class="opt-sel" data-change="prnSet" data-k="scale" data-type="num">${[[0.9, 'เล็ก'], [1, 'ปกติ'], [1.15, 'ใหญ่'], [1.3, 'ใหญ่มาก']].map(([v, l]) => `<option value="${v}" ${+p.scale === v ? 'selected' : ''}>${l}</option>`).join('')}</select></div>
        <div class="opt-row"><span class="opt-txt"><b>จำนวนสำเนา</b><small>พิมพ์กี่ใบต่อการกดหนึ่งครั้ง (เช่น ให้ลูกค้า 1 + เก็บที่ร้าน 1)</small></span>
          <div class="input-affix opt-num"><input type="number" min="1" max="5" step="1" value="${p.copies}" data-change="prnSet" data-k="copies" data-type="num"><span class="affix">ใบ</span></div></div>
        <div class="opt-row"><span class="opt-txt"><b>ฟีดกระดาษท้ายใบ</b><small>เว้นระยะก่อนตัดกระดาษ</small></span>
          <div class="input-affix opt-num"><input type="number" min="0" max="10" step="1" value="${p.feed}" data-change="prnSet" data-k="feed" data-type="num"><span class="affix">บรรทัด</span></div></div>
        ${prnToggle('cut', 'ตัดกระดาษอัตโนมัติ', 'XP-N160II มีใบมีดตัดกระดาษในตัว')}
        ${prnToggle('auto', 'พิมพ์อัตโนมัติหลังบันทึกบิล', 'ไม่ต้องกดพิมพ์ซ้ำ (เหมาะกับ USB / RawBT)')}
        ${prnToggle('drawer', 'เปิดลิ้นชักเก็บเงินเมื่อพิมพ์', 'กรณีต่อลิ้นชักเก็บเงินกับเครื่องพิมพ์')}
        ${p.mode === 'serial' ? `<div class="opt-row"><span class="opt-txt"><b>ความเร็วพอร์ต (Baud rate)</b><small>ค่าเริ่มต้นของ Xprinter มักเป็น 9600</small></span>
          <select class="opt-sel" data-change="prnSet" data-k="baud" data-type="num">${[9600, 19200, 38400, 115200].map(b => `<option ${+p.baud === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div>` : ''}
      </div>
    </section>
    <section class="card">
      ${secHead('eye', 'pink', 'ตัวอย่างที่จะพิมพ์', 'ภาพจริงที่ส่งไปเครื่องพิมพ์ (ขาว-ดำ ตามหัวพิมพ์ความร้อน)')}
      <div class="prn-preview" id="prn-preview"><span class="muted small">กำลังสร้างตัวอย่าง…</span></div>
    </section>`;
}
const prnToggle = (k, title, sub) => `<label class="opt-row"><span class="opt-txt"><b>${title}</b><small>${sub}</small></span>
  <span class="switch"><input type="checkbox" ${prn()[k] ? 'checked' : ''} data-change="prnSet" data-k="${k}" data-type="bool"><i></i></span></label>`;

function recommendMode() {
  if (isIOS()) return 'image';
  if (isAndroid()) return 'bluetooth' in navigator ? 'ble' : 'usb';
  return 'browser';
}

async function prnPreview() {
  const box = $('#prn-preview'); if (!box) return;
  const last = db.rc[db.rc.length - 1] || testReceipt();
  const c = await receiptCanvas(last);
  c.className = 'prn-canvas';
  box.innerHTML = ''; box.appendChild(c);
}

ACT.prnMode = el => { prnSave({ mode: el.dataset.k }); render(); };
ACT.prnSet = el => {
  const t = el.dataset.type;
  prnSave({ [el.dataset.k]: t === 'bool' ? el.checked : t === 'num' ? +el.value : el.value });
  render(); toast('บันทึกการตั้งค่าเครื่องพิมพ์แล้ว');
};
ACT.prnConnect = async () => {
  try {
    const m = prn().mode;
    if (m === 'usb') { usbDev = null; await usbConnect(true); }
    else if (m === 'ble') { if (bleDev && bleDev.gatt.connected) bleDev.gatt.disconnect(); bleDev = null; bleChar = null; await bleConnect(true); }
    else { serialPort = null; await serialConnect(true); }
    toast('เชื่อมต่อเครื่องพิมพ์แล้ว'); render();
  } catch (e) { if (e.name !== 'NotFoundError') toast(e.message || String(e), 'error', 6000); }
};
ACT.prnTest = () => printReceipt(testReceipt());

/* เมื่อถอด/เสียบสาย USB */
if ('usb' in navigator) {
  navigator.usb.addEventListener('disconnect', e => { if (usbDev && e.device === usbDev) { usbDev = null; toast('เครื่องพิมพ์ USB ถูกถอดออก', 'warning'); } });
}

/* หน้าเครื่องพิมพ์: ทุกคนเปิดได้ (ไม่ต้องใช้รหัสแอดมิน) เพราะเป็นการตั้งค่าของเครื่องนี้ */
V.prn = {
  render: () => `${pageHead('เครื่องพิมพ์', 'เชื่อมต่อและตั้งค่าเครื่องพิมพ์ใบเสร็จของเครื่องนี้')}<div class="settings">${printerPanel()}</div>`,
  mount: () => prnPreview()
};
