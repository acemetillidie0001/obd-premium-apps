# App Scaffolding Template (v1)

Cursor must follow this pattern whenever creating a new app page.

---

# 1. Directory Structure

For any new app <slug>:

```
/app/apps/<slug>/page.tsx
/app/api/<slug>/route.ts
/app/components/<slug>/ (optional)
/public/apps/<slug>/assets (optional)
```

---

# 2. Dashboard Tile Requirements

Every tile must include:

- Title  
- One-line description (unless Coming Soon)  
- Button or Pill  
- Status (Live, Coming Soon, In Development)  
- Matching category  

Tile behavior is defined in `/docs/design-system.md`.

---

# 3. Page Layout Standard

Every app page follows this exact structure:

```
<Sidebar/>
<div class="max-w-4xl mx-auto py-10 px-6">
  <Breadcrumbs />
  <h1 class="text-3xl font-bold">App Name</h1>
  <p class="text-slate-500 mt-1">
    One-sentence description tailored to Ocala businesses.
  </p>
  <ThemeToggle />
  <MainForm />
  <OutputSection />
</div>
```
