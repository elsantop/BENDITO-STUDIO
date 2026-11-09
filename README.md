# BENDITO STUDIO

Content-App für @bendito.818 (ADAMANTVS): Wochenplan zum Abhaken, Drehpläne mit 3D-Figuren, fertige Captions und Ideen. Aufgebaut wie die Gym-Buddy-App: reine HTML/JS-PWA, läuft offline, speichert Häkchen lokal auf dem Handy.

**Live:** https://elsantop.github.io/BENDITO-STUDIO/

## Tabs

- **Woche**: Tage Mo–So, pro Tag Drehen, Posten und Aufgaben zum Abhaken, Fortschrittsring.
- **Drehplan**: pro Clip Handybild (9:16 mit On-Screen-Text), Seitenansicht mit Höhe/Winkel/Abstand, Draufsicht, HANDY / DU / TAKES und Plan B. Figuren sind 3D (three.js r128, lokal).
- **Captions**: fertige Caption pro Post, ein Tipp kopiert sie.
- **Ideen**: geplante und geparkte Reels und Karussells.

## Ändern

Alles Inhaltliche steht in **`data.js`**:

- `WEEK`: Titel, Fokus, Tage (`days['2026-11-10']`) mit Blöcken `{shoot}`, `{post}` oder Aufgaben.
- `POSTS`: Reel/Karussell mit Hook, Vers, Zeit, Aufgaben und Caption.
- `SHOOTS`: Drehplan pro Reel, Clips mit Szene (`scene`), Seitenansicht (`side`), Draufsicht (`top`).
- `IDEAS`: Ideenliste.

Nach jeder Änderung in `sw.js` die Cache-Version erhöhen (`studio-v1` → `studio-v2`), sonst zeigt das Handy die alte Version.

## Sonntags-Routine

Claude ersetzt `WEEK`, `POSTS` und `SHOOTS` mit der neuen Woche, erhöht die Cache-Version und pusht. Häkchen sind pro Woche an die IDs gebunden.

## Struktur

`index.html`, `styles.css`, `app.js` (Logik), `data.js` (Inhalt), `figure3d.js` (3D-Figuren und Szenen), `three.min.js`, `sw.js` (Offline-Cache), `manifest.webmanifest`, Icons.
