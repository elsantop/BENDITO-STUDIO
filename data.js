// BENDITO STUDIO – alle Inhalte der App stehen in dieser Datei.
// Kleine Änderungen (Text, Zeit, Caption, neue Idee) direkt hier auf GitHub machen.
// Abgehakt wird pro "id". Bleibt eine id gleich, bleibt auch das Häkchen erhalten.
// Jeden Sonntag lädt Claude hier die neue Woche (WEEK, SHOOTS, POSTS).

// ---------------------------------------------------------------------------
// WOCHE: was an welchem Tag zu tun ist
// Blöcke pro Tag: { shoot: 'id' } = Drehtag, { post: 'id' } = Beitrag,
//                 { title, kind, note, tasks: [{ id, t, n }] } = freie Aufgaben
// ---------------------------------------------------------------------------
const WEEK = {
  id: '2026-W46',
  title: 'KW 46',
  range: '9.–15. November 2026',
  focus: 'Zwei Posts, ein Gym-Morgen. Am Dienstag im Gym gleich die zwei Karussell-Fotos (Slide 5 und 8) mitnehmen.',
  daily: [
    { id: 'kom', title: 'Kommentieren bei UK/US-Accounts', note: '15 Min bei Nischen-Accounts mit 1k bis 50k Followern. Echte Sätze.' },
  ],
  days: {
    '2026-11-09': [],
    '2026-11-10': [
      { shoot: 'hr5' },
      { title: 'Fotos fürs Karussell', kind: 'Gleich mitnehmen', note: 'Du bist eh im Gym. Zwei Fotos, zusammen 2 Minuten.', tasks: [
        { id: 'nfy-f5', t: 'Slide 5 · Hand an der Kurzhantel, kurz vor dem Ziehen', n: 'POV, rechte Hand' },
        { id: 'nfy-f8', t: 'Slide 8 · Kapuze liegt auf der Hantelbank', n: 'Ruhig, warmes Licht' },
      ] },
      { post: 'hr5' },
    ],
    '2026-11-11': [
      { title: 'Fotos zu Hause', kind: 'Karussell', note: 'Für «No Face. Yet.»', tasks: [
        { id: 'nfy-f2', t: 'Slide 2 · Waage, Anzeige abgedeckt', n: 'Badezimmer morgens, Daumen oder Tape drauf' },
        { id: 'nfy-f6', t: 'Slide 6 · offene Bibel bei 1. Mose 39', n: 'Finger unter Vers 21, warmes Licht' },
      ] },
    ],
    '2026-11-12': [
      { title: 'Fotos unterwegs', kind: 'Karussell', tasks: [
        { id: 'nfy-f3', t: 'Slide 3 · Schuhe an der Haustür', n: 'Morgens, draussen dunkel, Uhrzeit im Bild' },
        { id: 'nfy-f4', t: 'Slide 4 · durchs Reifenregal fotografieren', n: 'Vor Arbeitsbeginn, Porträtmodus, kein Kennzeichen' },
      ] },
    ],
    '2026-11-13': [
      { title: 'Karussell bauen', kind: 'Canva', tasks: [
        { id: 'nfy-g1', t: '9 Slides bauen, Preset Cold Steel', n: 'Text immer unteres Drittel, ab Slide 6 wärmer' },
      ] },
    ],
    '2026-11-14': [
      { post: 'nfy' },
    ],
    '2026-11-15': [
      { title: 'Zahlen und neuer Plan', kind: 'Wochenabschluss', tasks: [
        { id: 'so-1', t: 'Insights von HR #5 und Karussell an Claude schicken', n: 'Aufrufe, Übersprungen-Rate, Follows, Länder' },
        { id: 'so-2', t: 'Neue Woche von Claude laden lassen' },
      ] },
    ],
  },
};

