# Meta App Review Screencast Script

**Duration:** 2-3 minutes  
**Purpose:** Demonstrate the complete user flow from login to disconnect

---

## Pre-Recording Setup

1. **Test Account:**
   - Use a test Facebook account with at least one Facebook Page
   - Ensure the Page is eligible for Instagram Business account connection (if testing Instagram)
   - Clear browser cache and cookies

2. **Environment:**
   - Production URL: `https://apps.ocalabusinessdirectory.com`
   - Or local development with ngrok HTTPS URL
   - Ensure `META_PUBLISHING_ENABLED=false` for initial review (or `true` if publishing is approved)

3. **Recording Settings:**
   - Record at 1080p or higher
   - Show cursor movements clearly
   - Include audio narration (optional but recommended)
   - Keep recording smooth (no rapid scrolling or clicking)

---

## Script (Step-by-Step)

### [0:00-0:15] Introduction & Login

**Narration:**
"Today I'll demonstrate the OBD Social Auto-Poster Meta integration. This app helps local businesses schedule and publish posts to Facebook and Instagram."

**Actions:**
1. Navigate to: `https://apps.ocalabusinessdirectory.com`
2. Click "Sign In" or "Log In"
3. Complete authentication (magic link or credentials)
4. Wait for dashboard to load

**What to show:**
- Clean login screen
- Successful authentication
- Dashboard with "Social Auto Poster" tile visible

---

### [0:15-0:45] Navigate to Setup & View Connection Status

**Narration:**
"Let's navigate to the Social Auto-Poster setup page to connect a Facebook account."

**Actions:**
1. Click on "Social Auto Poster" tile from dashboard
2. Navigate to "Setup" tab (or `/apps/social-auto-poster/setup`)
3. Scroll to "Connect Accounts" section
4. Show the Meta connection status (should show "Not Connected")

**What to show:**
- Setup page with clear sections
- "Connect Accounts" section visible
- Facebook status showing "Not Connected"
- Permission explanation panel (if implemented)
- "What you'll see in Facebook" note

**Key Points:**
- Highlight the permission explanation panel
- Show that we explain what permissions are used for
- Show that users can disconnect anytime

---

### [0:45-1:30] Connect Facebook Account

**Narration:**
"Now I'll connect my Facebook account. When I click 'Connect Facebook', I'll be redirected to Facebook's consent screen where I can review and approve the permissions."

**Actions:**
1. Click "Connect Facebook" button
2. Wait for redirect to Facebook OAuth screen
3. **Pause briefly on Facebook consent screen** (important!)
4. Show the permissions being requested:
   - "View your public profile"
   - "View your Pages" (if pages access is requested)
5. Click "Continue" or "Allow" on Facebook
6. Wait for redirect back to setup page
7. Show success message or auto-refresh

**What to show:**
- Facebook OAuth consent screen clearly visible
- Permissions listed on consent screen
- User clicking "Continue" or "Allow"
- Redirect back to setup page
- Connection status updated to "Connected ✅"

**Key Points:**
- Emphasize that users see Meta's official consent screen
- Show that users can decline if they choose
- Show that connection happens securely via OAuth

---

### [1:30-2:00] View Connection Details & Enable Pages Access

**Narration:**
"After connecting, I can see my connection status. If pages access isn't enabled yet, I'll click 'Enable Pages Access' to grant permission to view and select my Facebook Pages."

**Actions:**
1. Show connection status: "Facebook Connected ✅"
2. If "Enable Pages Access" button is visible, click it
3. Complete second OAuth flow for pages access
4. Show updated status: "Pages access enabled"

**What to show:**
- Connection status showing "Connected"
- "Enable Pages Access" button (if applicable)
- Second OAuth flow (if needed)
- Updated status with pages access enabled

**Key Points:**
- Show staged permission approach
- Explain that pages access is needed to select which Page to post to

---

### [2:00-2:30] Send Test Post (if publishing enabled)

