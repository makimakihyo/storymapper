-- =====================================================================
-- StoryMapper Schema v1.1 (Supabase / PostgreSQL)
-- 起票日: 2026-04-27
-- 更新日: 2026-04-28 (memos に is_bookmark / bookmark_note 追加)
-- 設計合意事項:
--   1. シーン順序は fractional indexing (text型 order_key)
--   2. Label は type を持つ (chapter / viewpoint / location / time_axis / custom)
--   3. 物語内時系列は time_axis ラベルで吸収 (専用カラムなし)
--   4. シーン境界はユーザー明示アクション
--   5. CharacterState は最後に観測された state を現時点推定として扱う (observed_in_scene_id を保持)
--   6. AI統制原則は ADR-0001 として文書化済み
--   7. 読み飛ばしブックマークは memos テーブル拡張で実現 (ADR-0002 候補)
--
-- 設計原則:
--   - すべてのコンテンツに scene_id を紐付け、ネタバレ境界はアプリ層で
--     reading_progress.current_scene_id を基準にフィルタする
--   - RLS は user_id ベースで全テーブル保護
-- =====================================================================

-- ---------------------------------------------------------------------
-- 拡張機能
-- ---------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pgcrypto";  -- gen_random_uuid()

-- ---------------------------------------------------------------------
-- ENUM 定義
-- ---------------------------------------------------------------------
CREATE TYPE label_type AS ENUM (
  'chapter',     -- 章 (第3章、序章、エピローグ)
  'viewpoint',   -- 視点キャラ (主人公視点、敵視点)
  'location',    -- 場所 (王都、森)
  'time_axis',   -- 物語内時系列 (現在、回想、夢、予知)
  'custom'       -- ユーザー定義 (伏線、お気に入り、転機)
);

CREATE TYPE reading_mode AS ENUM (
  'reading',     -- 読書中: current_scene_id でネタバレフィルタON
  'finished',    -- 読了: フィルタOFF
  'rereading'    -- 再読: current_scene_id をリセットしてフィルタON
);

-- ---------------------------------------------------------------------
-- 共通: updated_at 自動更新トリガー
-- ---------------------------------------------------------------------
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ---------------------------------------------------------------------
-- books: 書籍 (ユーザーごとの読書記録単位)
-- ---------------------------------------------------------------------
-- 同じ書籍を複数ユーザーが扱う場合も、書籍レコードは各ユーザーで独立に持つ。
-- 将来「書誌情報の正規化」を行う場合は、book_master テーブルを別途切り出す方針。
CREATE TABLE books (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  author      TEXT,
  isbn        TEXT,
  cover_url   TEXT,
  notes       TEXT,                              -- 書籍全体への自由メモ
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_books_user_id ON books(user_id);

CREATE TRIGGER trg_books_updated
  BEFORE UPDATE ON books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- scenes: シーン (物語の最小単位)
-- ---------------------------------------------------------------------
-- order_key は fractional indexing。lexicographic ordering で並び替え可能な
-- 文字列を保持する (例: "a0", "a1", "a0V"...)。
-- ライブラリ例: fractional-indexing (npm), lexorank
CREATE TABLE scenes (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  order_key   TEXT NOT NULL,                     -- fractional indexing key
  summary     TEXT,                              -- ユーザーが書く 1-2 行のシーン要約
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, order_key)
);
CREATE INDEX idx_scenes_book_order ON scenes(book_id, order_key);

