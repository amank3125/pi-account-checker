# Setting Up Supabase Authentication with Vercel

Follow these steps to ensure your Pi Account Checker application's authentication works correctly with Vercel deployment.

## 1. Update Environment Variables in Vercel

1. Go to your Vercel dashboard and select your project
2. Go to "Settings" → "Environment Variables"
3. Add these environment variables:
   - `NEXTAUTH_URL` = `https://pichecker.vercel.app` (replace with your actual Vercel URL)
   - `NEXT_PUBLIC_URL` = `https://pichecker.vercel.app` (replace with your actual Vercel URL)
4. Save your changes and redeploy the application

## 2. Configure Supabase Authentication Settings

1. Go to your Supabase dashboard: https://app.supabase.com/
2. Select your project
3. Go to "Authentication" → "URL Configuration"
4. Update the "Site URL" to your Vercel deployment URL (e.g., `https://pichecker.vercel.app`)
5. Add these URLs to the "Redirect URLs" section:
   - `https://pichecker.vercel.app/auth/callback`
   - `https://pichecker.vercel.app/api/auth/callback/google`
   - `https://pichecker.vercel.app`

## 3. Configure Google OAuth in Supabase

1. In your Supabase dashboard, go to "Authentication" → "Providers"
2. Find "Google" in the list and click to configure it
3. Make sure it's enabled (toggle switch is ON)
4. Visit the Google Cloud Console: https://console.cloud.google.com/
5. Select your project
6. Go to "APIs & Services" → "Credentials"
7. Edit your OAuth 2.0 Client ID
8. Add these authorized redirect URIs:
   - `https://pichecker.vercel.app/auth/callback`
   - `https://pichecker.vercel.app/api/auth/callback/google`
   - `https://bfiiluzlcrwvgmrmutha.supabase.co/auth/v1/callback` (replace with your Supabase project URL)

## 4. Testing the Authentication

1. Clear your browser cache or use an incognito window
2. Visit your Vercel deployed app: `https://pichecker.vercel.app`
3. Click on the database icon to authenticate with Google
4. You should now be properly redirected back to your Vercel app after authentication

## Troubleshooting

If you're still experiencing redirect issues:

1. Open the browser console (F12) and check for errors
2. Verify all URLs in your Supabase settings match your Vercel deployment exactly
3. Make sure your Google OAuth consent screen is properly configured
4. Check that your environment variables in Vercel exactly match what's expected

The most common issue is URI mismatch between what's registered in Google Cloud Console, Supabase, and what your application is using for redirects.
