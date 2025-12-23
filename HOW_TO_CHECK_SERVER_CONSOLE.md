# How to Check Server Console Output

## What is "Server Console Output"?

The **server console** is the terminal/command prompt window where you run `npm run dev`. This is where all server-side errors and logs appear.

## How to Find It

1. **Look for the terminal/command prompt window** where you started the dev server
2. It should show something like:
   ```
   ▲ Next.js 16.0.10
   - Local:        http://localhost:3000
   - Ready in 2.3s
   ```

## What to Look For

When you click "Send Login Link", you should see log messages like:

```
[NextAuth Route] signin/email request START
[NextAuth Email] sendVerificationRequest CALLED
[NextAuth Email] sendVerificationRequest start
```

**If there's an error, you'll see red error messages like:**
```
[NextAuth Route] CRITICAL ERROR: ...
[NextAuth Email] sendVerificationRequest error: ...
```

## What to Share

Please copy and paste:
1. **All log messages** that appear when you click "Send Login Link"
2. **Any red error messages** (especially ones starting with `[NextAuth]`)
3. **The full error text** (not just the first line)

This will help identify exactly what's failing!

