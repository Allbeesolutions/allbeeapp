# Blockers

- AllBee Supabase management CLI returns 403. Connected Supabase account lists only unrelated projects, so live migrations, RLS, grants and financial integrity cannot be certified.
- No authenticated role test sessions for employee/admin/accountant/client/APN screens; public sign-in viewport checks do not cover those screens.
- The custom domain now serves the exact local build after the GitHub push, but its Vercel project ownership is still unresolved in the accessible project listing. Do not remap it without identifying the owner.
- HAO_POLICY.json has allow_auto_deploy=false. This release was explicitly requested by the user; further automatic deployments remain disabled.
