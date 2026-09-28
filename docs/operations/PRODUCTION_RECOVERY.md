# ALLBEE Production Recovery

## Recovery objectives
- Target RPO: 24 hours while relying on daily database backups; reduce this when PITR is enabled.
- Target RTO: 4 hours for a database incident once an authorized owner initiates restore.
- Never test destructive restore against production.

## Database
1. Confirm incident scope and freeze application writes if integrity is uncertain.
2. Record the production migration version and current deployment.
3. Use Supabase Database Backups/PITR to restore only after owner authorization.
4. Re-run `npm run certify`, database security contract, finance reconciliation, and role smoke tests.
5. Re-enable writes only after reconciliation is balanced.

## Storage
Supabase database backups contain Storage metadata, not the stored object bytes. Storage therefore requires a separate object-copy/export process. Until that external copy is configured, deleted Storage objects are outside the database restore guarantee.

## Restore drill
Use a disposable/staging project only. Rebuild schema from version-controlled migrations, load a sanitized backup, run certification, verify finance/APN counts, verify Storage references, then destroy the drill environment.
