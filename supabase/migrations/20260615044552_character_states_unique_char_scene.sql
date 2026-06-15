-- ADR-0006: character_states を同シーンUPSERTするための一意制約
ALTER TABLE character_states
  ADD CONSTRAINT uq_character_states_char_scene
  UNIQUE (character_id, scene_id);

-- 既存の非UNIQUEインデックスは UNIQUE制約のインデックスと重複するため削除
DROP INDEX IF EXISTS idx_character_states_char_scene;
