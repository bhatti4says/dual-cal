
# Dual Calendar (v2) — Gregorian + Hijri (Umm‑al‑Qura aligned)

**What’s new**
- Default alignment to **Umm‑al‑Qura**: one‑shot call to Aladhan `gToH` (Umm‑al‑Qura based). If offline, a local anchor (1 Ramadan 1447 = 18 Feb 2026) is used so Ramadan days match KSA.
- **Weekend** highlight: Friday & Saturday.

## Deploy / Update

```bash
sudo cp index.html styles.css app.js /var/www/html/dual-cal/
# or unzip the zip into the same folder
sudo nginx -t && sudo systemctl reload nginx
```

## Notes
- The tabular algorithm is used offline, but a small **±2 day** offset aligns to Umm‑al‑Qura when available.
- Verify example: **Sun, Mar 1, 2026 (Gregorian) → 12 Ramadan 1447 AH** under Umm‑al‑Qura.
```
