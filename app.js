// BENDITO STUDIO – App-Logik. Häkchen bleiben nur auf diesem Gerät (localStorage).
// Inhalte stehen in data.js.

const KEY = 'studio.v1';
const DAY_SHORT = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_LONG = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];
const MONTHS = ['Januar', 'Februar', 'März', 'April', 'Mai', 'Juni', 'Juli', 'August', 'September', 'Oktober', 'November', 'Dezember'];
const CHECK = '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="#0b0b0c" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"/></svg>';
const ico = (d) => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true"><path d="${d}"/></svg>`;
const IC = {
  copy: ico('M9 9h10v11H9zM5 15V4h10'),
  film: ico('M4 5h16v14H4zM8 5v14M16 5v14M4 9h4M4 15h4M16 9h4M16 15h4'),
  text: ico('M5 6h14M5 12h14M5 18h9'),
};

const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const keyOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const parse = (k) => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const short = (k) => { const d = parse(k); return `${DAY_SHORT[d.getDay()]} ${d.getDate()}.${d.getMonth() + 1}.`; };

let store = load();
let tab = 'week';
const weekKeys = Object.keys(WEEK.days).sort();
let selDate = weekKeys.includes(keyOf(new Date())) ? keyOf(new Date()) : weekKeys[0];
let shootId = Object.keys(SHOOTS)[0];
let ideaFilter = 'Alle';

function load() {
  try { return JSON.parse(localStorage.getItem(KEY)) || { done: {} }; } catch { return { done: {} }; }
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch { /* Speicher gesperrt */ } }
const isOn = (id) => store.done[id] === true;

// ---------- Aufgaben einer Woche sammeln
function blockIds(b, date) {
  if (b.shoot) return (SHOOTS[b.shoot]?.clips || []).map((c) => c.id);
  if (b.post) return Object.values(POSTS[b.post]?.tasks || {}).flat().map((t) => t.id);
  return (b.tasks || []).map((t) => t.id);
}
function dayIds(date) {
  const ids = (WEEK.days[date] || []).flatMap((b) => blockIds(b, date));
  (WEEK.daily || []).forEach((d) => ids.push(`${d.id}-${date}`));
  return ids;
}
const weekIds = () => weekKeys.flatMap(dayIds);

function ring(p, label) {
  const r = 26, c = 2 * Math.PI * r, v = Math.max(0, Math.min(1, p));
  return `<svg class="ring" viewBox="0 0 64 64" role="img" aria-label="${label}">
    <defs><linearGradient id="rg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#f6e2b3"/><stop offset=".55" stop-color="#d4a854"/><stop offset="1" stop-color="#8f6420"/></linearGradient></defs>
    <circle cx="32" cy="32" r="${r}" class="ring-track"/>
    <circle cx="32" cy="32" r="${r}" class="ring-val" stroke-dasharray="${(c * v).toFixed(1)} ${c.toFixed(1)}" transform="rotate(-90 32 32)"/>
    <text x="32" y="37" text-anchor="middle">${label}</text></svg>`;
}

function taskRow(t) {
  const on = isOn(t.id);
  return `<button class="task${on ? ' on' : ''}" data-action="tick" data-id="${esc(t.id)}" aria-pressed="${on}">
    <span class="check">${CHECK}</span><span class="grow"><div class="title">${esc(t.t)}</div>${t.n ? `<div class="sub">${esc(t.n)}</div>` : ''}</span></button>`;
}
function progress(ids) {
  const n = ids.filter(isOn).length;
  return { n, all: ids.length, pct: ids.length ? (n / ids.length) * 100 : 0, done: ids.length > 0 && n === ids.length };
}

// ---------- Kopf: Wochentage
function renderDays() {
  const el = document.getElementById('days');
  el.hidden = tab !== 'week';
  const today = keyOf(new Date());
  el.innerHTML = weekKeys.map((k) => {
    const d = parse(k), p = progress(dayIds(k));
    const cls = ['day', k === selDate && 'sel', k === today && 'today', p.done && 'done', !(WEEK.days[k] || []).length && !(WEEK.daily || []).length && 'empty'].filter(Boolean).join(' ');
    return `<button class="${cls}" data-action="day" data-date="${k}">${DAY_SHORT[d.getDay()]}<small>${d.getDate()}.</small></button>`;
  }).join('');
  const d = parse(selDate);
  document.getElementById('date').textContent = tab === 'week'
    ? `${DAY_LONG[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()]} · ${WEEK.title}`
    : `${WEEK.title} · ${WEEK.range}`;
}

