# Meta App Review Readiness Checklist

This checklist ensures the OBD Social Auto-Poster is ready for Meta App Review submission.

---

## Pre-Submission Requirements

### ✅ Documentation
- [x] Permission justifications document (`docs/meta/permission-justifications.md`)
- [x] Screencast script (`docs/meta/review-screencast-script.md`)
- [x] Review readiness checklist (this document)

### ✅ UI/UX Requirements
- [ ] Permission explanation panel visible in setup page
- [ ] "What you'll see in Facebook" note displayed
- [ ] Disconnect button clearly visible when connected
- [ ] Revoke access instructions available
- [ ] Compliance links (Terms, Privacy, Data Deletion) accessible
- [ ] Clear error messages for all connection states
- [ ] Feature flag banner shown when `META_PUBLISHING_ENABLED=false`

### ✅ Functionality Requirements
- [ ] OAuth connection flow works end-to-end
- [ ] Connection status accurately reflects state
- [ ] Disconnect functionality works and removes all data
- [ ] Test post works (if publishing enabled)
- [ ] Activity log records all publishing attempts
- [ ] Error handling is robust and user-friendly
- [ ] No tokens or secrets in logs or error messages

### ✅ Security Requirements
- [ ] All API routes require authentication
- [ ] Premium access gating works correctly
- [ ] CSRF protection via state parameter
- [ ] Tokens encrypted at rest
- [ ] No sensitive data in error messages
- [ ] Comprehensive logging (without secrets)

### ✅ Compliance Requirements
- [ ] Terms of Service link accessible
- [ ] Privacy Policy link accessible
- [ ] Data Deletion request route available
- [ ] Clear data storage explanation
- [ ] User control over data (disconnect works)

---

## Connection Status States

The app must handle these states correctly:

### 1. NOT_CONNECTED
- **UI:** Shows "Not Connected" status
- **Action:** "Connect Facebook" button available
- **Error:** None

### 2. CONNECTED
- **UI:** Shows "Connected ✅" with Page name
- **Action:** "Disconnect Facebook" button available
- **Error:** None

### 3. NEEDS_REAUTH
- **UI:** Shows "Reconnect required" message
- **Action:** "Reconnect" button available
- **Error:** Token expired or invalid

### 4. ACCESS_REVOKED
- **UI:** Shows "Access revoked" message
- **Action:** "Reconnect" button available
- **Error:** Permissions removed or Page access lost

### 5. ERROR
- **UI:** Shows friendly error message
- **Action:** "Try Again" or "Learn More" link
- **Error:** Unknown failure (logged for debugging)

---

## Error Handling Verification

Test these scenarios and verify appropriate error messages:

### OAuth Errors
- [ ] User declines permission → Shows "Access denied" message
- [ ] Invalid state parameter → Shows "Invalid state" message
- [ ] Missing code parameter → Shows "Missing parameters" message
- [ ] Token exchange fails → Shows "Token exchange failed" message

### API Errors
- [ ] 401 Unauthorized → Shows "Please reconnect" message
- [ ] 403 Forbidden → Shows "Access revoked" message
- [ ] 500 Server Error → Shows "Something went wrong" (no internal details)
- [ ] Network timeout → Shows "Connection timeout" message

### Publishing Errors
- [ ] Page not found → Shows "Page not found" message
- [ ] Invalid access token → Shows "Please reconnect" message
- [ ] Rate limit exceeded → Shows "Rate limit" message with retry info
- [ ] Content policy violation → Shows "Content policy" message

---

## Feature Flag Behavior

### When `META_PUBLISHING_ENABLED=false`:
- [ ] Banner shown: "Facebook/Instagram publishing is in limited mode while we complete Meta App Review."
- [ ] Composer still works (posts can be created)
- [ ] Queue still works (posts can be scheduled)
- [ ] Simulate-run still works (preview functionality)
- [ ] Real publishing is disabled (no API calls to Meta)
- [ ] Test post button shows banner instead of publishing

