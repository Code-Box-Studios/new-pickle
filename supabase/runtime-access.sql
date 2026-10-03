-- Runtime access for the trusted Next.js server. Never use this role in clients.
-- Keep database migration/ownership privileges on a separate administrator login.
create role pikol_server nologin nosuperuser nocreatedb nocreaterole noreplication nobypassrls;
grant usage on schema public, cms to pikol_server;
grant usage, select on all sequences in schema public, cms to pikol_server;
do $runtime_access$
declare
  target record;
begin
  for target in
    select n.nspname as schema_name, c.relname as table_name
    from pg_catalog.pg_class c
    join pg_catalog.pg_namespace n on n.oid = c.relnamespace
    where n.nspname in ('public', 'cms') and c.relkind = 'r'
      and c.relname not in ('_prisma_migrations', 'payload_migrations')
  loop
    execute format('grant select, insert, update, delete on table %I.%I to pikol_server', target.schema_name, target.table_name);
    execute format('alter table %I.%I enable row level security', target.schema_name, target.table_name);
    execute format('create policy pikol_server_access on %I.%I for all to pikol_server using (true) with check (true)', target.schema_name, target.table_name);
  end loop;
end
$runtime_access$;
grant select on public._prisma_migrations, cms.payload_migrations to pikol_server;
create policy pikol_server_migrations_read on public._prisma_migrations for select to pikol_server using (true);
alter table cms.payload_migrations enable row level security;
create policy pikol_server_migrations_read on cms.payload_migrations for select to pikol_server using (true);