// ---------- Tab Woche
function renderWeek() {
  const all = progress(weekIds());
  let h = `<section class="card hero">${ring(all.pct / 100, `${Math.round(all.pct)}%`)}
    <div class="grow"><b>${all.n} von ${all.all} erledigt</b><p>${esc(WEEK.focus || '')}</p></div></section>`;
  const blocks = WEEK.days[selDate] || [];
  blocks.forEach((b) => {
    if (b.shoot) h += shootCard(b.shoot);
    else if (b.post) h += postCard(b.post);
    else h += taskCard(b);
  });
  (WEEK.daily || []).forEach((d) => {
    h += `<section class="card"><div class="kind">Jeden Tag</div>${taskRow({ id: `${d.id}-${selDate}`, t: d.title, n: d.note })}</section>`;
  });
  if (!blocks.length) h += `<p class="note" style="text-align:center">Heute steht nichts Grosses an. Ruhetag für den Content.</p>`;
  return h;
}
function shootCard(id) {
  const s = SHOOTS[id]; if (!s) return '';
  const p = progress(s.clips.map((c) => c.id));
  return `<section class="card${p.done ? ' complete' : ''}"><div class="kind">Drehtag · ${esc(s.where)}</div><h2>${esc(s.title)}</h2>
    <div class="meta"><span>${s.clips.length} Clips · ${esc(s.length)}</span><span class="gold">${p.n}/${p.all} gedreht</span></div>
    <ol class="order">${s.order.map((o) => `<li><span class="tag">${esc(o.tag)}</span><span>${esc(o.text)}</span><span class="dur">${esc(o.min)}</span></li>`).join('')}</ol>
    <div class="gh">Clips</div>
    ${s.clips.map((c) => taskRow({ id: c.id, t: `Clip ${c.n} · ${c.ost.join(' ')}`, n: c.du })).join('')}
    <div class="bar"><span style="width:${p.pct}%"></span></div>
    <div class="btns"><button class="btn tint" data-action="open-shoot" data-id="${id}">${IC.film}Drehplan mit Figuren</button></div></section>`;
}
function postCard(id) {
  const p = POSTS[id]; if (!p) return '';
  const groups = p.tasks || {};
  const pr = progress(Object.values(groups).flat().map((t) => t.id));
  return `<section class="card${pr.done ? ' complete' : ''}"><div class="kind">${esc(p.type)} · ${short(p.date)} ${esc(p.time)}</div><h2>${esc(p.title)}</h2>
    ${p.hook ? `<p class="hook">«${esc(p.hook)}»</p>` : ''}
    <div class="meta">${p.verse ? `<span>${esc(p.verse)}</span>` : ''}<span class="gold">${pr.n}/${pr.all} erledigt</span></div>
    ${p.note ? `<p class="note">${esc(p.note)}</p>` : ''}
    ${Object.entries(groups).map(([g, list]) => `<div class="gh">${esc(g)}</div>${list.map(taskRow).join('')}`).join('')}
    <div class="bar"><span style="width:${pr.pct}%"></span></div>
    <div class="btns"><button class="btn tint" data-action="open-caption" data-id="${id}">${IC.text}Caption</button>${p.shoot ? `<button class="btn" data-action="open-shoot" data-id="${p.shoot}">${IC.film}Drehplan</button>` : ''}</div></section>`;
}
function taskCard(b) {
  const pr = progress((b.tasks || []).map((t) => t.id));
  return `<section class="card${pr.done ? ' complete' : ''}">${b.kind ? `<div class="kind">${esc(b.kind)}</div>` : ''}<h2>${esc(b.title)}</h2>
    ${b.note ? `<p class="note">${esc(b.note)}</p>` : ''}<div style="margin-top:8px">${(b.tasks || []).map(taskRow).join('')}</div></section>`;
}

