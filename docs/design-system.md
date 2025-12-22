# OBD Design System (v1)

This document defines the UI/UX foundation for OBD Premium Apps. Cursor should apply these rules across all dashboards, tiles, components, and tool pages.

---

# 🎨 Brand Colors

## Primary Teal
- #00C2B2 — primary accent
- #0AC8E9 — alt blend
- #1EB9A7 — gradients
- #0E7C86 — dark mode teal

## Neutrals
- slate-900, slate-950 — dark mode surfaces
- slate-100, slate-200 — light mode surfaces
- white — card backgrounds (light)

---

# 🧊 Glass Tiles

### Live Tiles

```
bg-white/70 dark:bg-slate-900/60
backdrop-blur-xl
shadow-lg dark:shadow-xl
hover:-translate-y-1 hover:shadow-2xl
transition-all
```

### Coming Soon Tiles

```
bg-white/40 dark:bg-slate-800/40
opacity-70
no hover lift
shadow-sm dark:shadow-md
```

### In Development Tiles
Same as Coming Soon but with the pill reading **In Development**.

---

# 🟦 Pill Buttons
### Active Button

```
bg-teal-500 text-white hover:bg-teal-600
rounded-full px-4 py-1 text-sm font-semibold
```

### Coming Soon Pill

```
bg-teal-500/10 text-teal-600
border border-teal-500/20
rounded-full px-4 py-1 text-sm
```

---

# 🧩 Component Spacing
- Cards: `p-6 md:p-8`
- Section headings: `mb-4 mt-10`
- Grid gaps: `gap-6 md:gap-8`
- Global max-widths: `max-w-7xl mx-auto`

---

# 🌙 Dark Mode Rules
Dark mode panels:

```
bg-slate-900/60 rounded-2xl backdrop-blur-2xl
border border-slate-800/80
```

Gradient enhancement:

```
bg-gradient-to-b from-slate-900/70 to-slate-950/90
```

---

# 📱 Mobile Layout Rules
- Cards collapse to 1 column.
- Section headings centered.
- Pill buttons full width on sm screens.
- Sidebar collapses into a top dropdown (future feature).

---

# END
