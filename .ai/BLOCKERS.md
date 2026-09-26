# Blockers

- AllBee Supabase management CLI returns 403. Connected Supabase account lists only unrelated projects, so live migrations, RLS, grants and financial integrity cannot be certified.
- No authenticated role test sessions for employee/admin/accountant/client/APN screens; public sign-in viewport checks do not cover those screens.
- app.allbeesolutions.com and allbeeapp-six.vercel.app serve different bundles. The custom domain is not listed among allbeeapp project domains in the current Vercel team. Its deployment ownership is unresolved.
- HAO_POLICY.json has allow_auto_deploy=false. Production release requires an explicit release decision after the blockers above are resolved.