CREATE TRIGGER trg_scenes_updated
  BEFORE UPDATE ON scenes
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- reading_progress: 読書進行状況 (book に対して 1:1)
-- ---------------------------------------------------------------------
CREATE TABLE reading_progress (
  book_id           UUID PRIMARY KEY REFERENCES books(id) ON DELETE CASCADE,
  current_scene_id  UUID REFERENCES scenes(id) ON DELETE SET NULL,
  mode              reading_mode NOT NULL DEFAULT 'reading',
  started_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  finished_at       TIMESTAMPTZ,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TRIGGER trg_reading_progress_updated
  BEFORE UPDATE ON reading_progress
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- labels: ラベル (シーンに付与する分類タグ)
-- ---------------------------------------------------------------------
-- parent_id で階層を表現可能 (例: 「第3章」 > 「第3章-1」)。
-- 同一 book 内で name は一意 (重複ラベルを禁止)。
CREATE TABLE labels (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  type        label_type NOT NULL DEFAULT 'custom',
  parent_id   UUID REFERENCES labels(id) ON DELETE SET NULL,
  color       TEXT,                              -- UI 表示用 (任意)
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (book_id, name)
);
CREATE INDEX idx_labels_book_type ON labels(book_id, type);

-- ---------------------------------------------------------------------
-- scene_labels: シーン × ラベル (M:N)
-- ---------------------------------------------------------------------
CREATE TABLE scene_labels (
  scene_id    UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  label_id    UUID NOT NULL REFERENCES labels(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (scene_id, label_id)
);
CREATE INDEX idx_scene_labels_label ON scene_labels(label_id);

-- ---------------------------------------------------------------------
-- characters: キャラクター (静的属性)
-- ---------------------------------------------------------------------
-- 静的属性のみ (物語を通して変わらないもの)。
-- 時系列で変化する状態は character_states 側に持つ。
-- visual_description は将来の画像化機能のための仕込み。
CREATE TABLE characters (
  id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id                     UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  name                        TEXT NOT NULL,
  aliases                     TEXT[],
  first_appearance_scene_id   UUID REFERENCES scenes(id) ON DELETE SET NULL,
  static_attributes           JSONB,             -- 種族、性別、生まれなど物語通して不変の属性
  visual_description          TEXT,              -- 将来の画像化機能用 (見た目の言語化)
  notes                       TEXT,
  created_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at                  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_characters_book ON characters(book_id);
CREATE INDEX idx_characters_first_appearance ON characters(first_appearance_scene_id);

CREATE TRIGGER trg_characters_updated
  BEFORE UPDATE ON characters
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- character_states: キャラクター状態 (時系列スナップショット)
-- ---------------------------------------------------------------------
-- scene_id : この state が「物語上、いつの時点の状態か」 (=ネタバレフィルタの基準)
-- observed_in_scene_id : 「実際にユーザーがこの state を観測したシーン」
--   - 群像劇/視点切替で重要。例: A視点のシーン5で「Bは森にいる」と
--     観測した場合、scene_id = 5 (時点) / observed_in_scene_id = 5 (観測元)。
--   - その後B視点のシーン10で「Bは王都にいる」を観測すれば、scene_id=10。
--   - シーン6-9 にBの state はないが、シーン5 の state を「最後に観測された
--     state」として表示する設計 (アプリ層でクエリ)。
CREATE TABLE character_states (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  character_id           UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  scene_id               UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  observed_in_scene_id   UUID REFERENCES scenes(id) ON DELETE SET NULL,
  current_location       TEXT,                   -- 物理的な居場所
  goal                   TEXT,                   -- 目的・向かう先
  emotion                TEXT,                   -- 感情状態
  affiliation            TEXT,                   -- 所属 (敵/味方/中立など)
  visual_change          TEXT,                   -- 外見の変化 (傷、成長、変装など)
  notes                  TEXT,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_character_states_char_scene ON character_states(character_id, scene_id);
CREATE INDEX idx_character_states_observed ON character_states(observed_in_scene_id);

CREATE TRIGGER trg_character_states_updated
  BEFORE UPDATE ON character_states
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- relationships: キャラクター間の関係 (時系列対応)
-- ---------------------------------------------------------------------
-- 「実は親子だった」のような関係性の判明・変化も時系列で扱う。
-- observed_at_scene_id がネタバレフィルタの基準。
-- 関係の方向性 (from→to) は関係種別による (例: 「敵対」は対称、「親」は非対称)。
CREATE TABLE relationships (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id               UUID NOT NULL REFERENCES books(id) ON DELETE CASCADE,
  from_character_id     UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  to_character_id       UUID NOT NULL REFERENCES characters(id) ON DELETE CASCADE,
  relation_type         TEXT NOT NULL,           -- 友人/敵対/親子/信頼/恋愛/師弟 など
  is_symmetric          BOOLEAN NOT NULL DEFAULT FALSE,
  observed_at_scene_id  UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  notes                 TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CHECK (from_character_id <> to_character_id)
);
CREATE INDEX idx_relationships_book ON relationships(book_id);
CREATE INDEX idx_relationships_from ON relationships(from_character_id);
CREATE INDEX idx_relationships_to ON relationships(to_character_id);
CREATE INDEX idx_relationships_observed ON relationships(observed_at_scene_id);

CREATE TRIGGER trg_relationships_updated
  BEFORE UPDATE ON relationships
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ---------------------------------------------------------------------
-- memos: ユーザーメモ (シーンに紐付く)
-- ---------------------------------------------------------------------
-- is_flashback_ref / refers_to_scene_id : 回想シーンへの言及対応。
-- 例: シーン20で過去シーン3への言及メモを書いた場合、
--   scene_id = 20 (記述時点)
--   is_flashback_ref = true
--   refers_to_scene_id = 3 (言及先シーン)
--
-- is_bookmark / bookmark_note : 読み飛ばしブックマーク機能。
-- 「ここで止まりたくないが後で書く」を即時記録する用途。
-- ブックマーク時は body 空文字を許容、後で本文を書いて is_bookmark=false に
-- 「昇格」させる運用 (UPDATE 1発で完結)。
-- body の NOT NULL 制約は維持し、ブックマーク作成時は body='' を入れる。
CREATE TABLE memos (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scene_id             UUID NOT NULL REFERENCES scenes(id) ON DELETE CASCADE,
  body                 TEXT NOT NULL,
  is_flashback_ref     BOOLEAN NOT NULL DEFAULT FALSE,
  refers_to_scene_id   UUID REFERENCES scenes(id) ON DELETE SET NULL,
  is_bookmark          BOOLEAN NOT NULL DEFAULT FALSE,
  bookmark_note        TEXT,                    -- 「ここで○○について書く予定」等の簡易メモ
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_memos_scene ON memos(scene_id);
CREATE INDEX idx_memos_bookmark ON memos(scene_id) WHERE is_bookmark = TRUE;

CREATE TRIGGER trg_memos_updated
  BEFORE UPDATE ON memos
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- =====================================================================
-- Row Level Security (RLS)
-- =====================================================================
-- 原則: ユーザーは自分の book に紐づくデータのみアクセス可能。
-- books.user_id を起点に他テーブルへ伝播させる。

ALTER TABLE books              ENABLE ROW LEVEL SECURITY;
ALTER TABLE scenes             ENABLE ROW LEVEL SECURITY;
ALTER TABLE reading_progress   ENABLE ROW LEVEL SECURITY;
ALTER TABLE labels             ENABLE ROW LEVEL SECURITY;
ALTER TABLE scene_labels       ENABLE ROW LEVEL SECURITY;
ALTER TABLE characters         ENABLE ROW LEVEL SECURITY;
ALTER TABLE character_states   ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships      ENABLE ROW LEVEL SECURITY;
ALTER TABLE memos              ENABLE ROW LEVEL SECURITY;

-- books: 自分のレコードのみ
CREATE POLICY books_owner_all ON books
  FOR ALL USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- 子テーブル: 紐づく books.user_id が自分のものに限定
CREATE POLICY scenes_owner_all ON scenes
  FOR ALL USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()))
  WITH CHECK (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

CREATE POLICY reading_progress_owner_all ON reading_progress
  FOR ALL USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()))
  WITH CHECK (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

CREATE POLICY labels_owner_all ON labels
  FOR ALL USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()))
  WITH CHECK (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

CREATE POLICY scene_labels_owner_all ON scene_labels
  FOR ALL USING (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN books b ON s.book_id = b.id
    WHERE b.user_id = auth.uid()
  ))
  WITH CHECK (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN books b ON s.book_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY characters_owner_all ON characters
  FOR ALL USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()))
  WITH CHECK (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

CREATE POLICY character_states_owner_all ON character_states
  FOR ALL USING (character_id IN (
    SELECT c.id FROM characters c
    JOIN books b ON c.book_id = b.id
    WHERE b.user_id = auth.uid()
  ))
  WITH CHECK (character_id IN (
    SELECT c.id FROM characters c
    JOIN books b ON c.book_id = b.id
    WHERE b.user_id = auth.uid()
  ));

CREATE POLICY relationships_owner_all ON relationships
  FOR ALL USING (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()))
  WITH CHECK (book_id IN (SELECT id FROM books WHERE user_id = auth.uid()));

