# ALLBEE Environments

Current: production Supabase is active; no staging branch/project is presently provisioned.

Target flow: local -> staging -> production. All schema changes are represented in `supabase/migrations`. A staging project/branch must not be created automatically when it has a recurring cost; provision it only after owner cost confirmation. Once available, CI should apply migrations and certification to staging before production.
