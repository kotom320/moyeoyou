-- 약속 테이블
create table appointments (
  id uuid default gen_random_uuid() primary key,
  title text not null,
  confirmed_date date,
  confirmed_start_hour integer,
  confirmed_end_hour integer,
  created_at timestamptz default now()
);

-- 프로필 테이블
create table profiles (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references appointments(id) on delete cascade not null,
  name text not null,
  color text not null,
  created_at timestamptz default now()
);

-- 가능한 날짜/시간 테이블
create table availability (
  id uuid default gen_random_uuid() primary key,
  appointment_id uuid references appointments(id) on delete cascade not null,
  profile_id uuid references profiles(id) on delete cascade not null,
  date date not null,
  hour integer not null,
  created_at timestamptz default now(),
  unique(appointment_id, profile_id, date, hour)
);

-- RLS 활성화
alter table appointments enable row level security;
alter table profiles enable row level security;
alter table availability enable row level security;

-- 모두 읽기 가능
create policy "appointments_read" on appointments for select using (true);
create policy "profiles_read" on profiles for select using (true);
create policy "availability_read" on availability for select using (true);

-- 모두 쓰기 가능 (링크 공유 기반 앱이라 보안 없이 오픈)
create policy "appointments_insert" on appointments for insert with check (true);
create policy "profiles_insert" on profiles for insert with check (true);
create policy "availability_insert" on availability for insert with check (true);
create policy "availability_delete" on availability for delete using (true);
create policy "appointments_update" on appointments for update using (true);

-- Realtime 활성화
alter publication supabase_realtime add table availability;

-- =============================================
-- Migration: 시간 선택 기능 추가 (Supabase SQL editor에서 실행)
-- =============================================
-- 1. 기존 테스트 데이터 초기화
-- truncate table availability;

-- 2. availability에 hour 컬럼 추가
-- alter table availability add column hour integer not null default 0;
-- alter table availability alter column hour drop default;

-- 3. unique constraint 업데이트
-- alter table availability drop constraint if exists availability_profile_id_date_key;
-- alter table availability add constraint availability_profile_date_hour_key unique(appointment_id, profile_id, date, hour);

-- 4. appointments에 확정 시간 컬럼 추가
-- alter table appointments add column confirmed_start_hour integer;
-- alter table appointments add column confirmed_end_hour integer;
