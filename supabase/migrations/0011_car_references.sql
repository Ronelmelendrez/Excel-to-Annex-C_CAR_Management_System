-- 0011_car_references.sql
-- Sequential CAR references (CAR-YYYY-NNN) handed out by the cars edge
-- function. The counter is deliberately not readable through RLS: only the
-- service role used by edge functions may advance it, so two concurrent
-- creates can never receive the same reference.

create table if not exists public.car_reference_sequences (
  sequence_year integer primary key,
  last_value integer not null default 0
);

alter table public.car_reference_sequences enable row level security;

drop policy if exists car_reference_sequences_nobody on public.car_reference_sequences;
create policy car_reference_sequences_nobody on public.car_reference_sequences
  for all using (false) with check (false);

create or replace function public.next_car_reference()
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_year integer := extract(year from now())::integer;
  v_next integer;
begin
  insert into public.car_reference_sequences (sequence_year, last_value)
  values (v_year, 0)
  on conflict (sequence_year) do nothing;

  update public.car_reference_sequences
     set last_value = last_value + 1
   where sequence_year = v_year
  returning last_value into v_next;

  return 'CAR-' || v_year || '-' || lpad(v_next::text, 3, '0');
end;
$$;

revoke execute on function public.next_car_reference() from public, anon, authenticated;
grant execute on function public.next_car_reference() to service_role;
