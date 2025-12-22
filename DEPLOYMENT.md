# Deployment Guide: Deploying to a Subdomain

This guide will help you deploy your OBD Premium Apps to a subdomain (e.g., `apps.ocalabusinessdirectory.com` or `premium.ocalabusinessdirectory.com`).

## Option 1: Deploy to Vercel (Recommended for Next.js)

Vercel is the easiest option for Next.js applications and provides excellent performance, automatic SSL, and easy subdomain configuration.

### Step 1: Install Vercel CLI (if not already installed)

```bash
npm i -g vercel
```

### Step 2: Login to Vercel

```bash
vercel login
```

### Step 3: Deploy Your Project

From your project root directory:

```bash
vercel
```

Follow the prompts:
- Set up and deploy? **Yes**
- Which scope? (Select your account)
- Link to existing project? **No** (for first deployment)
- What's your project's name? (e.g., `obd-premium-apps`)
- In which directory is your code located? **./** (current directory)

### Step 4: Configure Environment Variables

You'll need to set environment variables in Vercel. You can do this via:

**Option A: Vercel Dashboard**
1. Go to [vercel.com](https://vercel.com)
2. Select your project
3. Go to **Settings** → **Environment Variables**
4. Add the following variables:
   - `OPENAI_API_KEY` - Your OpenAI API key
   - `DATABASE_URL` - Your PostgreSQL connection string (if using Prisma)
   - Any other environment variables your app needs

**Option B: Vercel CLI**
```bash
vercel env add OPENAI_API_KEY
vercel env add DATABASE_URL
# Add other variables as needed
```

### Step 5: Add Custom Subdomain

1. Go to your Vercel project dashboard
2. Navigate to **Settings** → **Domains**
3. Click **Add Domain**
4. Enter your subdomain (e.g., `apps.ocalabusinessdirectory.com`)
5. Follow the DNS configuration instructions

### Step 6: Configure DNS Records

In your domain registrar (where `ocalabusinessdirectory.com` is hosted):

1. Add a **CNAME** record:
   - **Name/Subdomain**: `apps` (or your chosen subdomain)
   - **Value/Target**: `cname.vercel-dns.com` (or the specific CNAME provided by Vercel)
   - **TTL**: 3600 (or default)

**OR** if you prefer using an A record:
- Vercel will provide specific IP addresses to use

### Step 7: Production Deployment

Deploy to production:

```bash
vercel --prod
```

Or push to your connected Git repository (Vercel will auto-deploy on push).

---

## Option 2: Deploy to Netlify

### Step 1: Install Netlify CLI

```bash
npm i -g netlify-cli
```

### Step 2: Login and Deploy

```bash
netlify login
netlify init
netlify deploy --prod
```

### Step 3: Configure Subdomain

1. Go to Netlify dashboard
2. **Site settings** → **Domain management**
3. Add custom domain: `apps.ocalabusinessdirectory.com`
4. Configure DNS as instructed

---

## Option 3: Self-Hosted (VPS/Cloud Server)

If you want to host on your own server:

### Step 1: Build the Application

```bash
npm run build
```

### Step 2: Set Up Environment Variables

Create a `.env.production` file on your server with all required variables.

### Step 3: Run the Application

```bash
npm start
```

### Step 4: Configure Reverse Proxy (Nginx)

Example Nginx configuration for subdomain:

```nginx
server {
    listen 80;
    server_name apps.ocalabusinessdirectory.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### Step 5: Set Up SSL (Let's Encrypt)

```bash
sudo certbot --nginx -d apps.ocalabusinessdirectory.com
```

---

## Required Environment Variables

Make sure these are set in your production environment:

- `OPENAI_API_KEY` - Required for AI features
- `DATABASE_URL` - Required if using Prisma/PostgreSQL
- `NODE_ENV=production` - Usually set automatically

---

## Post-Deployment Checklist

- [ ] Verify all environment variables are set
- [ ] Test all API routes (`/api/*`)
- [ ] Verify database connections work
- [ ] Check that external links (like "Return to Directory") work correctly
- [ ] Test on mobile devices
- [ ] Set up monitoring/error tracking (optional but recommended)
- [ ] Configure backup strategy for database (if applicable)

---

## Troubleshooting

### Issue: Subdomain not resolving
- **Solution**: Wait for DNS propagation (can take up to 48 hours, usually much faster)
- Check DNS records are correct using `nslookup` or `dig`

### Issue: Environment variables not working
- **Solution**: Ensure variables are set for the correct environment (Production, Preview, Development)
- Redeploy after adding new environment variables

### Issue: Database connection errors
- **Solution**: Verify `DATABASE_URL` is correct and database allows connections from Vercel's IPs
- Check firewall/security group settings

### Issue: API routes returning errors
- **Solution**: Check server logs in Vercel dashboard
- Verify all required environment variables are set
- Check API rate limits

---

## Quick Deploy Commands Reference

```bash
# Vercel
vercel                    # Deploy to preview
vercel --prod            # Deploy to production
vercel env ls            # List environment variables
vercel logs              # View logs

# Netlify
netlify deploy           # Deploy to preview
netlify deploy --prod    # Deploy to production
netlify env:list         # List environment variables
```

---

## Next Steps After Deployment

1. **Set up monitoring**: Consider adding error tracking (Sentry, LogRocket, etc.)
2. **Configure analytics**: Add Google Analytics or similar
3. **Set up CI/CD**: Connect your Git repository for automatic deployments
4. **Performance optimization**: Monitor Core Web Vitals
5. **Backup strategy**: Ensure database backups are configured

---

## Need Help?

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js Deployment Guide](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel Support](https://vercel.com/support)