// ---------- Tab Drehplan
function renderShoot() {
  const ids = Object.keys(SHOOTS);
  if (!ids.length) return `<p class="note">Noch kein Drehplan.</p>`;
  const s = SHOOTS[shootId] || SHOOTS[ids[0]];
  let h = ids.length > 1 ? `<div class="seg">${ids.map((i) => `<button class="${i === shootId ? 'sel' : ''}" data-action="shoot" data-id="${i}">${esc(SHOOTS[i].title)}</button>`).join('')}</div>` : '';
  const p = progress(s.clips.map((c) => c.id));
  h += `<section class="card"><div class="kind">${short(s.date)} · ${esc(s.where)} · ${esc(s.length)}</div><h2>${esc(s.title)}</h2>
    <div class="gh">Reihenfolge</div><ol class="order">${s.order.map((o) => `<li><span class="tag">${esc(o.tag)}</span><span>${esc(o.text)}</span><span class="dur">${esc(o.min)}</span></li>`).join('')}</ol>
    <div class="gh">Regeln</div><ul class="plain">${s.rules.map((r) => `<li>${esc(r)}</li>`).join('')}</ul>
    <div class="bar"><span style="width:${p.pct}%"></span></div></section>`;
  s.clips.forEach((c) => { h += clipCard(c); });
  h += `<section class="card"><div class="kind">Schnitt</div><ul class="plain">${s.edit.map((e) => `<li>${esc(e)}</li>`).join('')}</ul>${s.ready ? `<p class="ready">${esc(s.ready)}</p>` : ''}</section>`;
  return h;
}
function phone(def, ost, label) {
  return `<figure><div class="ph"><img data-scene='${esc(JSON.stringify(def))}' alt="${esc(label)}"><div class="sz"></div><div class="ui t"></div><div class="ui b"></div><div class="ui r"></div>
    <div class="ost">${(ost || []).map((l) => `<span>${esc(l)}</span>`).join('')}</div></div><figcaption>${esc(label)}</figcaption></figure>`;
}
function clipCard(c) {
  const s = c.side, on = isOn(c.id);
  const dist = String(s.dist).replace('.', ',');
  return `<section class="card${on ? ' complete' : ''}" id="${esc(c.id)}">
    <div class="clip-h"><span class="num">${c.n}</span><div class="grow"><p class="ctime">${esc(c.t)} · Setup ${esc(c.setup)}</p><h3 class="cline">${esc(c.ost.join(' ').toLowerCase().replace(/^./, (m) => m.toUpperCase()))}</h3></div></div>
    <div class="shots${c.end ? '' : ' one'}">${phone(c.scene, c.ost, 'Handybild')}${c.end ? phone(c.end, [], c.endLabel || 'Ende') : ''}</div>
    <div class="views"><figure><div class="sv"><img data-side='${esc(JSON.stringify(s))}' alt="Seitenansicht"><svg viewBox="0 0 800 460"></svg></div><figcaption>Seite: Höhe, Winkel, Abstand</figcaption></figure>
      <figure>${topView(c.top)}<figcaption>Von oben</figcaption></figure></div>
    <dl class="steps"><div><dt>Handy</dt><dd><b class="spec">${s.h} cm · ${s.tilt}° · ${dist} m · ${esc(s.lens)}</b>${esc(c.handy)}</dd></div><div><dt>Du</dt><dd>${esc(c.du)}</dd></div><div><dt>Takes</dt><dd>${esc(c.takes)}</dd></div></dl>
    <p class="planb"><b>Plan B</b>${esc(c.b)}</p>
    <div class="shot-done">${taskRow({ id: c.id, t: on ? 'Gedreht' : 'Als gedreht abhaken' })}</div></section>`;
}

