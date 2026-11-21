alter table farmers
  add column if not exists farm_plan jsonb not null default '{}'::jsonb;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'farmers_farm_plan_check'
      and conrelid = 'farmers'::regclass
  ) then
    alter table farmers
      add constraint farmers_farm_plan_check
      check (jsonb_typeof(farm_plan) = 'object');
  end if;
end
$$;

alter table farming_history
  add column if not exists event_type text not null default 'observation',
  add column if not exists event_date date,
  add column if not exists amount numeric(12, 3),
  add column if not exists unit text not null default '';

update farming_history
set event_type = case
      when harvest_date is not null then 'harvest'
      when planting_date is not null then 'sowing'
      else 'observation'
    end,
    event_date = coalesce(event_date, harvest_date, planting_date, created_at::date)
where event_date is null;

alter table farming_history
  alter column event_date set not null,
  alter column event_date set default current_date;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'farming_history_event_type_check'
      and conrelid = 'farming_history'::regclass
  ) then
    alter table farming_history
      add constraint farming_history_event_type_check
      check (event_type in ('sowing', 'irrigation', 'fertilizer', 'observation', 'disease', 'harvest'));
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'farming_history_amount_check'
      and conrelid = 'farming_history'::regclass
  ) then
    alter table farming_history
      add constraint farming_history_amount_check
      check (amount is null or amount >= 0);
  end if;
end
$$;

create index if not exists farming_history_farmer_event_date_idx
  on farming_history (farmer_id, event_date desc, created_at desc);
