
# Dual Calendar (v2.1) — Gregorian + Hijri (Umm‑al‑Qura aligned)

**Changes in v2.1**
- Adds Hijri **month numbers** to displayed dates (e.g., `Ramadan (9)`).
- Still offline‑first; aligns to Umm‑al‑Qura by default (one‑shot Aladhan refine; local fallback anchor 1 Ramadan 1447 = 18 Feb 2026).

**Deploy**
```bash
sudo cp index.html styles.css app.js /var/www/html/dual-cal/
sudo nginx -t && sudo systemctl reload nginx
```