// Draufsicht (400 × 230)
function topView(t = {}) {
  let o = '<rect width="400" height="230" rx="6" fill="var(--plan)"/>';
  if (t.mirror) o += '<rect x="16" y="10" width="368" height="5" fill="var(--mirror)"/><text x="200" y="30" class="tl" text-anchor="middle">Spiegel: nicht ins Bild</text>';
  if (t.building) o += '<rect x="16" y="14" width="368" height="50" fill="#15181e" stroke="var(--line)"/><rect x="40" y="58" width="54" height="8" fill="var(--lampC)"/><text x="67" y="44" class="tl" text-anchor="middle">Tür</text>';
  (t.items || []).forEach((it) => {
    if (it.t === 'bench') { const w = it.w || 110; o += `<rect x="${it.x}" y="${it.y}" width="${w}" height="28" rx="6" fill="var(--pad)"/><text x="${it.x + w / 2}" y="${it.ly ?? it.y + 48}" class="tl" text-anchor="middle">${esc(it.label || 'Bank')}</text>`; }
    if (it.t === 'barbell') o += `<rect x="${it.x - 4}" y="${it.y - 52}" width="8" height="104" fill="var(--steelD)"/><rect x="${it.x - 12}" y="${it.y - 58}" width="24" height="12" rx="3" fill="var(--steelD)"/><rect x="${it.x - 12}" y="${it.y + 46}" width="24" height="12" rx="3" fill="var(--steelD)"/><text x="${it.x}" y="${it.y - 68}" class="tl" text-anchor="middle">Langhantel</text>`;
  });
  if (t.cam) {
    const [x, y, ang, spread = 30, ln = 150] = t.cam, r = (a) => (a * Math.PI) / 180;
    const p = `M${x} ${y} L${(x + ln * Math.cos(r(ang - spread))).toFixed(0)} ${(y + ln * Math.sin(r(ang - spread))).toFixed(0)} L${(x + ln * Math.cos(r(ang + spread))).toFixed(0)} ${(y + ln * Math.sin(r(ang + spread))).toFixed(0)}Z`;
    o += `<path d="${p}" fill="var(--cam)" opacity=".13"/><path d="${p}" fill="none" stroke="var(--cam)" stroke-dasharray="3 4"/><rect x="${x - 6}" y="${y - 10}" width="12" height="20" rx="3" fill="var(--cam)" transform="rotate(${ang + 90} ${x} ${y})"/>`;
  }
  if (t.walk) o += `<path d="${t.walk}" stroke="var(--path)" stroke-width="2.5" stroke-dasharray="7 6" fill="none" class="walk"/>`;
  if (t.fig) { const [x, y, a = 0] = t.fig; o += `<g transform="translate(${x} ${y}) rotate(${a})"><ellipse rx="16" ry="9" fill="var(--path)"/><circle cx="2" r="7.5" fill="var(--surface)" stroke="var(--path)" stroke-width="2"/></g>`; }
  (t.text || []).forEach(([x, y, s, cls]) => { o += `<text x="${x}" y="${y}" class="tl ${cls || ''}">${esc(s)}</text>`; });
  return `<svg viewBox="0 0 400 230" class="plan" role="img" aria-label="Draufsicht">${o}</svg>`;
}

