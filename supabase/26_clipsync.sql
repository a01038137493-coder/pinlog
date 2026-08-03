-- 26. 클립보드 동기화 (맥·윈도우 에이전트)
-- clips: 클립 히스토리 (텍스트/이미지), connect_keys: 계정 고유 연결 암호

-- clips 확장: 이미지 클립 지원
alter table public.clips add column if not exists kind text not null default 'text';
alter table public.clips add column if not exists file_path text;

-- Storage 버킷 (비공개, 본인 폴더만 접근)
insert into storage.buckets (id, name, public) values ('clips', 'clips', false)
  on conflict (id) do nothing;
create policy "clips upload own" on storage.objects for insert
  with check (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "clips read own" on storage.objects for select
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);
create policy "clips delete own" on storage.objects for delete
  using (bucket_id = 'clips' and (storage.foldername(name))[1] = auth.uid()::text);

-- 연결 암호: 계정당 1개, 가입 시점부터 고정 (절대 안 바뀜)
create table if not exists public.connect_keys (
  user_id uuid primary key references auth.users(id) on delete cascade,
  password text not null,
  created_at timestamptz not null default now()
);
alter table public.connect_keys enable row level security;
create policy "own connect key" on public.connect_keys for select
  using (auth.uid() = user_id);
create policy "own connect key insert" on public.connect_keys for insert
  with check (auth.uid() = user_id);

-- 가입 트리거: 실사용자(OTP/OAuth — GoTrue가 랜덤 bcrypt 해시를 넣으므로
-- encrypted_password 유무로는 구분 불가) 전원에게 고유 키 생성 + 계정 비밀번호로 설정.
-- @pinlog.app 은 내부 테스트·심사 계정(demo/tablet/qa, pinlog1234 유지)이라 제외.
create or replace function public.handle_new_user_connect_key()
returns trigger
security definer
set search_path = public, extensions
language plpgsql as $$
declare
  chars text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  key text := '';
  i int;
begin
  if new.email is null or new.email like '%@pinlog.app' then
    return new;
  end if;
  for i in 1..10 loop
    key := key || substr(chars, floor(random() * length(chars))::int + 1, 1);
  end loop;
  insert into public.connect_keys (user_id, password) values (new.id, key)
    on conflict (user_id) do nothing;
  update auth.users
     set encrypted_password = extensions.crypt(key, extensions.gen_salt('bf'))
   where id = new.id;
  return new;
end $$;

drop trigger if exists on_auth_user_created_connect_key on auth.users;
create trigger on_auth_user_created_connect_key
  after insert on auth.users
  for each row execute function public.handle_new_user_connect_key();

-- 백필: 키 없는 기존 외부 계정 전원 (2026-08-04 실행 완료)
do $$
declare
  u record;
  chars text := 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  key text;
  i int;
begin
  for u in
    select au.id from auth.users au
    where au.email not like '%@pinlog.app'
      and not exists (select 1 from public.connect_keys ck where ck.user_id = au.id)
  loop
    key := '';
    for i in 1..10 loop
      key := key || substr(chars, floor(random() * length(chars))::int + 1, 1);
    end loop;
    insert into public.connect_keys (user_id, password) values (u.id, key);
    update auth.users set encrypted_password = extensions.crypt(key, extensions.gen_salt('bf')) where id = u.id;
  end loop;
end $$;
