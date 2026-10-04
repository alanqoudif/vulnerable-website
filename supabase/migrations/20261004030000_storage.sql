-- Storage buckets and access policies (synthetic files only)
insert into storage.buckets (id, name, public, file_size_limit) values
  ('avatars','avatars',true,2097152),
  ('documents','documents',false,10485760),
  ('knowledge-files','knowledge-files',false,10485760),
  ('attachments','attachments',true,10485760)
on conflict (id) do update set public = excluded.public;

create or replace function public.storage_org(p text) returns uuid
language sql immutable as $$
  select case when split_part(p,'/',1) ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
              then split_part(p,'/',1)::uuid end
$$;

-- avatars: anyone may read; users manage their own folder
create policy avatars_read on storage.objects for select to anon, authenticated using (bucket_id = 'avatars');
create policy avatars_write on storage.objects for insert to authenticated
  with check (bucket_id = 'avatars' and split_part(name,'/',1) = auth.uid()::text);
create policy avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'avatars' and split_part(name,'/',1) = auth.uid()::text);

-- documents + knowledge files: org members only, path prefixed by org id
create policy docs_read on storage.objects for select to authenticated
  using (bucket_id in ('documents','knowledge-files') and public.is_org_member(public.storage_org(name)));
create policy docs_write on storage.objects for insert to authenticated
  with check (bucket_id in ('documents','knowledge-files') and public.is_org_member(public.storage_org(name)));

-- attachments: members upload under their org prefix
create policy attach_write on storage.objects for insert to authenticated
  with check (bucket_id = 'attachments' and public.is_org_member(public.storage_org(name)));
-- attachments: legacy broad read policy (listing allowed for any client)
create policy attach_read on storage.objects for select to anon, authenticated
  using (bucket_id = 'attachments');
