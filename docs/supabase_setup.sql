-- 사유의 방 · LMS 1단계 — Supabase 테이블 셋업
-- Supabase 대시보드 → SQL Editor에서 그대로 실행.

create table if not exists events (
  id bigint generated always as identity primary key,
  code text not null,              -- 수강생 코드 (예: A반-07)
  event_type text not null,        -- session_start / lecture_complete / run_complete
                                    -- / diagnosis_result / checkup_result / proposal_created
  payload jsonb,                   -- 이벤트 상세 (강의 id, 진단 점수 JSON 등)
  course text not null default 'ax', -- LMS 과정 식별자(공용화 — 사이트 복제 시 SITE_CONFIG.course와 동일)
  created_at timestamptz default now()
);

-- 이미 만들어진 테이블에 course만 추가하는 경우(신규 사이트가 아니라 기존 events에 얹을 때):
--   alter table events add column course text not null default 'ax';

-- 조회 성능(2단계 대시보드 대비 — 코드별/시간순/과정별 조회에 쓰인다)
create index if not exists events_code_idx on events (code);
create index if not exists events_created_idx on events (created_at desc);
create index if not exists events_course_idx on events (course);

-- RLS 활성화 — 외부(anon key)의 직접 읽기/쓰기를 전부 차단.
-- 쓰기는 Netlify Function(track.js)이 service_role 키로만 수행(RLS를 우회하는 키이므로 정책 불필요).
alter table events enable row level security;
-- 정책을 추가하지 않은 상태 = anon/authenticated 키로는 select/insert 전부 거부(기본 deny).
