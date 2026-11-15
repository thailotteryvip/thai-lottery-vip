# Ariyan Chowdhury — Admin + Viewer mini website

This is a deployable starter project. It includes:
- Password-protected admin login using Supabase Auth
- Admin editing for headline, page name, profile photo, countdown date/time, papers, result, official link, IMO link and notice
- Publish-to-viewer workflow
- Viewer link (`?view=1`)
- Customer reviews with optional image upload
- Reviews are private/pending until the admin approves them
- Admin can approve, hide or delete reviews
- Supabase Realtime subscription for live updates

## Important limitations / safety
- This is an independent information page, not an official Thai Government Lottery Office website.
- Do not describe uploaded papers as guaranteed winning predictions or imply guaranteed returns.
- The starter uses public image URLs for uploaded paper/review images. Do not upload sensitive/private images.
- For production, tighten admin access with an explicit admin-role table and policies. The included starter policy treats authenticated accounts as admins, so do not create public sign-up.
- The official URL is editable; verify it yourself before publishing.

## 1. Create Supabase project
1. Create a free project at https://supabase.com.
2. Open SQL Editor.
3. Paste and run all of `supabase/schema.sql`.
4. In Authentication > Providers, keep Email enabled.
5. In Authentication > Users, create your admin user manually. Do not enable public sign-up.

## 2. Configure locally
1. Install Node.js LTS.
2. Copy `.env.example` to `.env`.
3. In Supabase Project Settings > API, copy Project URL and anon/public key into `.env`:
   - `VITE_SUPABASE_URL=...`
   - `VITE_SUPABASE_ANON_KEY=...`
4. Never use the `service_role` key in this frontend.
5. Run:
   ```bash
   npm install
   npm run dev
   ```
6. Open the local URL printed by Vite. Sign in with the admin user created in Supabase.

## 3. Deploy free on Vercel
1. Upload this project to a private GitHub repository.
2. Import the repository in https://vercel.com.
3. Add the two environment variables from `.env` in Vercel Project Settings > Environment Variables.
4. Deploy.
5. Admin login is available at the deployed root URL or `https://your-project.vercel.app/?admin=1`. The Viewer page includes an Admin Login link in its top bar.
6. After login, copy the Viewer Link shown in the dashboard. It will look like:
   `https://your-project.vercel.app/?view=1`

## 4. How publishing works
Edit fields, upload the publisher profile photo or papers, and set the draw date and time in the Admin Panel, then click **Publish Changes**. The countdown starts automatically against that saved date/time and updates every second. The viewer page reads the saved published data from Supabase. Realtime is enabled for refresh/live changes. The public viewer sees only approved reviews.

## 5. Review workflow
A client opens the Viewer Link, submits a review and optional image. It appears in the Admin Panel as Pending. Click the check icon to approve and publish it. Use the eye icon to hide it or the trash icon to permanently delete it.

## 6. Before public launch
- Replace the default IMO link with your own valid contact link.
- Verify the official lottery website URL and any result information.
- Set a strong unique admin password.
- Keep the Supabase project private; never share admin credentials.
- Review Supabase usage limits and storage policies on the free tier.