CREATE POLICY memos_owner_all ON memos
  FOR ALL USING (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN books b ON s.book_id = b.id
    WHERE b.user_id = auth.uid()
  ))
  WITH CHECK (scene_id IN (
    SELECT s.id FROM scenes s
    JOIN books b ON s.book_id = b.id
    WHERE b.user_id = auth.uid()
  ));

-- =====================================================================
-- 補助ビュー (読書中モードでのネタバレフィルタ済みデータ取得用)
-- =====================================================================
-- 注意: ネタバレフィルタは「scene の order_key が current_scene の order_key 以下」
-- で判定する。reading_mode が 'finished' なら全件返す。
-- アプリ層で実装してもよいが、頻出クエリなのでビュー化しておくと便利。

-- 現在位置までに表示可能なシーン
CREATE OR REPLACE VIEW visible_scenes AS
SELECT s.*
FROM scenes s
JOIN reading_progress rp ON rp.book_id = s.book_id
LEFT JOIN scenes cur ON cur.id = rp.current_scene_id
WHERE
  rp.mode = 'finished'
  OR cur.id IS NULL
  OR s.order_key <= cur.order_key;

-- 現在位置までに表示可能なメモ (ブックマーク含む全種類)
CREATE OR REPLACE VIEW visible_memos AS
SELECT m.*
FROM memos m
JOIN scenes s ON s.id = m.scene_id
JOIN reading_progress rp ON rp.book_id = s.book_id
LEFT JOIN scenes cur ON cur.id = rp.current_scene_id
WHERE
  rp.mode = 'finished'
  OR cur.id IS NULL
  OR s.order_key <= cur.order_key;

