# North Shore Gymnastics Waitlist Tracker

## Project Overview
| Field | Value |
|-------|-------|
| **Live Site** | https://moser247.github.io/waitlist-tracker/ |
| **GitHub** | https://github.com/moser247/waitlist-tracker |
| **Created** | January 14, 2026 |
| **Contact** | (763) 479-3189 |

## Tech Stack
- **Frontend**: Pure vanilla HTML/CSS/JavaScript (no frameworks)
- **Hosting**: GitHub Pages
- **Data**: JSON fetched from GitHub raw URL
- **Updates**: Automated 3x daily (8:00 AM, 1:30 PM, 6:00 PM)

## Project Structure
```
waitlist-tracker/
├── index.html          # Main HTML
├── script.js           # All logic
├── style.css           # Styling
├── logo.png            # NSGA logo
├── CLAUDE.md           # This file
└── data/
    └── waitlist.json   # Auto-updated data
```

## Features
- **Three-tab interface**: Waitlists | Classes with Openings | Camps with Openings
- **Student search**: Multi-word matching, 300ms debounce
- **Class filters**: 13 categories (2s, 3/4s, Beginner→Master, Boys, Ninja Zone, etc.)
- **Color-coded status**: Green (0-7) | Yellow (8-14) | Red (15+)
- **Expandable cards**: Click to see full waitlist with positions
- **Accessibility**: ARIA labels, screen reader support, reduced motion

## Configuration (script.js)
```javascript
const CONFIG = {
    fetchTimeout: 10000,   // 10 second timeout
    maxRetries: 3,         // Retry with exponential backoff (1s, 2s, 4s)
    debounceDelay: 300     // 300ms search debounce
};
```

## Data Schema (waitlist.json)
```json
{
  "last_updated": "2026-01-28T14:01:02.368156",
  "waitlists": {
    "CLASS_NAME": [{ "position": 1, "name": "Last, First" }]
  },
  "classes_with_openings": [{ "name": "...", "classId": "...", "open_spots": 5 }],
  "camps_with_openings": [{ "name": "...", "open_spots": 5, "waitlist": 0 }],
  "camps_with_waitlist": [{ "name": "...", "waitlist": 3 }]
}
```

## Rules
- NEVER commit sensitive data to the repo
- Data updates are automated - do not manually edit waitlist.json
- Maintain accessibility (ARIA labels, semantic HTML)
- Test on mobile (responsive breakpoint at 480px)

---
*Last updated: January 30, 2026*