// ---------------------------------------------------------------------------
// BEITRÄGE: Reels und Karussells mit Caption
// ---------------------------------------------------------------------------
const POSTS = {
  hr5: {
    type: 'Reel', title: 'Hidden Reps #5', hook: 'I used to quit on day 3.',
    verse: 'Galater 6:9', date: '2026-11-10', time: '19:00', shoot: 'hr5', cover: 'Glow-Satz aus dem Hook, darunter GALATIANS 6:9, darunter das Kreuz. Bild aus Clip 3.',
    tasks: {
      Schneiden: [
        { id: 'hr5-s1', t: '5 Clips auf den Beat schneiden', n: 'Clip 3 auf 130 %, Loop: leere Bank am Ende = Anfang' },
        { id: 'hr5-s2', t: 'Texte einsetzen', n: 'Eine Zeile pro Clip, 0,2 s nach Schnitt, Verblassen 0,4 s' },
        { id: 'hr5-s3', t: 'Trend-Sound in Instagram wählen' },
        { id: 'hr5-s4', t: 'Cover aus Clip 3 bauen', n: 'Glow-Satz, GALATIANS 6:9, Kreuz' },
      ],
      Posten: [
        { id: 'hr5-p1', t: 'Caption einfügen (Tab Captions)' },
        { id: 'hr5-p2', t: 'Reel posten um 19:00' },
        { id: 'hr5-p3', t: 'Ersten Kommentar anpinnen' },
      ],
    },
    caption: `I used to quit on day 3. Every diet, every plan, every promise I'd made to myself.

Week 14 of my weight loss journey now. Nothing special happened. I just kept showing up on day 4. That's what christian fitness means to me.

"And let us not grow weary of doing good, for in due season we will reap, if we do not give up."
– Galatians 6:9 (ESV)

Share this with someone who's on their day 3.
New hidden rep every Tue & Sat.

#hiddenreps #christianfitness #weightlossjourney #galatians69`,
    check: 'caption.py READY · Human Score 81.7',
  },
  nfy: {
    type: 'Karussell', title: 'No Face. Yet.', hook: 'Nobody here has seen my face.',
    verse: '1. Mose 39:21', date: '2026-11-14', time: '19:00',
    note: '9 Slides über Josef. Slide 1 und 7 sind fertig.',
    slides: [
      'NOBODY HERE HAS SEEN MY FACE. · That\'s on purpose.',
      'BECAUSE I\'M NOT DONE YET. · −10.5 kg since August. Most of it, nobody saw.',
      'JOSEPH KNEW THIS FEELING. · Sold by his own brothers. Forgotten.',
      'THE PIT. THEN THE PRISON. · Years locked away for something he didn\'t do.',
      'HE KEPT DOING THE WORK. · Faithful in the small things. Nobody watching.',
      'BUT HE WAS NEVER ALONE. · Not in the pit. Not in the prison.',
      'THEY DIDN\'T RECOGNIZE HIM. · Years later, his brothers stood right in front of him.',
      '"BUT THE LORD WAS WITH JOSEPH." · Genesis 39:21',
      'MY FACE COMES WHEN THE WORK IS DONE. · Follow, so you\'re here the day they don\'t recognize me.',
    ],
    tasks: {
      Posten: [
        { id: 'nfy-p0', t: 'Caption einfügen (Tab Captions)' },
        { id: 'nfy-p1', t: 'Karussell posten um 19:00' },
        { id: 'nfy-p2', t: 'Ersten Kommentar anpinnen' },
      ],
    },
    caption: `No face. Not yet.
−10.5 kg since August. Faith and fitness, mostly where nobody saw it.

"But the LORD was with Joseph and showed him steadfast love and gave him favor in the sight of the keeper of the prison."
– Genesis 39:21 (ESV)

What are you building where nobody's watching? Tell me in the comments.

New hidden rep every Tue & Sat. Follow so you're here when the face comes.

#hiddenreps #christianfitness #faithandfitness #genesis39`,
    check: 'caption.py READY · Human Score 88.3',
  },
};

// ---------------------------------------------------------------------------
// DREHPLÄNE: pro Clip Handybild (3D), Seitenansicht, Draufsicht
// side: h = Handy-Höhe in cm, tilt = Winkel nach oben in °, dist = Abstand in m
// scene: 3D-Szene fürs Handybild (Posen: walkHood, walk, sit, press, dead, pullLow, pullUp)
// top: Draufsicht (Koordinaten 400 × 230)
// ---------------------------------------------------------------------------
const GYM_BENCH = { room: 'gym', wallZ: -1.4, lamp: [0.9, 2.8, -0.4], props: [{ t: 'bench', x: 0.95 }], cam: { pos: [-1.9, 0.5, 2.5], look: [0.35, 0.85, 0], fov: 62 } };

