# How to Deploy Your Local Changes to Vercel

**Important:** Changes you make locally (visible at `http://localhost:3000`) are NOT automatically synced to Vercel. You need to explicitly deploy them.

## Why Localhost and Vercel Show Different Things

- **`localhost:3000`** = Your local development environment (only on your computer)
- **Vercel** = Your production/staging environment (on the internet)

These are completely separate! Vercel doesn't know about your local changes until you deploy them.

---

## Quick Answer: Two Ways to Deploy

### Option 1: Manual Deployment (Easiest for Quick Updates)

Deploy directly from your local machine:

```bash
# Make sure you're in your project directory
cd "C:\Users\Scott\OneDrive - Nature Coast EMS\Documents\Ocala Business Directory\cursor-app-build"

# Deploy to Vercel
vercel --prod
```

This will:
1. Build your project
2. Upload it to Vercel
3. Deploy to production

**Note:** If this is your first time, you'll need to run `vercel login` first.

---

### Option 2: Git-Based Deployment (Recommended for Team Work)

This is better for version control and automatic deployments:

1. **Initialize Git** (if you haven't already):
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   ```

2. **Push to GitHub/GitLab**:
   ```bash
   # Create a repository on GitHub first, then:
   git remote add origin https://github.com/yourusername/your-repo.git
   git push -u origin main
   ```

3. **Connect Vercel to Git**:
   - Go to [vercel.com](https://vercel.com)
   - Import your Git repository
   - Vercel will automatically deploy every time you push to your main branch

4. **Deploy future changes**:
   ```bash
   git add .
   git commit -m "Description of your changes"
   git push
   # Vercel automatically deploys!
   ```

---

## Step-by-Step: First Time Setup

### Step 1: Install Vercel CLI (if not installed)

```bash
npm install -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

This will open your browser to authenticate.

### Step 3: Link to Existing Project OR Create New Project

**If you already have a Vercel project:**
```bash
vercel link
```
Follow the prompts to link to your existing project.

**If this is a new deployment:**
```bash
vercel
```
Follow the prompts to create a new project.

### Step 4: Set Environment Variables

Before deploying, make sure all environment variables are set in Vercel:

**Via Dashboard:**
1. Go to [vercel.com](https://vercel.com) → Your Project
2. Settings → Environment Variables
3. Add: `OPENAI_API_KEY`, `DATABASE_URL`, etc.

**Via CLI:**
```bash
vercel env add OPENAI_API_KEY
vercel env add DATABASE_URL
# Follow prompts to enter values
```

### Step 5: Deploy to Production

```bash
vercel --prod
```

---

## Workflow for Daily Development

Here's the recommended workflow:

1. **Make changes locally**
   ```bash
   npm run dev  # Test at localhost:3000
   ```

2. **Test everything works**
   - Verify all features work
   - Check for errors
   - Test on different browsers/devices

3. **Deploy to Vercel**
   ```bash
   vercel --prod
   ```

4. **Verify deployment**
   - Check your Vercel dashboard
   - Visit your live URL
   - Test the deployed version

---

## Common Issues & Solutions

### Issue: "Command 'vercel' not found"
**Solution:** Install Vercel CLI
```bash
npm install -g vercel
```

### Issue: "Authentication failed"
**Solution:** Login again
```bash
vercel login
```

### Issue: "Environment variable not found" error on Vercel
**Solution:** Add environment variables in Vercel dashboard or via CLI
```bash
vercel env add VARIABLE_NAME
```

### Issue: Build fails on Vercel but works locally
**Solutions:**
- Check that all dependencies are in `package.json` (not just `node_modules`)
- Verify environment variables are set
- Check Vercel build logs for specific errors
- Make sure you're not using Node.js features not available on Vercel

### Issue: Changes aren't showing after deployment
**Solutions:**
- Hard refresh your browser (Ctrl+Shift+R or Cmd+Shift+R)
- Check the deployment URL in Vercel dashboard (not cached URL)
- Wait a few minutes for CDN cache to clear
- Verify the deployment completed successfully

---

## Preview Deployments

Vercel also creates preview deployments for testing:

```bash
vercel  # (without --prod) creates a preview deployment
```

This gives you a unique URL to test changes before going to production.

---

## Checking Deployment Status

**Via CLI:**
```bash
vercel ls              # List all deployments
vercel logs            # View deployment logs
```

**Via Dashboard:**
- Go to [vercel.com](https://vercel.com)
- Select your project
- View "Deployments" tab

---

## Summary

**To see your local changes on Vercel:**

1. ✅ Make changes locally (test at `localhost:3000`)
2. ✅ Run `vercel --prod` to deploy
3. ✅ Changes appear on your Vercel URL

**Remember:** Local changes ≠ Vercel changes. Always deploy explicitly!

---

## Quick Reference Commands

```bash
# First time setup
vercel login           # Login to Vercel
vercel                 # Deploy preview (or setup project)

# Daily use
vercel --prod         # Deploy to production
vercel                # Deploy preview version

# Management
vercel ls             # List deployments
vercel logs           # View logs
vercel env ls         # List environment variables
vercel env add KEY    # Add environment variable
```

---

Need more help? See [DEPLOYMENT.md](./DEPLOYMENT.md) for complete deployment guide.