// ---------- 3D-Bilder (einmal rendern, dann aus dem Speicher)
const shotCache = new Map();
let R = null;
function renderer() {
  if (R || !window.THREE || !window.Figure3D) return R;
  R = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  R.shadowMap.enabled = true; R.shadowMap.type = THREE.PCFSoftShadowMap;
  R.outputEncoding = THREE.sRGBEncoding; R.toneMapping = THREE.ACESFilmicToneMapping; R.toneMappingExposure = 1.15; R.setPixelRatio(1);
  return R;
}
function snap(scene, cam, w, h, bg) {
  const r = renderer(); r.setSize(w, h, false); scene.background = new THREE.Color(bg); r.render(scene, cam);
  return r.domElement.toDataURL('image/jpeg', 0.86);
}
function phoneShot(def) {
  const k = 'p' + JSON.stringify(def);
  if (!shotCache.has(k)) {
    const { scene, cam } = Figure3D.build(def);
    const c = new THREE.PerspectiveCamera(cam.fov, 540 / 960, 0.03, 40); c.position.copy(cam.pos); c.lookAt(cam.look);
    shotCache.set(k, snap(scene, c, 540, 960, def.room === 'street' ? 0x07080b : 0x111317));
  }
  return shotCache.get(k);
}
function sideGeom(s) {
  const left = -0.6, bottom = -0.35, span = Math.max(s.dist + 1.9, (2.3 - bottom) * 800 / 460), right = left + span, top = bottom + (span * 460) / 800;
  return { left, right, bottom, top, span };
}
function sideShot(s) {
  const k = 's' + JSON.stringify(s);
  if (!shotCache.has(k)) {
    const g = sideGeom(s);
    const scene = Figure3D.sideScene(s.h / 100, s.tilt, s.dist, s.pose, s);
    const c = new THREE.OrthographicCamera(g.left, g.right, g.top, g.bottom, 0.1, 20); c.position.set(0, 0, 6); c.lookAt(0, 0, 0); c.updateProjectionMatrix();
    shotCache.set(k, snap(scene, c, 800, 460, 0x101318));
  }
  return shotCache.get(k);
}
function sideLabels(s) {
  const g = sideGeom(s), X = (x) => ((x - g.left) / g.span) * 800, Y = (y) => ((g.top - y) / (g.top - g.bottom)) * 460;
  const h = s.h / 100, px = X(0), py = Y(h), gy = Y(0), fx = X(s.dist), a = (s.tilt * Math.PI) / 180;
  let o = `<line x1="${px}" y1="${gy}" x2="${px}" y2="${py + 14}" stroke="#ffd79a" stroke-dasharray="3 4" stroke-width="2"/><text x="${px - 14}" y="${(gy + py) / 2 + 8}" text-anchor="end" class="lab warm">${s.h} cm</text>`;
  if (s.tilt) { const r = 70; o += `<line x1="${px}" y1="${py}" x2="${px + r + 30}" y2="${py}" stroke="#9a9890" stroke-dasharray="2 4"/><path d="M${px + r} ${py} A${r} ${r} 0 0 0 ${px + r * Math.cos(a)} ${py - r * Math.sin(a)}" fill="none" stroke="#ffd79a" stroke-width="2.5"/><text x="${px + r + 12}" y="${py - r * Math.sin(a / 2) + 4}" class="lab warm">${s.tilt}°</text>`; }
  o += `<line x1="${px}" y1="${gy + 24}" x2="${fx}" y2="${gy + 24}" stroke="#9a9890" stroke-width="2"/><line x1="${px}" y1="${gy + 14}" x2="${px}" y2="${gy + 34}" stroke="#9a9890" stroke-width="2"/><line x1="${fx}" y1="${gy + 14}" x2="${fx}" y2="${gy + 34}" stroke="#9a9890" stroke-width="2"/><text x="${(px + fx) / 2}" y="${gy + 56}" text-anchor="middle" class="lab">${String(s.dist).replace('.', ',')} m</text>`;
  o += `<text x="784" y="36" text-anchor="end" class="lab cam">Linse ${esc(s.lens)}</text>`;
  return o;
}
function paint3d() {
  if (!renderer()) return;
  if (Figure3D.ready && !paint3d.ok) { Figure3D.ready.then(() => { paint3d.ok = true; paint3d(); }); return; }
  // nacheinander, damit das Handy nicht hängt
  const jobs = [...document.querySelectorAll('img[data-scene]:not([src]), img[data-side]:not([src])')];
  const step = () => {
    const img = jobs.shift(); if (!img) return;
    try {
      if (img.dataset.scene) img.src = phoneShot(JSON.parse(img.dataset.scene));
      else { const s = JSON.parse(img.dataset.side); img.src = sideShot(s); img.nextElementSibling.innerHTML = sideLabels(s); }
    } catch (e) { console.warn('3D', e); }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

// ---------- Tab Captions
function renderCaptions() {
  const posts = Object.entries(POSTS).sort((a, b) => a[1].date.localeCompare(b[1].date));
  return posts.map(([id, p]) => `<section class="card" id="cap-${esc(id)}"><div class="kind">${esc(p.type)} · ${short(p.date)} ${esc(p.time)}</div><h2>${esc(p.title)}</h2>
    ${p.hook ? `<p class="hook">«${esc(p.hook)}»</p>` : ''}
    ${p.cover ? `<p class="note"><b>Cover:</b> ${esc(p.cover)}</p>` : ''}
    ${p.slides ? `<div class="gh">Slides</div><ol class="slides">${p.slides.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>` : ''}
    <div class="gh">Caption</div><div class="cap">${esc(p.caption || 'Noch keine Caption.')}</div>
    ${p.check ? `<p class="capcheck">${esc(p.check)}</p>` : ''}
    ${p.caption ? `<div class="btns"><button class="btn fill" data-action="copy" data-id="${esc(id)}">${IC.copy}Caption kopieren</button></div>` : ''}</section>`).join('');
}

// ---------- Tab Ideen
function renderIdeas() {
  const kinds = ['Alle', 'Idee', 'Bereit', 'Geparkt'];
  const list = IDEAS.filter((i) => ideaFilter === 'Alle' || i.status === ideaFilter);
  return `<div class="seg">${kinds.map((k) => `<button class="${k === ideaFilter ? 'sel' : ''}" data-action="idea-filter" data-k="${k}">${k}</button>`).join('')}</div>
    ${list.map((i) => `<section class="card"><div class="kind">${esc(i.kind)}</div><h2>${esc(i.title)}</h2>
      <div class="meta">${i.verse ? `<span>${esc(i.verse)}</span>` : ''}<span class="pill${i.status === 'Bereit' ? ' gold' : ''}">${esc(i.status)}</span></div>
      ${i.note ? `<p class="note">${esc(i.note)}</p>` : ''}</section>`).join('') || '<p class="note">Keine Ideen in dieser Liste.</p>'}
    <p class="note">Neue Idee? In data.js unter IDEAS eine Zeile ergänzen oder Claude schreiben.</p>`;
}

// ---------- Darstellen
function render() {
  renderDays();
  const app = document.getElementById('app');
  const html = { week: renderWeek, shoot: renderShoot, captions: renderCaptions, ideas: renderIdeas }[tab]();
  app.innerHTML = html + '<p class="verse">Pressure makes us. Hope keeps us. · Römer 8:18</p>';
  document.querySelectorAll('.tabs button').forEach((b) => b.classList.toggle('sel', b.dataset.tab === tab));
  if (tab === 'shoot') paint3d();
}
function toast(msg) {
  const t = document.createElement('div'); t.className = 'toast'; t.textContent = msg; document.body.appendChild(t);
  setTimeout(() => t.remove(), 1800);
}
function goto(newTab, anchor) {
  tab = newTab; render();
  if (anchor) requestAnimationFrame(() => document.getElementById(anchor)?.scrollIntoView({ block: 'start' }));
  else window.scrollTo(0, 0);
}

document.addEventListener('click', (e) => {
  const b = e.target.closest('[data-action]'); if (!b) return;
  const a = b.dataset.action;
  if (a === 'tab') goto(b.dataset.tab);
  if (a === 'day') { selDate = b.dataset.date; render(); }
  if (a === 'tick') {
    const id = b.dataset.id; store.done[id] = !isOn(id); save();
    const y = window.scrollY;
    // Bilder im Drehplan nicht neu laden: nur Zeile und Karte umschalten
    if (tab === 'shoot') {
      document.querySelectorAll(`[data-action="tick"][data-id="${CSS.escape(id)}"]`).forEach((el) => {
        el.classList.toggle('on', isOn(id)); el.setAttribute('aria-pressed', isOn(id));
        const t = el.querySelector('.title'); if (t && el.closest('.shot-done')) t.textContent = isOn(id) ? 'Gedreht' : 'Als gedreht abhaken';
        el.closest('.card')?.classList.toggle('complete', isOn(id));
      });
    } else { render(); window.scrollTo(0, y); }
    if (navigator.vibrate) navigator.vibrate(8);
  }
  if (a === 'open-shoot') { shootId = b.dataset.id; goto('shoot'); }
  if (a === 'open-caption') goto('captions', 'cap-' + b.dataset.id);
  if (a === 'shoot') { shootId = b.dataset.id; render(); }
  if (a === 'idea-filter') { ideaFilter = b.dataset.k; render(); }
  if (a === 'copy') {
    const text = POSTS[b.dataset.id]?.caption || '';
    const done = () => toast('Caption kopiert');
    if (navigator.clipboard?.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(b, text));
    else fallbackCopy(b, text);
  }
});
function fallbackCopy(btn, text) {
  const box = btn.closest('.card').querySelector('.cap');
  const r = document.createRange(); r.selectNodeContents(box); const s = getSelection(); s.removeAllRanges(); s.addRange(r);
  try { document.execCommand('copy'); toast('Caption kopiert'); } catch { toast('Text markiert, jetzt kopieren'); }
}

render();
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