const SHOOTS = {
  hr5: {
    title: 'Hidden Reps #5', date: '2026-11-10', where: 'Gym, früh morgens', length: '13,6 s',
    order: [
      { tag: 'A', text: 'Clip 4 draussen', min: '2 min' },
      { tag: 'B', text: 'Clip 1 + 5 an der Bank', min: '3 min' },
      { tag: 'C', text: 'Clip 2 Schulterdrücken, Clip 3 Kreuzheben', min: '4 min' },
    ],
    rules: ['4K 30 fps, Clip 2: 1080p 60', 'Belichtung sperren und runterziehen', 'Kein Spiegel, niemand erkennbar', 'Gleicher Hoodie, Kapuze auf'],
    clips: [
      { id: 'hr5-c1', n: 1, img: 'previz/hr5-c1.jpg', t: '0,0–2,8 s', setup: 'B', ost: ['I USED TO QUIT', 'ON DAY 3.'],
        scene: { ...GYM_BENCH, person: { pose: 'walkHood', x: -0.25 } },
        end: { ...GYM_BENCH, person: { pose: 'sit', x: 0.8, z: 0.02, rot: 90 } }, endLabel: 'Ende = Start Clip 5',
        side: { h: 50, tilt: 10, dist: 2, pose: 'walkHood', lens: '1×' },
        top: { mirror: true, items: [{ t: 'bench', x: 190, y: 98, w: 110, label: 'Bank' }], cam: [100, 200, -30], walk: 'M20 112 H200', fig: [212, 112, 0] },
        handy: 'Schräg hinter der Bank auf einer Box, an die Flasche gelehnt.', du: 'Von links rein, Kapuze hochziehen, hinsetzen, Kopf runter.', takes: '2× · 1 min', b: 'Keine Box: Handy auf den Boden, Winkel 15°.' },
      { id: 'hr5-c2', n: 2, img: 'previz/hr5-c2.jpg', t: '2,8–4,6 s', setup: 'C', ost: ['THIS IS WEEK 14.'],
        scene: { room: 'gym', wallZ: -2.2, lamp: [0.9, 2.9, -0.7, 2.8], props: [{ t: 'bench', x: -0.3 }, { t: 'dumbbell', p: [0.03, 1.63, 0.25] }, { t: 'dumbbell', p: [0.03, 1.63, -0.25] }, { t: 'fill', p: [-0.8, 1.4, 0.9], i: 2.2 }], person: { pose: 'press' }, cam: { pos: [-1.7, 0.22, 0.35], look: [0, 1.15, 0], fov: 72 } },
        side: { h: 20, tilt: 35, dist: 1.7, pose: 'press', lens: '1×', prop: 'benchUnder', fovHalf: 26 },
        top: { items: [{ t: 'bench', x: 150, y: 92, w: 110, label: 'Bank (Ende)', ly: 80 }], cam: [110, 120, -8, 34, 150], fig: [250, 106, 0], text: [[40, 160, 'Boden, hinter der Bank', 'cam']] },
        handy: 'Am Boden 1,7 m hinter der Bank, an die Flasche gelehnt, schaut schräg hoch auf Rücken und Hanteln. 1080p 60 fps.', du: 'Kurzhantel-Schulterdrücken sitzend, Rücken zum Handy. Hanteln oben kurz halten.', takes: '2 Sätze à 6', b: 'Kein freier Platz: stehend drücken, gleiche Handy-Position.' },
      { id: 'hr5-c3', n: 3, img: 'previz/hr5-c3.jpg', t: '4,6–7,4 s', setup: 'C', ost: ['−10.5 KG SO FAR.'],
        scene: { room: 'gym', wallZ: -2.2, lamp: [0.2, 2.9, 0, 3.2], props: [{ t: 'barbell', x: 0.15, y: 0.66 }], person: { pose: 'dead' }, cam: { pos: [-1.5, 0.35, 2.3], look: [0, 0.85, 0], fov: 60 } },
        side: { h: 35, tilt: 10, dist: 2.5, pose: 'dead', lens: '1×', prop: 'barbell' },
        top: { items: [{ t: 'barbell', x: 240, y: 112 }], cam: [90, 205, -35, 26, 170], fig: [222, 112, 0], text: [[40, 222, 'schräg hinter dir, Boden', 'cam']] },
        handy: 'Am Boden 2,5 m schräg hinter dir (45°), an die Flasche gelehnt. Belichtung auf die Lampe sperren und runterziehen.', du: 'Kreuzheben, echter Arbeitssatz. Gefilmt werden die letzten 2 Wiederholungen.', takes: '1 Satz', b: 'Plattform besetzt: Kurzhantel-Rudern auf der Bank, gleiche Handy-Position.' },
      { id: 'hr5-c4', n: 4, img: 'previz/hr5-c4.jpg', t: '7,4–10,6 s', setup: 'A', ost: ['NOBODY SEES THE', 'DAYS IN BETWEEN.'],
        scene: { room: 'street', wallZ: -1.2, door: [-2.2], lamp: [-2.2, 2.4, -1.0, 2.2], person: { pose: 'walk', bag: true, rot: 180, x: -0.4 }, cam: { pos: [1.3, 0.4, 1.9], look: [-0.9, 0.95, -0.3], fov: 100 } },
        side: { h: 40, tilt: 0, dist: 1.8, pose: 'walk', lens: '0,5×', bag: true, flip: true },
        top: { building: true, cam: [330, 200, -150, 48, 150], walk: 'M300 116 H90', fig: [230, 116, 180] },
        handy: 'Draussen auf Mauer oder Boden, an die Tasche gelehnt. Belichtung aufs Türlicht.', du: 'Langsam von rechts nach links zur Tür, Tasche über der Schulter.', takes: '2× · 2 min', b: 'Zu viel los: gleiches Bild im Gang drinnen. Nie Garderobe.' },
      { id: 'hr5-c5', n: 5, img: 'previz/hr5-c5.jpg', t: '10,6–13,6 s', setup: 'B', ost: ["DON'T QUIT", 'ON DAY 3.'],
        scene: { ...GYM_BENCH, person: { pose: 'walk', x: 1.55, z: 0.25 } },
        side: { h: 50, tilt: 10, dist: 2, pose: 'walk', lens: '1×' },
        top: { mirror: true, items: [{ t: 'bench', x: 190, y: 98, w: 110, label: 'Bank' }], cam: [100, 200, -30], walk: 'M258 112 H384', fig: [246, 112, 0] },
        handy: 'Gleiche Marke wie Clip 1. Direkt danach drehen, Handy nicht anfassen.', du: 'Kopf hoch, aufstehen, rechts raus. Bank 1 s leer lassen.', takes: '2× · 1 min', b: 'Loop: leere Bank am Ende = leere Bank am Anfang von Clip 1.' },
    ],
    edit: ['Clips 1–5 auf den Beat · Text 0,2 s nach Schnitt, Verblassen 0,4 s, im gestrichelten Feld', 'Clip 3 auf 130 % · Night Shift · Trend-Sound in Instagram · Cover aus Clip 3'],
    ready: 'REEL READY · Hook 77.8 STRONG · Loop ok · 3 Setups · Caption READY',
  },
};

