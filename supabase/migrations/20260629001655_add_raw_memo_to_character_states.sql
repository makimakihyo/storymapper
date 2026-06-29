-- ADR-0007: memos-first。入力された状態メモの自由文そのものを canonical として保持する。
-- 抽出3欄(current_location/goal/affiliation)はここからのAI抽出＝派生。
-- 既存行は raw_memo 無し（過去の手構造化入力）のため NULL 許容で移行する。
alter table public.character_states
  add column if not exists raw_memo text;

comment on column public.character_states.raw_memo is
  'ユーザー入力の状態メモ自由文（canonical, ADR-0007）。current_location/goal/affiliation はAI抽出の派生。';
  