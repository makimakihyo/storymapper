-- =====================================================================
-- latest_visible_character_states を raw_memo 込みで再作成
-- =====================================================================
-- 起票日: 2026-07-10
-- 経緯:
--   初期 schema (20260428000000) のビューは SELECT DISTINCT ON (...) cs.*
--   で定義され、cs.* が「作成時点の列」で凍結される。
--   後追い migration (20260629001655) で character_states に追加した
--   raw_memo (ADR-0007 の canonical 自由文) がビューに載っておらず、
--   「主要キャラ帯 常時表示」(Week10 / recall) が帯に raw_memo を出せない。
--
-- 対応:
--   ビューを再作成し、cs.* を今の列構成で再展開して raw_memo を載せる。
--   raw_memo は基底テーブルの最終列なので、CREATE OR REPLACE VIEW の
--   「末尾に列を追加」制約に適合する（既存列の順序・型は不変）。
--   scene_id は元々 cs.* に含まれるため、帯の as-of 表示（由来シーンN）は
--   このビュー + scenes の order_key から導出できる（列追加は不要）。
--
-- 安全性:
--   security_invoker = true を明示（20260508024604 と同じRLS方針。
--   ADR-0003 defense in depth）。ネタバレフィルタ (scene order_key <=
--   current、finished は全件) は元の定義を踏襲する。
--   データ変更なし・ビュー定義のみの入れ替え。
-- =====================================================================

create or replace view latest_visible_character_states
  with (security_invoker = true) as
select distinct on (cs.character_id)
  cs.*
from character_states cs
join scenes s on s.id = cs.scene_id
join characters c on c.id = cs.character_id
join reading_progress rp on rp.book_id = c.book_id
left join scenes cur on cur.id = rp.current_scene_id
where
  rp.mode = 'finished'
  or cur.id is null
  or s.order_key <= cur.order_key
order by cs.character_id, s.order_key desc;