// ---------------------------------------------------------------------------
// IDEEN: Sammlung für später. status: 'Idee' | 'Bereit' | 'Geparkt'
// ---------------------------------------------------------------------------
const IDEAS = [
  // hook = On-Screen-Satz (Englisch), score = Hook-Score aus /ig-reel, where = Drehort
  { id: 'i-hr3', kind: 'Reel', where: 'Gym', hook: 'Under pressure.', title: 'Hidden Reps #3', verse: '1. Korinther 10:13', status: 'Bereit', note: 'Schnittplan ist fertig (Projektdateien). Nur noch posten, wenn eine Woche ohne neuen Dreh ist.' },
  { id: 'i-6am', kind: 'Reel', where: 'Werkstatt', hook: 'Nobody claps for you at 6 am.', score: 81, verse: 'Kolosser 3:23', status: 'Idee', note: 'Werkstatt vor Arbeitsbeginn: Licht an, Rolltor, erster Schlagschrauber. Eine Zeile pro Clip, Vers als Schluss.' },
  { id: 'i-rep8', kind: 'Reel', where: 'Gym', hook: 'Rep 8 is where I used to quit.', score: 78, verse: 'Psalm 18:32', status: 'Idee', note: 'Ein Satz, gezählt von Rep 1 bis 10. Bei Rep 8 Speed-Ramp auf langsam, dann zwei Reps mehr als früher.' },
  { id: 'i-7things', kind: 'Karussell', where: 'Zuhause', hook: '7 things I quit for this.', score: 78, verse: 'Hebräer 12:1', status: 'Idee', note: 'Pro Slide ein Ding, das du losgelassen hast (z. B. Energy Drinks, Snooze, Nachtessen um 23 Uhr). Letzte Slide: was du dafür bekommen hast.' },
  { id: 'i-steps', kind: 'Reel', where: 'Draussen', hook: '10,000 steps instead of quitting.', score: 63, verse: 'Jesaja 40:31', status: 'Idee', note: 'Abendspaziergang, Schuhe POV, Strassenlampen. Für die Tage ohne Gym.' },
  { id: 'i-w15', kind: 'Karussell', where: 'Zuhause', hook: 'Week 1 vs. week 15.', score: 63, verse: 'Klagelieder 3:22–23', status: 'Idee', note: 'Nur wenn du die Zahlen zeigen willst. Ohne Gesicht: gleiche Ecke, gleicher Hoodie, gleiches Licht.' },
  { id: 'i-512', kind: 'Reel', where: 'Gym', hook: "5:12 am. Nobody's watching you.", score: 58, verse: 'Matthäus 6:6', status: 'Idee', note: 'Uhr auf dem Handy, leere Halle, Licht geht an. Passt in die Hidden-Reps-Reihe.' },
  { id: 'i-cars', kind: 'Reel', where: 'Werkstatt', hook: 'I fixed 9 cars today. Then me.', score: 55, verse: '2. Korinther 5:17', status: 'Idee', note: 'Zahl an den echten Tag anpassen. Werkstatt-Feierabend schneidet direkt auf das Gym.' },
  { id: 'i-60kg', kind: 'Reel', where: 'Gym', hook: 'Same 60 kg bar. Different me.', score: 55, verse: '2. Korinther 12:9', status: 'Idee', note: 'Gleiche Übung, gleiche Kamera wie in Woche 1. Gewicht an deine echte Zahl anpassen.' },
  { id: 'i-phone', kind: 'Reel', where: 'Zuhause', hook: "No phone until I've prayed.", score: 52, verse: 'Psalm 5:3', status: 'Idee', note: 'Wecker, Handy umgedreht, offene Bibel im ersten Licht. Ruhig, kein Drop.' },
  { id: 'i-torque', kind: 'Reel', where: 'Werkstatt', hook: '120 Nm. Every bolt. Every time.', score: 51, verse: 'Lukas 16:10', status: 'Idee', note: 'Drehmomentschlüssel klickt, Rad für Rad. Treu im Kleinen.' },
  { id: 'i-prep', kind: 'Reel', where: 'Zuhause', hook: 'Meal prep at 9 pm. Again.', score: 51, verse: '1. Korinther 9:27', status: 'Idee', note: 'Boxen füllen, Licht von oben, Uhr im Bild.' },
  { id: 'i-rom811', kind: 'Reel', where: 'Gym', hook: 'Römer 8:11', verse: 'Römer 8:11', status: 'Idee', note: 'Der Geist, der Jesus auferweckt hat, lebt in dir. Passt zu einem frühen Gym-Morgen im Dunkeln. Hook noch offen.' },
  { id: 'i-neh', kind: 'Reel', where: 'Werkstatt', hook: 'One hand.', verse: 'Nehemia 4:17', status: 'Idee', note: 'Mit einer Hand gebaut, in der anderen die Waffe. Eine Hand am Schlagschrauber.' },
  { id: 'i-workday', kind: 'Karussell', where: 'Werkstatt', hook: 'Workday.', status: 'Idee', note: 'Ein Arbeitstag vom Wecker bis zum Gym, Slide für Slide.' },
  { id: 'i-heaviest', kind: 'Karussell', where: 'Zuhause', hook: 'The Heaviest Weight', verse: '1. Mose 45:4 · 50:20', status: 'Geparkt', note: 'Face Reveal. Schliesst die Josef-Geschichte von «No Face. Yet.» ab. Erst nach der Transformation.' },
];
