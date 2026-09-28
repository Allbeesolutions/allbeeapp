-- Correct the temporary recovery split and restore the surviving post-June APN finance pair.
-- Evidence: Accounts audit shows the 30/70 share transition; APN audit identifies transaction
-- msm44yyu-ss8cg (3000 received, 30/70) and its final combined commission expense (660).
update public.transactions
set data = data || jsonb_build_object('hajiPct',30,'alimPct',70), updated_at=clock_timestamp()
where id in ('recovery-historical-income-20260617','recovery-historical-expense-20260617');

insert into public.transactions(id,data,updated_at) values
('msm44yyu-ss8cg',jsonb_build_object('id','msm44yyu-ss8cg','kind','income','date','2026-08-31','amount',3000,'project','APN commission income','category','APN Commission','hajiPct',30,'alimPct',70,'incomeSource','apn','apnProjectId','mth216ap-1w1v7','apnPartnerId','c5305cf2-ed17-4b9b-97a9-d05cc9744fc7','createdAt',1788169637890::bigint,'notes','Recovered from authoritative APN finance audit.'),timestamptz '2026-08-31 09:47:17.890239+00'),
('apn-expense:msm44yyu-ss8cg',jsonb_build_object('id','apn-expense:msm44yyu-ss8cg','kind','expense','date','2026-09-05','amount',660,'project','APN commission expense','category','APN Commission','hajiPct',30,'alimPct',70,'scope','company','source','apn-commission','apnCommissionExpense',true,'apnProjectId','mth216ap-1w1v7','sourceIncomeId','msm44yyu-ss8cg','createdAt',1788635383747::bigint,'notes','Recovered from authoritative APN rule audit.'),timestamptz '2026-09-05 19:09:43.747156+00')
on conflict(id) do update set data=excluded.data,updated_at=excluded.updated_at;