**Narration:**
"If publishing is enabled, I can send a test post to verify the connection works. Let me click 'Send Test Post'."

**Actions:**
1. Scroll to "Send Test Post" section
2. Click "Send Test Post" button
3. Wait for API call to complete
4. Show success message with post ID and permalink
5. Click permalink to verify post appears on Facebook

**What to show:**
- "Send Test Post" button
- Loading state during API call
- Success message with post details
- Permalink click showing actual post on Facebook

**Key Points:**
- Show that test posts actually publish to Facebook
- Show that we provide permalinks to published posts
- If `META_PUBLISHING_ENABLED=false`, show the banner explaining limited mode

---

### [2:30-2:45] View Activity Log

**Narration:**
"Let me check the Activity log to see the test post was recorded."

**Actions:**
1. Navigate to "Activity" tab
2. Show the activity log entry for the test post
3. Show post details: status, platform, post ID, permalink

**What to show:**
- Activity log page
- Entry showing test post
- Post status: "Posted ✅"
- Permalink to Facebook post

**Key Points:**
- Show that all publishing attempts are logged
- Show that users can see their post history
- Show that permalinks work correctly

---

### [2:45-3:00] Disconnect Account

**Narration:**
"Finally, let me show how users can disconnect their Facebook account at any time. This immediately revokes all permissions and deletes stored data."

**Actions:**
1. Navigate back to "Setup" tab
2. Scroll to Meta connection section
3. Click "Disconnect Facebook" button
4. Confirm disconnection (if confirmation dialog appears)
5. Show updated status: "Not Connected"
6. Show that "Connect Facebook" button is available again

**What to show:**
- "Disconnect Facebook" button clearly visible
- Disconnection process
- Status updated to "Not Connected"
- All connection data removed

**Key Points:**
- Emphasize that disconnection is immediate
- Show that users have full control
- Show that they can reconnect anytime

---

## Post-Recording Checklist

- [ ] Video is clear and readable (1080p+)
- [ ] All steps are visible and not cut off
- [ ] Facebook consent screen is clearly shown
- [ ] Test post actually appears on Facebook (if publishing enabled)
- [ ] Activity log shows the test post
- [ ] Disconnection works and status updates
- [ ] No sensitive data (tokens, secrets) is visible
- [ ] Video duration is 2-3 minutes
- [ ] Audio narration is clear (if included)

---

## Alternative Script (If Publishing Not Enabled)

If `META_PUBLISHING_ENABLED=false`:

1. **Skip test post step** (or show the banner explaining limited mode)
2. **Add explanation:**
   - "Publishing is currently in limited mode while we complete Meta App Review. Users can still compose posts, queue them, and use simulate mode to preview how posts will look."
3. **Show simulate mode:**
   - Navigate to "Composer" or "Queue"
   - Show that posts can be created and queued
   - Show simulate-run functionality
   - Explain that real publishing will be enabled after review approval

---

## Tips for Recording

1. **Use a clean browser:**
   - Clear cache and cookies before recording
   - Use incognito mode if possible
   - Disable browser extensions that might interfere

2. **Slow down:**
   - Pause briefly on important screens (OAuth consent, status updates)
   - Don't rush through clicks
   - Give viewers time to read text

3. **Highlight key features:**
   - Zoom in on permission explanations
   - Highlight "Disconnect" button
   - Show permalinks working

4. **Test first:**
   - Run through the entire flow once before recording
   - Fix any issues or errors
   - Ensure all features work as expected

5. **Edit if needed:**
   - Remove any errors or retries
   - Add text annotations if helpful
   - Add transitions between major steps

---

## What Meta Reviewers Will Look For

1. **Clear permission requests:** Do users understand what they're granting?
2. **User control:** Can users easily disconnect?
3. **Actual functionality:** Does the app do what it claims?
4. **Error handling:** What happens when something goes wrong?
5. **Data usage:** Is data used only for stated purposes?
6. **Compliance:** Are privacy policies and terms accessible?

Make sure your screencast addresses all of these points!

