
# Dual Calendar (Gregorian + Hijri)

Fast, offline‑first side‑by‑side calendars. Hijri uses the **tabular Islamic calendar** algorithm locally; optionally, a one‑shot refinement requests `gToH` from Aladhan to align with **Umm al‑Qura**/regional sightings.

## Files
- `index.html` — main page
- `styles.css` — styling
- `app.js` — logic (offline Hijri conversion + optional API refine)

## Quick start (Ubuntu + Nginx)

1) Copy files to your web root (e.g., `/var/www/html/dual-cal/`).

```bash
sudo mkdir -p /var/www/html/dual-cal
sudo cp index.html styles.css app.js /var/www/html/dual-cal/
```

2) Nginx server block (example):

```nginx
server {
    listen 80;
    server_name _;  # or your LAN hostname/IP
    root /var/www/html/dual-cal;
    index index.html;
    location / {
        try_files $uri $uri/ =404;
    }
}
```

Reload Nginx:
```bash
sudo nginx -t && sudo systemctl reload nginx
```

3) Open in a browser: `http://<server-ip>/dual-cal/`

## Notes
- **Accuracy**: The tabular algorithm can differ by 1–2 days from Umm al‑Qura in some months. Toggle **“Refine with API”** to fetch today’s Hijri date and adjust the whole calendar by a small offset (−2..+2 days) automatically. You can disable the toggle to go back to fully offline.
- **Performance**: Only a 1s clock interval runs when the tab is visible. No animations, no alerts, event delegation per cell—works well on modest hardware.
- **No external dependencies**: All logic is local. API refine is optional and runs once on demand.
```
