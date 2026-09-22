-- Configure the founder emergency authorization code as a SHA-256 hash; never store the plaintext code.
update public.emergency_lockdown
set code_hash='09c69cec566c4e318f06a18b91711216493fb644df127b4be938ee85403844fc', locked=false, locked_at=null, locked_by='founder-recovery-configuration', updated_at=now()
where id='founder';