-- 「整理待ち」エントリ (ブックマーク + 未紐付けの可能性があるクイック入力)
-- 整理画面で使う。ブックマークと「本文があるが構造化されていないメモ」を抽出。
-- 注意: 構造化済みかどうかの判定は、関連 character_states や scene_labels の
-- 有無で見るのが筋だが、MVPでは is_bookmark=true の絞り込みのみで十分。
CREATE OR REPLACE VIEW pending_memos AS
SELECT m.*
FROM memos m
JOIN scenes s ON s.id = m.scene_id
WHERE m.is_bookmark = TRUE OR m.body = '';

-- 現在位置までに「最後に観測されたキャラ状態」(キャラごと最新1件)
CREATE OR REPLACE VIEW latest_visible_character_states AS
SELECT DISTINCT ON (cs.character_id)
  cs.*
FROM character_states cs
JOIN scenes s ON s.id = cs.scene_id
JOIN characters c ON c.id = cs.character_id
JOIN reading_progress rp ON rp.book_id = c.book_id
LEFT JOIN scenes cur ON cur.id = rp.current_scene_id
WHERE
  rp.mode = 'finished'
  OR cur.id IS NULL
  OR s.order_key <= cur.order_key
ORDER BY cs.character_id, s.order_key DESC;

-- 現在位置までに登場したキャラクター
CREATE OR REPLACE VIEW visible_characters AS
SELECT c.*
FROM characters c
JOIN reading_progress rp ON rp.book_id = c.book_id
LEFT JOIN scenes first_scene ON first_scene.id = c.first_appearance_scene_id
LEFT JOIN scenes cur ON cur.id = rp.current_scene_id
WHERE
  rp.mode = 'finished'
  OR c.first_appearance_scene_id IS NULL
  OR cur.id IS NULL
  OR first_scene.order_key <= cur.order_key;

-- =====================================================================
-- 設計上の補足メモ (将来の検討事項)
-- =====================================================================
-- [1] order_key の埋まり方
--     fractional indexing で文字列が長くなりすぎたら定期的に再採番する。
--     現実的には 1 冊あたりシーン数は数百が上限なので、運用上はほぼ問題ない。
--
-- [2] character_states の更新 vs 追加
--     基本は追加 (時系列スナップショットなので履歴を残す)。
--     入力ミスの修正は同一レコードを update する。
--
-- [3] 検索性能
--     書籍内のメモ全文検索は pg_trgm or tsvector を後で追加する想定。
--
-- [4] 共有機能 (将来)
--     読書クラブ等で book を複数ユーザーに共有する場合、
--     book_shares (book_id, shared_with_user_id, role) テーブルを追加し、
--     RLS ポリシーを修正する。
--
-- [5] 書誌マスタの正規化 (将来)
--     同じ書籍を複数ユーザーが扱う場合、book_master を切り出して
--     books.book_master_id 経由で参照する形にできる。
--     ただし MVP では正規化しない (検証フェーズではコード単純化を優先)。
