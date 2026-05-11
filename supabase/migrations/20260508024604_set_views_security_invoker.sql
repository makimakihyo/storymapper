-- =====================================================================
-- Views: security_invoker = true を有効化 (RLS バイパス防止)
-- =====================================================================
-- 起票日: 2026-05-08
-- 経緯:
--   初期 schema (20260428000000_initial_schema.sql) の CREATE VIEW で
--   security_invoker が未指定だったため、ビュー所有者(postgres,
--   BYPASSRLS 属性持ち)の権限で評価され RLS がバイパスされていた。
--   本 migration で全ビューに security_invoker = true を適用する。
--
-- 影響範囲:
--   ネタバレフィルタの土台となる5ビューが、実行ユーザーの権限で評価
--   されるようになり、各ユーザーは自分の book に紐づくデータのみ
--   ビュー越しに参照可能となる。
-- =====================================================================

ALTER VIEW visible_scenes                  SET (security_invoker = true);
ALTER VIEW visible_memos                   SET (security_invoker = true);
ALTER VIEW pending_memos                   SET (security_invoker = true);
ALTER VIEW latest_visible_character_states SET (security_invoker = true);
ALTER VIEW visible_characters              SET (security_invoker = true);