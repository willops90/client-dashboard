-- Private bucket for "one thing for Will to review" uploads.
-- Objects live at <client_id>/<cycle_id>/week-<n>/<file>, so the first folder
-- decides who can see them. Files are served only through short-lived signed URLs.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'checkin-uploads', 'checkin-uploads', false, 20971520,
  array[
    'application/pdf',
    'image/png', 'image/jpeg', 'image/gif', 'image/webp', 'image/heic', 'image/heif',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy checkin_uploads_read on storage.objects for select to authenticated
  using (bucket_id = 'checkin-uploads'
    and public.can_access_client(public.try_uuid((storage.foldername(name))[1])));

create policy checkin_uploads_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'checkin-uploads'
    and public.can_access_client(public.try_uuid((storage.foldername(name))[1])));

create policy checkin_uploads_update on storage.objects for update to authenticated
  using (bucket_id = 'checkin-uploads'
    and public.can_access_client(public.try_uuid((storage.foldername(name))[1])));

create policy checkin_uploads_delete on storage.objects for delete to authenticated
  using (bucket_id = 'checkin-uploads' and public.is_advisor());
