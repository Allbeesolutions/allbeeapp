# ALLBEE Security/Runtime Migration Audit

Reviewed 2026-09-05 after the security/runtime hardening release.

## Rule

All migrations listed below are already applied to the linked production Supabase project. They are therefore immutable release history and must **not** be squashed, renamed, deleted, or edited in place. Corrective migrations remain as forward fixes.

## Applied 2026-09-05 chain

| Migration | Purpose | Classification |
|---|---|---|
| `20260905100000_fix_partner_signup_bootstrap_guard.sql` | Restores the transaction-local APN signup bootstrap guard after the State Head guard change. | Corrective, required |
| `20260905110000_proposal_public_security_hardening.sql` | Safe public proposal projection plus signer/state-machine enforcement and restricted public functions. | Security hardening |
| `20260905111000_audit_integrity.sql` | Makes audit append-only from clients and routes audit recording through a server-controlled RPC. | Security hardening |
| `20260905112000_notification_chat_rls_state.sql` | Separates per-user notification state from notification content and adds controlled notification/chat RPCs. | Security hardening |
| `20260905113000_security_runtime_hardening.sql` | Additional notification/chat runtime hardening and controlled chat operations. | Security/runtime hardening |
| `20260905114000_platform_v6_operations_schema_fix.sql` | Aligns the Platform V6 operations snapshot with canonical `enabled` and queue status vocabulary. | Corrective/runtime |
| `20260905115000_global_search_server_side.sql` | Moves Global Search filtering/search execution to the server under caller RLS. | Security/runtime hardening |
| `20260905116000_team_chat_notification_badges.sql` | Locks direct Team Chat updates and adds identity-checked seen/delete and unread-count RPCs. | Security hardening |
| `20260905117000_security_v5_assertion_fix.sql` | Corrects Security V5 assertions and RPC-only write boundaries. | Corrective/security |
| `20260905117100_notification_state_rpc_only.sql` | Removes direct client privileges on notification user-state storage. | Security hardening |
| `20260905118000_apn_server_age_validation.sql` | Enforces APN adult DOB validation server-side for registration/profile writes. | Security hardening |
| `20260905119000_sensitive_action_audit_coverage.sql` | Adds database triggers covering critical security/financial state changes. | Security hardening |
| `20260905120000_global_search_rpc_fix.sql` | Corrects the normalized result mapping of `global_search_v6`. | Corrective/runtime |
| `20260905121000_notification_unread_count_definer.sql` | Corrects unread-count RPC execution after direct notification-state privileges were revoked. | Corrective/security |

## Findings

- Local migration IDs and linked remote migration IDs match through `20260905121000`.
- No duplicate migration timestamp was found in the current 202609051 chain.
- The corrective migrations are not temporary patches; they are the final forward corrections and must remain in history.
- `20260905120000` and `20260905121000` specifically document fixes discovered during post-deployment verification.
- `deno.lock` is generated tooling state and is not required by the application release; it remains untracked rather than being added to the product commit.

## Verification

The linked database accepted the complete migration chain. The remote security regression script passed after the final unread-count fix, and the authenticated unread-count RPC returned successfully without direct notification-state table privileges.
