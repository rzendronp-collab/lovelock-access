-- BOARDS
CREATE TABLE public.boards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  name text NOT NULL,
  folder text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.boards TO authenticated;
GRANT ALL ON public.boards TO service_role;
ALTER TABLE public.boards ENABLE ROW LEVEL SECURITY;
CREATE POLICY boards_select_member ON public.boards FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY boards_insert_member ON public.boards FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY boards_update_member ON public.boards FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY boards_delete_member ON public.boards FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_boards_updated_at BEFORE UPDATE ON public.boards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX boards_org_idx ON public.boards(org_id);

-- BOARD COLUMNS
CREATE TABLE public.board_columns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  name text NOT NULL,
  position integer NOT NULL DEFAULT 0,
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.board_columns TO authenticated;
GRANT ALL ON public.board_columns TO service_role;
ALTER TABLE public.board_columns ENABLE ROW LEVEL SECURITY;
CREATE POLICY board_columns_select_member ON public.board_columns FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY board_columns_insert_member ON public.board_columns FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY board_columns_update_member ON public.board_columns FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY board_columns_delete_member ON public.board_columns FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_board_columns_updated_at BEFORE UPDATE ON public.board_columns FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX board_columns_board_idx ON public.board_columns(board_id);

-- CARDS
CREATE TABLE public.cards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  board_id uuid NOT NULL REFERENCES public.boards(id) ON DELETE CASCADE,
  column_id uuid REFERENCES public.board_columns(id) ON DELETE SET NULL,
  title text NOT NULL,
  description text NOT NULL DEFAULT '',
  assignee_id uuid REFERENCES auth.users(id),
  due_date date,
  label text NOT NULL DEFAULT '',
  color text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  done boolean NOT NULL DEFAULT false,
  archived boolean NOT NULL DEFAULT false,
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cards TO authenticated;
GRANT ALL ON public.cards TO service_role;
ALTER TABLE public.cards ENABLE ROW LEVEL SECURITY;
CREATE POLICY cards_select_member ON public.cards FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY cards_insert_member ON public.cards FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY cards_update_member ON public.cards FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY cards_delete_member ON public.cards FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_cards_updated_at BEFORE UPDATE ON public.cards FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX cards_board_idx ON public.cards(board_id);
CREATE INDEX cards_column_idx ON public.cards(column_id);

-- CARD ITEMS (checklist | comment | attachment)
CREATE TABLE public.card_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  card_id uuid NOT NULL REFERENCES public.cards(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'checklist',
  content text NOT NULL DEFAULT '',
  done boolean NOT NULL DEFAULT false,
  path text NOT NULL DEFAULT '',
  position integer NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.card_items TO authenticated;
GRANT ALL ON public.card_items TO service_role;
ALTER TABLE public.card_items ENABLE ROW LEVEL SECURITY;
CREATE POLICY card_items_select_member ON public.card_items FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY card_items_insert_member ON public.card_items FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY card_items_update_member ON public.card_items FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY card_items_delete_member ON public.card_items FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_card_items_updated_at BEFORE UPDATE ON public.card_items FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX card_items_card_idx ON public.card_items(card_id);

-- FOLDERS
CREATE TABLE public.folders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  parent_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  name text NOT NULL,
  color text NOT NULL DEFAULT '',
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;
ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY folders_select_member ON public.folders FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY folders_insert_member ON public.folders FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY folders_update_member ON public.folders FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY folders_delete_member ON public.folders FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_folders_updated_at BEFORE UPDATE ON public.folders FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX folders_org_idx ON public.folders(org_id);

-- FILES (arquivo | link | texto | imagem)
CREATE TABLE public.files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  folder_id uuid REFERENCES public.folders(id) ON DELETE CASCADE,
  kind text NOT NULL DEFAULT 'arquivo',
  name text NOT NULL,
  path text NOT NULL DEFAULT '',
  url text NOT NULL DEFAULT '',
  content text NOT NULL DEFAULT '',
  mime_type text NOT NULL DEFAULT '',
  size_bytes bigint NOT NULL DEFAULT 0,
  created_by uuid REFERENCES auth.users(id),
  deleted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.files TO authenticated;
GRANT ALL ON public.files TO service_role;
ALTER TABLE public.files ENABLE ROW LEVEL SECURITY;
CREATE POLICY files_select_member ON public.files FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY files_insert_member ON public.files FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY files_update_member ON public.files FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY files_delete_member ON public.files FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_files_updated_at BEFORE UPDATE ON public.files FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE INDEX files_folder_idx ON public.files(folder_id);