# ALLBEE Production Certification

Automated gate: `npm run certify` runs unit/regression tests, Edge Function auth-contract checks, production build, and bundle budgets.

Database release checks additionally cover RLS/grants, SECURITY DEFINER exposure/search paths, APN attachment scoping, internal helper privileges, finance integrity, and advisor review.

Manual/external checks that cannot be truthfully automated without credentials/infrastructure:
- signed-in role E2E for every production role;
- real Android/iOS device behavior;
- destructive restore drill on a non-production environment;
- Storage object backup/restore;
- AI Memory embeddings until the provider secret exists.
