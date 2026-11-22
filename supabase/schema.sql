create sequence if not exists public.arcquant_user_id_seq
  as bigint
  minvalue 1
  maxvalue 99999999
  start with 1
  no cycle;

create table if not exists public.users (
  id text primary key check (id ~ '^[0-9]{8}$'),
  auth_user_id uuid not null unique references auth.users (id) on delete cascade,
  email text not null unique,
  wallet_address text unique,
  created_at timestamptz not null default now(),
  constraint users_wallet_address_format
    check (wallet_address is null or wallet_address ~ '^0x[a-fA-F0-9]{40}$')
);

create table if not exists public.boxes (
  id bigint primary key,
  status text not null default 'filling'
    check (status in ('filling', 'active', 'completed')),
  members_count integer not null default 0
    check (members_count between 0 and 100),
  updated_at timestamptz not null default now()
);

create table if not exists public.box_members (
  box_id bigint not null references public.boxes (id) on delete cascade,
  user_id text not null references public.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (box_id, user_id)
);

create table if not exists public.wallet_nonces (
  nonce text primary key,
  wallet_address text not null check (wallet_address ~ '^0x[a-fA-F0-9]{40}$'),
  message text not null,
  expires_at timestamptz not null
);

create index if not exists wallet_nonces_expires_at_idx
  on public.wallet_nonces (expires_at);

create or replace function public.create_arcquant_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is null then
    raise exception 'An email address is required to create an ArcQuant profile';
  end if;

  insert into public.users (id, auth_user_id, email)
  values (
    to_char(nextval('public.arcquant_user_id_seq'), 'FM00000000'),
    new.id,
    lower(new.email)
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created_arcquant on auth.users;
create trigger on_auth_user_created_arcquant
  after insert on auth.users
  for each row execute function public.create_arcquant_user();

create or replace function public.sync_arcquant_user_email()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.email is distinct from old.email then
    update public.users
    set email = lower(new.email)
    where auth_user_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists on_auth_user_email_updated_arcquant on auth.users;
create trigger on_auth_user_email_updated_arcquant
  after update of email on auth.users
  for each row execute function public.sync_arcquant_user_email();

create or replace function public.consume_wallet_nonce(
  p_nonce text,
  p_wallet_address text,
  p_message text
)
returns boolean
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  consumed boolean;
begin
  delete from public.wallet_nonces
  where nonce = p_nonce
    and lower(wallet_address) = lower(p_wallet_address)
    and message = p_message
    and expires_at > now()
  returning true into consumed;

  return coalesce(consumed, false);
end;
$$;

revoke all on function public.consume_wallet_nonce(text, text, text) from public, anon, authenticated;
grant execute on function public.consume_wallet_nonce(text, text, text) to service_role;

alter table public.users enable row level security;
alter table public.boxes enable row level security;
alter table public.box_members enable row level security;
alter table public.wallet_nonces enable row level security;

drop policy if exists "users can read their own profile" on public.users;
create policy "users can read their own profile"
  on public.users for select to authenticated
  using (auth_user_id = (select auth.uid()));

drop policy if exists "authenticated users can read boxes" on public.boxes;
create policy "authenticated users can read boxes"
  on public.boxes for select to authenticated
  using (true);

drop policy if exists "authenticated users can read box members" on public.box_members;
create policy "authenticated users can read box members"
  on public.box_members for select to authenticated
  using (true);

revoke all on public.wallet_nonces from anon, authenticated;
grant select on public.users, public.boxes, public.box_members to authenticated;

comment on table public.boxes is
  'Off-chain index of on-chain boxes; synchronize from verified Fund contract events.';
comment on table public.box_members is
  'Off-chain index of on-chain membership; do not accept direct browser writes.';
comment on column public.users.id is
  'Sequential eight-digit ArcQuant profile ID, assigned by the auth.users insert trigger.';
