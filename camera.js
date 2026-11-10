// BENDITO STUDIO – Kamera im Drehplan.
// Öffnet die Rückkamera mit der Linse aus dem Clip (1× oder 0,5×), zeigt Safe Zone, Text,
// Drittel-Raster und eine Wasserwaage für den Neigungswinkel. Aufnahme wird über das
// Teilen-Menü in Fotos gesichert.
(function () {
  const $ = (s, r = document) => r.querySelector(s);
  const RES = { '720': [1280, 720], '1080': [1920, 1080], '4k': [3840, 2160] };
  let fmt = { res: '1080', fps: 60 };
  try { Object.assign(fmt, JSON.parse(localStorage.getItem('studio.cam') || '{}')); } catch { }
  let stream = null, rec = null, chunks = [], devices = [], lens = '1', clip = null, tiltOn = false, recStart = 0, timer = null;

  const html = () => `
  <div class="camv" role="dialog" aria-modal="true" aria-label="Kamera">
    <video playsinline muted autoplay></video>
    <div class="cam-ui t"></div><div class="cam-ui b"></div><div class="cam-ui r"></div>
    <div class="cam-grid"></div><div class="cam-sz"></div>
    <div class="cam-ost"></div>
    <header class="cam-top">
      <button class="cam-x" data-cam="close" aria-label="Kamera schliessen"><svg viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></svg></button>
      <div class="cam-title"><b></b><span></span></div>
      <button class="cam-txt" data-cam="text" aria-pressed="true">Text</button>
    </header>
    <div class="cam-level" hidden><div class="cam-arc"><i></i></div><p><b>0°</b><span></span></p></div>
    <footer class="cam-bot">
      <div class="cam-lens" role="group" aria-label="Linse"><button data-cam="lens" data-l="0.5">0,5×</button><button data-cam="lens" data-l="1">1×</button></div>
      <button class="cam-rec" data-cam="rec" aria-label="Aufnahme starten"><i></i></button>
      <button class="cam-tilt" data-cam="tilt">Winkel</button>
    </footer>
    <div class="cam-side">
      <button class="cam-native" data-cam="native"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-2.5h6L17 8h3v11H4z"/><circle cx="12" cy="13" r="3.6"/></svg><span>iPhone-Kamera</span></button>
      <button class="cam-quick" data-cam="quick">Schnell-Kamera</button>
      <button class="cam-fmtbtn" data-cam="fmt" aria-expanded="false"><b></b><span></span></button>
      <div class="cam-fmt" hidden>
        <p>Qualität</p>
        <div class="cam-seg" role="group" aria-label="Qualität"><button data-cam="res" data-v="720">720p</button><button data-cam="res" data-v="1080">1080p</button><button data-cam="res" data-v="4k">4K</button></div>
        <p>Bilder pro Sekunde</p>
        <div class="cam-seg" role="group" aria-label="Bilder pro Sekunde"><button data-cam="fps" data-v="24">24</button><button data-cam="fps" data-v="30">30</button><button data-cam="fps" data-v="60">60</button></div>
        <small class="cam-real">Läuft gerade mit –</small>
      </div>
      <label class="cam-exp" hidden><span>Helligkeit</span><input type="range" data-cam-exp min="-2" max="2" step="0.1" value="0"></label>
    </div>
    <input class="cam-file" type="file" accept="video/*" capture="environment" hidden>
    <div class="cam-setup" hidden>
      <h3>Echte Kamera-App mit einem Tipp</h3>
      <p>Safari darf die Kamera-App nicht direkt öffnen. Ein Kurzbefehl darf es. Einmal einrichten, dauert 1 Minute:</p>
      <ol>
        <li>Öffne die App <b>Kurzbefehle</b> und tippe oben rechts auf <b>+</b>.</li>
        <li>Suche die Aktion <b>App öffnen</b> und wähle <b>Kamera</b>.</li>
        <li>Tippe oben auf den Namen und nenne ihn genau <b>BENDITO STUDIO</b>. Fertig.</li>
      </ol>
      <div class="cam-setup-b">
        <a class="cam-setup-go" href="shortcuts://create-shortcut">Kurzbefehle öffnen</a>
        <button class="cam-setup-ok" data-cam="scok">Ist eingerichtet</button>
      </div>
      <button class="cam-setup-x" data-cam="scx">Später</button>
    </div>
    <p class="cam-time" hidden>00:00</p>
    <p class="cam-msg" hidden></p>
  </div>`;

  function msg(t) { const m = $('.cam-msg'); if (!m) return; m.textContent = t; m.hidden = !t; }

  async function listBack() {
    try { devices = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === 'videoinput'); } catch { devices = []; }
  }
  function pick(l) {
    const back = devices.filter((d) => !/front|vorder|facetime/i.test(d.label));
    if (l === '0.5') return back.find((d) => /ultra/i.test(d.label)) || back.find((d) => /dual.?wide|triple|dual-weitwinkel|dreifach/i.test(d.label));
    return back.find((d) => /^(back camera|rückkamera|rückseitige kamera)$/i.test(d.label.trim())) || back.find((d) => !/ultra|tele|dual|triple/i.test(d.label));
  }
  async function start(l) {
    stop();
    lens = l;
    document.querySelectorAll('.cam-lens button').forEach((b) => b.classList.toggle('sel', b.dataset.l === l));
    const [w, h] = RES[fmt.res] || RES['1080'];
    const base = { width: { ideal: w }, height: { ideal: h }, frameRate: { ideal: fmt.fps, max: fmt.fps } };
    showFmt();
    try {
      let dev = pick(l);
      stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: dev ? { ...base, deviceId: { exact: dev.deviceId } } : { ...base, facingMode: { ideal: 'environment' } } });
      if (!devices.some((d) => d.label)) { await listBack(); dev = pick(l); if (dev) { stream.getTracks().forEach((t) => t.stop()); stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...base, deviceId: { exact: dev.deviceId } } }); } }
      const track = stream.getVideoTracks()[0];
      // Falls es keine eigene Ultraweitwinkel-Kamera gibt: Zoom versuchen
      const cap = track.getCapabilities ? track.getCapabilities() : {};
      const ultra = l === '0.5' && /ultra/i.test(track.label || '');
      if (l === '0.5' && !ultra) {
        if (cap.zoom && cap.zoom.min <= 0.5) { await track.applyConstraints({ advanced: [{ zoom: cap.zoom.min }] }); msg(''); }
        else msg('0,5× lässt Safari hier nicht zu. Tipp auf «iPhone-Kamera».');
      } else msg('');
      // Helligkeit, wo der Browser es erlaubt (Android/Chrome). Safari kann das nicht.
      const ex = $('.cam-exp');
      if (cap.exposureCompensation) {
        const r = ex.querySelector('input'); r.min = cap.exposureCompensation.min; r.max = cap.exposureCompensation.max; r.step = cap.exposureCompensation.step || 0.1; r.value = 0; ex.hidden = false;
        try { await track.applyConstraints({ advanced: [{ exposureMode: 'continuous' }] }); } catch { }
      } else ex.hidden = true;
      $('.camv video').srcObject = stream;
      // Was Safari wirklich liefert
      const st = track.getSettings ? track.getSettings() : {};
      const got = Math.round(st.frameRate || 0), short = Math.min(st.width || 0, st.height || 0);
      const gotRes = short >= 2000 ? '4K' : short >= 1000 ? '1080p' : short ? short + 'p' : '?';
      $('.cam-real').textContent = `Läuft gerade mit ${gotRes} · ${got || '?'} fps`;
      $('.cam-fmtbtn span').textContent = got ? `${got} fps` : '';
      const want = fmt.res === '4k' ? '4K' : fmt.res + 'p';
      if ((got && got < fmt.fps - 1) || (short && gotRes !== want)) {
        const m = $('.cam-msg'); const extra = `${want} · ${fmt.fps} fps schafft Safari mit dieser Linse nicht, jetzt ${gotRes} · ${got} fps. Volle Qualität: «iPhone-Kamera».`;
        msg(m && !m.hidden && m.textContent ? m.textContent + ' ' + extra : extra);
      }
    } catch (e) {
      msg(e && e.name === 'NotAllowedError' ? 'Kamera ist blockiert. Erlaube sie in Einstellungen → Safari → Kamera.' : 'Kamera lässt sich nicht starten.');
    }
  }
  function showFmt() {
    const b = $('.cam-fmtbtn b'); if (!b) return;
    b.textContent = fmt.res === '4k' ? '4K' : fmt.res + 'p';
    document.querySelectorAll('[data-cam="res"]').forEach((x) => x.classList.toggle('sel', x.dataset.v === fmt.res));
    document.querySelectorAll('[data-cam="fps"]').forEach((x) => x.classList.toggle('sel', +x.dataset.v === +fmt.fps));
  }
  function setFmt(k, v) {
    fmt[k] = k === 'fps' ? +v : v;
    try { localStorage.setItem('studio.cam', JSON.stringify(fmt)); } catch { }
    if (rec && rec.state === 'recording') rec.stop();
    start(lens);
  }
  function bitrate() {
    const r = { '720': 6e6, '1080': 12e6, '4k': 35e6 }[fmt.res] || 12e6;
    return Math.round(r * (fmt.fps >= 50 ? 1.6 : 1));
  }
  // Öffnet über den Kurzbefehl «BENDITO STUDIO» die echte Kamera-App (0,5×, 4K 60, Helligkeit).
  function openNative() {
    if (rec && rec.state === 'recording') rec.stop();
    stop();
    location.href = 'shortcuts://run-shortcut?name=' + encodeURIComponent('BENDITO STUDIO');
  }
  // Zurück in der App: Kamera wieder starten
  document.addEventListener('visibilitychange', () => { if (!document.hidden && $('.camv') && !stream) start(lens); });
  function stop() { if (stream) stream.getTracks().forEach((t) => t.stop()); stream = null; }

  // Neigung: Hochformat, aufrecht = 0°, nach oben gekippt = positiv
  function onTilt(e) {
    if (e.beta == null) return;
    const a = Math.round(e.beta - 90), target = clip.side.tilt, d = a - target, ok = Math.abs(d) <= 2;
    const lv = $('.cam-level'); if (!lv) return;
    lv.classList.toggle('ok', ok);
    lv.querySelector('b').textContent = a + '°';
    lv.querySelector('span').textContent = ok ? 'passt' : (d < 0 ? `${-d}° weiter nach oben` : `${d}° weiter nach unten`);
    lv.querySelector('i').style.transform = `rotate(${Math.max(-40, Math.min(40, d * 2))}deg)`;
    if (ok && !onTilt.buzz && navigator.vibrate) navigator.vibrate(12);
    onTilt.buzz = ok;
  }
  async function toggleTilt() {
    if (!tiltOn) {
      try { if (window.DeviceOrientationEvent?.requestPermission) { const p = await DeviceOrientationEvent.requestPermission(); if (p !== 'granted') { msg('Ohne Bewegungssensor geht die Wasserwaage nicht.'); return; } } } catch { }
      window.addEventListener('deviceorientation', onTilt); tiltOn = true;
    } else { window.removeEventListener('deviceorientation', onTilt); tiltOn = false; }
    $('.cam-level').hidden = !tiltOn; $('.cam-tilt').classList.toggle('sel', tiltOn);
  }

  function recToggle() {
    const btn = $('.cam-rec');
    if (rec && rec.state === 'recording') { rec.stop(); return; }
    if (!stream || !window.MediaRecorder) { msg('Aufnehmen geht hier nicht. Nutze die Kamera-App mit diesen Werten.'); return; }
    const type = ['video/mp4', 'video/webm;codecs=h264', 'video/webm'].find((t) => MediaRecorder.isTypeSupported?.(t)) || '';
    chunks = []; rec = new MediaRecorder(stream, type ? { mimeType: type, videoBitsPerSecond: bitrate() } : undefined);
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = () => { btn.classList.remove('on'); clearInterval(timer); $('.cam-time').hidden = true; saveClip(new Blob(chunks, { type: rec.mimeType || 'video/mp4' })); };
    rec.start(); btn.classList.add('on'); recStart = Date.now(); $('.cam-time').hidden = false;
    timer = setInterval(() => { const s = Math.floor((Date.now() - recStart) / 1000); $('.cam-time').textContent = `00:${String(s).padStart(2, '0')}`; }, 250);
  }
  async function saveClip(blob) {
    const ext = blob.type.includes('mp4') ? 'mp4' : 'webm';
    const file = new File([blob], `clip-${clip.n}-take.${ext}`, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); return; } catch { } }
    const a = document.createElement('a'); a.href = URL.createObjectURL(file); a.download = file.name; a.click();
  }

  function open(c) {
    clip = c;
    document.body.insertAdjacentHTML('beforeend', html());
    document.documentElement.classList.add('cam-open');
    $('.cam-title b').textContent = `Clip ${c.n}`;
    $('.cam-title span').textContent = `${c.side.h} cm · ${c.side.tilt}° · ${String(c.side.dist).replace('.', ',')} m`;
    $('.cam-ost').innerHTML = (c.ost || []).map((l) => `<span>${l.replace(/[&<>"]/g, (m) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[m]))}</span>`).join('');
    requestAnimationFrame(() => $('.camv').classList.add('in'));
    if (!navigator.mediaDevices?.getUserMedia) { msg('Diese Ansicht braucht Safari auf dem iPhone.'); return; }
    start(/0[,.]5/.test(c.side.lens) ? '0.5' : '1');
  }
  function close() {
    if (rec && rec.state === 'recording') rec.stop();
    stop(); if (tiltOn) { window.removeEventListener('deviceorientation', onTilt); tiltOn = false; }
    const el = $('.camv'); if (!el) return;
    el.classList.remove('in'); document.documentElement.classList.remove('cam-open');
    setTimeout(() => el.remove(), 260);
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-cam]'); if (!b) return;
    const a = b.dataset.cam;
    if (a === 'close') close();
    if (a === 'lens') start(b.dataset.l);
    if (a === 'rec') recToggle();
    if (a === 'tilt') toggleTilt();
    if (a === 'fmt') { const p = $('.cam-fmt'), on = p.hidden; p.hidden = !on; b.setAttribute('aria-expanded', on); }
    if (a === 'res' || a === 'fps') setFmt(a, b.dataset.v);
    if (a === 'native') {
      let ready = false; try { ready = localStorage.getItem('studio.sc') === '1'; } catch { }
      if (!ready) { $('.cam-setup').hidden = false; return; }
      openNative();
    }
    if (a === 'scok') { try { localStorage.setItem('studio.sc', '1'); } catch { } $('.cam-setup').hidden = true; openNative(); }
    if (a === 'quick') { if (rec && rec.state === 'recording') rec.stop(); stop(); $('.cam-file').click(); }
    if (a === 'scx') $('.cam-setup').hidden = true;
    if (a === 'text') { const on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', on); $('.cam-ost').hidden = !on; }
  });
  document.addEventListener('input', (e) => {
    if (!e.target.matches('[data-cam-exp]') || !stream) return;
    const t = stream.getVideoTracks()[0];
    t.applyConstraints({ advanced: [{ exposureCompensation: +e.target.value }] }).catch(() => { });
  });
  document.addEventListener('change', async (e) => {
    if (!e.target.matches('.cam-file')) return;
    const f = e.target.files && e.target.files[0]; e.target.value = '';
    if (f) { const file = new File([f], `clip-${clip.n}-take.${(f.name.split('.').pop() || 'mov')}`, { type: f.type || 'video/quicktime' }); if (navigator.canShare?.({ files: [file] })) { try { await navigator.share({ files: [file] }); } catch { } } }
    if ($('.camv') && !stream) start(lens);
  });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  window.StudioCam = { open, close };
})();