### When `META_PUBLISHING_ENABLED=true`:
- [ ] No banner shown
- [ ] Real publishing works
- [ ] Test post publishes to Facebook/Instagram
- [ ] Scheduled posts publish automatically
- [ ] Activity log shows real post IDs and permalinks

---

## Logging Requirements

All logs must:
- [ ] Include userId (for debugging)
- [ ] Include platform (facebook/instagram)
- [ ] Include action (connect, disconnect, publish, etc.)
- [ ] Include errorCode (if error occurred)
- [ ] Include errorMessage (safe, user-friendly)
- [ ] NOT include tokens or secrets
- [ ] NOT include sensitive user data

Example log format:
```
[Meta OAuth] userId=abc123, platform=facebook, action=connect, errorCode=null, errorMessage=null
[Meta Publish] userId=abc123, platform=facebook, action=publish, errorCode=RATE_LIMIT, errorMessage=Rate limit exceeded
```

---

## Testing Checklist

### Local Testing
1. [ ] Start local dev server: `pnpm dev`
2. [ ] Navigate to setup page
3. [ ] Test connection flow (with test Facebook account)
4. [ ] Test disconnect flow
5. [ ] Test error scenarios (decline permission, invalid state, etc.)
6. [ ] Test feature flag behavior (set `META_PUBLISHING_ENABLED=false`)
7. [ ] Test compliance links (Terms, Privacy, Data Deletion)
8. [ ] Verify logs don't contain secrets

### Production Testing
1. [ ] Deploy to production: `vercel --prod --force`
2. [ ] Navigate to: `https://apps.ocalabusinessdirectory.com/apps/social-auto-poster/setup`
3. [ ] Test connection flow with real Facebook account
4. [ ] Test disconnect flow
5. [ ] Test test post (if publishing enabled)
6. [ ] Verify activity log shows entries
7. [ ] Test compliance links
8. [ ] Verify feature flag banner (if disabled)

---

## Post-Approval Steps

Once Meta App Review is approved:

1. **Enable Publishing:**
   - Go to Vercel Dashboard → Settings → Environment Variables
   - Set `META_PUBLISHING_ENABLED=true` for Production environment
   - Redeploy or wait for next deployment

2. **Verify Publishing Works:**
   - Test post should publish to Facebook
   - Scheduled posts should publish automatically
   - Activity log should show real post IDs

3. **Monitor:**
   - Check logs for any errors
   - Monitor user feedback
   - Watch for rate limit issues

---

## Common Issues and Solutions

### Issue: "Module not found: jose"
**Solution:** Ensure `jose` is in `package.json` dependencies and runtime is set to `nodejs`

### Issue: "Can't resolve 'jose'"
**Solution:** Check that route has `export const runtime = "nodejs"`

### Issue: Publishing doesn't work
**Solution:** Check `META_PUBLISHING_ENABLED` is set to `true` in production

### Issue: Connection status shows wrong state
**Solution:** Verify status endpoint returns correct state, check error handling logic

### Issue: Tokens in logs
**Solution:** Review all logging statements, ensure no tokens are logged

---

## Submission Checklist

Before submitting to Meta App Review:

- [ ] All documentation complete
- [ ] Screencast recorded and uploaded
- [ ] All functionality tested locally
- [ ] All functionality tested in production
- [ ] Error handling verified
- [ ] Logging verified (no secrets)
- [ ] Compliance links working
- [ ] Feature flag set to `false` (for initial review)
- [ ] Terms of Service and Privacy Policy accessible
- [ ] Data Deletion route functional

---

## Contact Information

For questions or issues:
- **Support Email:** support@ocalabusinessdirectory.com
- **Documentation:** `/docs/meta/`
- **Production URL:** `https://apps.ocalabusinessdirectory.com`

---

## Notes

- Keep feature flag `META_PUBLISHING_ENABLED=false` during initial review
- Enable publishing only after approval
- Monitor logs closely after enabling publishing
- Be prepared to provide additional documentation if requested by Meta

