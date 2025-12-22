This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deployment

### Quick Deploy to Vercel (Recommended)

1. **Install Vercel CLI** (if not already installed):
   ```bash
   npm i -g vercel
   ```

2. **Login and deploy**:
   ```bash
   vercel login
   vercel
   ```

3. **Set environment variables** in Vercel dashboard:
   - `OPENAI_API_KEY` - Required for AI features
   - `DATABASE_URL` - Required for database connections

4. **Add custom subdomain**:
   - Go to Vercel project → Settings → Domains
   - Add your subdomain (e.g., `apps.ocalabusinessdirectory.com`)
   - Configure DNS records as instructed

5. **Deploy to production**:
   ```bash
   vercel --prod
   ```

### Detailed Deployment Guide

For complete deployment instructions including:
- Step-by-step Vercel setup
- Alternative hosting options (Netlify, self-hosted)
- DNS configuration
- Environment variable setup
- Troubleshooting

See **[DEPLOYMENT.md](./DEPLOYMENT.md)** for the full guide.

### Required Environment Variables

Before deploying, ensure you have these environment variables configured:

- `OPENAI_API_KEY` - Your OpenAI API key for AI-powered features
- `DATABASE_URL` - PostgreSQL connection string (if using database features)
- `NODE_ENV=production` - Set automatically in production

### Next.js Deployment Resources

- [Next.js Deployment Documentation](https://nextjs.org/docs/app/building-your-application/deploying)
- [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme)
