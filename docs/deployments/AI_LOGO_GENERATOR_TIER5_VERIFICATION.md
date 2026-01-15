# AI Logo Generator — Tier 5 Verification Checklist

**Last Updated:** 2026-01-15

## A) Core Generation (Authenticated)

1. **Auth required**: Open `/apps/ai-logo-generator` while signed out → generation should be blocked (401 from API) with a calm error.
2. **Generate (prompts-only)**: Fill required inputs and generate with images OFF.
3. **Generate (with images)**: Toggle “Generate images” ON and generate; confirm image cards render when available.
4. **Variations clamp**: Try setting variations below 3 and above 8; confirm it clamps to **3–8** and UI reflects the server `countUsed` when returned.

## B) Draft UX (Rename / Favorite / Edited badge)

5. **Rename (Enter)**: Start rename, type a new name, press Enter → name updates and toast appears.
6. **Rename (Escape)**: Start rename, type changes, press Escape → rename cancels (no change).
7. **Rename (blur)**: Start rename, type new name, click outside → rename commits.
8. **Rename empty guard**: Clear the rename input and attempt to commit → app prevents empty names and keeps previous value.
9. **Favorite toggle**: Toggle favorite; confirm it updates immediately.
10. **Favorite sorting**: Favorite at least one logo; confirm favorites float to top while preserving stable order within favorites/non-favorites.
11. **Edited badge**: Confirm the “Edited” badge appears when name/favorite differs from defaults.

## C) Preview Zoom (Lightbox)

12. **Open preview**: Click an image thumbnail → modal opens.
13. **Escape closes**: Press Escape → modal closes.
14. **Focus return**: After closing, keyboard focus returns to the element that opened the modal.

## D) Tier 5C+ Integrations (Draft-only, apply-only)

### Social Auto-Poster

15. **Send handoff**: Click “Send to Social Auto-Poster”.
16. **Banner appears**: On Social Auto-Poster composer, confirm an AI Logo Generator import banner appears.
17. **Apply-only**: Confirm import does not auto-queue or auto-post; it should only add draft media.
18. **Tenant guard**: With mismatched businessId, Apply should be blocked with clear messaging.
19. **URL cleanup**: After Apply or Dismiss, confirm `?handoff=1` is removed from the URL.

### Brand Kit Builder

20. **Send handoff**: Click “Send to Brand Kit Builder”.
21. **Banner appears**: Confirm the Brand Kit import banner appears.
22. **Apply stages suggestion only**: Apply creates a **draft** suggested brand mark slot (no overwrite; nothing saved automatically).
23. **Clear suggestion**: Use “Clear suggested brand mark” and confirm it removes the draft suggestion.
24. **Tenant guard + URL cleanup**: Apply is blocked on mismatch; URL is cleaned after Apply/Dismiss.

### AI Help Desk (Widget)

25. **Send handoff**: Click “Suggest for Help Desk Icon”.
26. **Banner appears**: On AI Help Desk → Widget tab, confirm the suggestion banner appears.
27. **Apply stages draft only**: Apply prefills avatar URL input only; nothing persists until “Save Settings”.
28. **Clear suggested avatar**: Confirm “Clear suggested avatar” reverts/removes the applied suggestion from the draft field.
29. **URL cleanup**: Confirm handoff params are removed after Apply/Dismiss.

## E) Tier 6 Export (Fallback) — Bulk Export

30. **Progress UI**: Click “Bulk Export” and confirm progress shows `current/total`.
31. **Serialized downloads**: Observe downloads happen in a steady sequence (not all at once).
32. **Manifest download**: Confirm a manifest JSON downloads and includes failures array (even if empty).
33. **Failures handling**: If any image fetches fail, confirm failures are listed in the manifest with reasons.
34. **Completion summary**: Confirm “Export complete” summary panel appears with success/failure counts and a note about the manifest.

---

## Notes

- Run checks in both light and dark mode.
- For tenant-guard scenarios, test with a mismatched `businessId` in the URL vs the handoff payload.


