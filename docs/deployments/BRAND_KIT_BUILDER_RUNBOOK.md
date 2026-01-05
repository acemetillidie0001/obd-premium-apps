# Brand Kit Builder — Final Deployment Runbook

**Date:** 2026-01-XX  
**Branch:** `chore/brand-kit-builder-ux-pass-1`  
**Latest Commit:** `fb915cb` - "docs(brand-kit): add Tier 5 production audit report"

---

## A) PR Creation + Merge

### Step 1: Open PR Creation Link
**URL:** https://github.com/acemetillidie0001/obd-premium-apps/pull/new/chore/brand-kit-builder-ux-pass-1

### Step 2: PR Title
```
Brand Kit Builder — Tier 5 completion (UX + prompt intelligence)
```

### Step 3: PR Description (Paste Exactly)
```
- Repositioned Brand Kit as suite foundation (above-the-fold clarity)
- Completeness meter + live Brand Snapshot card
- Advanced Brand Controls collapsed by default (reduced cognitive load)
- Added brand intelligence fields (customer descriptors + reasons to choose)
- Backend prompt support: Zod validated, empty fields filtered safely
- "Words to Avoid" clarity improvements
- Results improvements: "What Was Created" checklist + Quick Actions copy row
- Suite integration signals: "This powers your OBD tools" + Next Steps links (link-only, no handoff)
- Empty state refined + dark mode input text fixed
- Docs + Tier 5 audit report added
- Deployment report doc added for tracking
```

### Step 4: Wait for Checks
- ✅ Vercel preview deployment succeeds
- ✅ Any CI checks pass

### Step 5: Merge PR
- Use repo's standard merge strategy (merge commit or squash per convention)
- **Record merge commit hash:** _________________

---

## B) Vercel Verification (After Merge)

### Checklist:
- [ ] Production deployment triggered by merge to `main`
- [ ] Deployment status: **Ready** / Failed
- [ ] Deployed commit matches merge commit on `main`
- [ ] Vercel deployment URL/ID: _________________

**Vercel Dashboard:** https://vercel.com/dashboard

---

## C) Production Verification Checklist

**URL:** https://apps.ocalabusinessdirectory.com/apps/brand-kit-builder

### Test Results (Mark PASS/FAIL):

- [ ] **Dark mode inputs:** `brandVoice` + `toneNotes` text readable
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Brand Snapshot:** Updates live while typing
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Completeness meter:** Accurate based on core fields
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Advanced Brand Controls:** Expand/collapse works
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Generate flow:** Works and returns results
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **"What Was Created":** Shows correct items after generation
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Quick Actions:** Copy Full / GBP / Meta work
  - Result: PASS / FAIL
  - Notes: _________________

- [ ] **Next Steps links:** Navigate correctly
  - `/apps/content-writer` - PASS / FAIL
  - `/apps/review-responder` - PASS / FAIL
  - `/apps/social-media-post-creator` - PASS / FAIL
  - `/apps/faq-generator` - PASS / FAIL
  - `/apps/ai-help-desk` - PASS / FAIL

- [ ] **Empty state:** Shows only when `!result && !loading && !error`
  - Result: PASS / FAIL
  - Notes: _________________

---

## D) Update Deployment Report

**File:** `docs/deployments/BRAND_KIT_BUILDER_DEPLOYMENT_REPORT.md`

**Add final section with:**
- Date/time of production deploy
- Merge commit hash deployed
- Vercel deployment URL/ID
- Checklist results (PASS/FAIL)
- Notes/follow-ups
- Final status: "CLOSED / MAINTENANCE MODE"

---

## E) Commit Updated Report

**If deployment report was edited:**

```bash
git add docs/deployments/BRAND_KIT_BUILDER_DEPLOYMENT_REPORT.md
git commit -m "docs(brand-kit): finalize production deployment verification"
git push origin main
```

---

## Final Deliverable Template

```
PR URL: https://github.com/acemetillidie0001/obd-premium-apps/pull/XXX
Merged Commit Hash: _________________
Vercel Production Status: Ready / Failed
Checklist Results: X/9 PASS
Deployment Report Updated: Yes / No
Deployment Report Commit: _________________ (if committed)
Final Status: CLOSED / MAINTENANCE MODE
```

