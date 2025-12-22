# Deployment Checklist

Use this checklist to ensure a smooth deployment to your subdomain.

## Pre-Deployment

- [ ] **Code is ready**
  - [ ] All features tested locally
  - [ ] No console errors or warnings
  - [ ] Build completes successfully (`npm run build`)

- [ ] **Environment variables prepared**
  - [ ] `OPENAI_API_KEY` - Have your OpenAI API key ready
  - [ ] `DATABASE_URL` - Have your production database connection string ready
  - [ ] Any other API keys or secrets needed

- [ ] **Database ready** (if applicable)
  - [ ] Production database created and accessible
  - [ ] Database migrations run (`npx prisma migrate deploy`)
  - [ ] Database connection tested

- [ ] **Domain/DNS access**
  - [ ] Access to domain registrar or DNS provider
  - [ ] Know which subdomain you want to use (e.g., `apps.ocalabusinessdirectory.com`)

## Deployment Steps

- [ ] **Choose hosting platform**
  - [ ] Vercel (recommended) - [See DEPLOYMENT.md](./DEPLOYMENT.md)
  - [ ] Netlify - [See DEPLOYMENT.md](./DEPLOYMENT.md)
  - [ ] Self-hosted - [See DEPLOYMENT.md](./DEPLOYMENT.md)

- [ ] **Deploy application**
  - [ ] Install hosting platform CLI (if using CLI)
  - [ ] Login to hosting platform
  - [ ] Deploy to preview/staging first
  - [ ] Test preview deployment

- [ ] **Configure environment variables**
  - [ ] Add all required environment variables in hosting dashboard
  - [ ] Verify variables are set for production environment
  - [ ] Redeploy after adding variables

- [ ] **Set up subdomain**
  - [ ] Add custom domain in hosting dashboard
  - [ ] Configure DNS records (CNAME or A record)
  - [ ] Wait for DNS propagation (can take up to 48 hours, usually much faster)

- [ ] **Deploy to production**
  - [ ] Run production deployment command
  - [ ] Verify deployment succeeded

## Post-Deployment Testing

- [ ] **Basic functionality**
  - [ ] Homepage loads correctly
  - [ ] All navigation links work
  - [ ] Apps are accessible and functional

- [ ] **API routes**
  - [ ] Test at least one API endpoint from each app
  - [ ] Verify AI features work (OpenAI API calls)
  - [ ] Check database operations (if applicable)

- [ ] **External links**
  - [ ] "Return to Directory" link works
  - [ ] Email links work (support@ocalabusinessdirectory.com)

- [ ] **Cross-browser testing**
  - [ ] Chrome/Edge
  - [ ] Firefox
  - [ ] Safari (if possible)

- [ ] **Mobile testing**
  - [ ] Test on mobile device or emulator
  - [ ] Verify responsive design works

- [ ] **Performance**
  - [ ] Page load times are acceptable
  - [ ] No major performance issues

## Post-Deployment Configuration

- [ ] **SSL Certificate**
  - [ ] SSL is automatically configured (Vercel/Netlify do this automatically)
  - [ ] HTTPS redirects work correctly

- [ ] **Monitoring** (Optional but recommended)
  - [ ] Set up error tracking (Sentry, LogRocket, etc.)
  - [ ] Set up analytics (Google Analytics, etc.)
  - [ ] Configure uptime monitoring

- [ ] **Backups** (if applicable)
  - [ ] Database backup strategy configured
  - [ ] Regular backup schedule set up

- [ ] **Documentation**
  - [ ] Update any internal documentation with new URL
  - [ ] Share subdomain URL with team/stakeholders

## Troubleshooting

If something doesn't work:

1. **Check hosting platform logs**
   - Vercel: Dashboard → Project → Deployments → View logs
   - Netlify: Dashboard → Site → Functions → View logs

2. **Verify environment variables**
   - Ensure all variables are set correctly
   - Check for typos in variable names
   - Verify values are correct

3. **Check DNS propagation**
   - Use `nslookup` or `dig` to verify DNS records
   - Wait for propagation if recently changed

4. **Test API endpoints directly**
   - Use Postman or curl to test API routes
   - Check for CORS issues
   - Verify API keys are valid

5. **Database connection issues**
   - Verify database is accessible from hosting platform
   - Check firewall/security group settings
   - Verify connection string is correct

## Quick Reference

### Vercel Commands
```bash
vercel login              # Login to Vercel
vercel                   # Deploy to preview
vercel --prod           # Deploy to production
vercel env ls           # List environment variables
vercel logs             # View deployment logs
```

### Netlify Commands
```bash
netlify login            # Login to Netlify
netlify deploy           # Deploy to preview
netlify deploy --prod    # Deploy to production
netlify env:list         # List environment variables
```

### Build & Test Locally
```bash
npm run build           # Build for production
npm start               # Test production build locally
npm run dev             # Development server
```

---

**Need help?** See [DEPLOYMENT.md](./DEPLOYMENT.md) for detailed instructions.

