CREATE TABLE public.finance_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  entry_date date NOT NULL DEFAULT current_date,
  description text NOT NULL,
  category text NOT NULL DEFAULT '',
  account text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT 'saida' CHECK (kind IN ('entrada','saida')),
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  received boolean NOT NULL DEFAULT true,
  origin text NOT NULL DEFAULT 'manual',
  deleted_at timestamptz,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX finance_entries_org_date_idx ON public.finance_entries (org_id, entry_date DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.finance_entries TO authenticated;
GRANT ALL ON public.finance_entries TO service_role;
ALTER TABLE public.finance_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY finance_entries_select_member ON public.finance_entries FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY finance_entries_insert_member ON public.finance_entries FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY finance_entries_update_member ON public.finance_entries FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY finance_entries_delete_member ON public.finance_entries FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_finance_entries_updated_at BEFORE UPDATE ON public.finance_entries FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.fixed_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  label text NOT NULL,
  category text NOT NULL DEFAULT '',
  amount numeric(14,2) NOT NULL CHECK (amount >= 0),
  day_of_month int NOT NULL DEFAULT 1 CHECK (day_of_month BETWEEN 1 AND 31),
  start_month date NOT NULL DEFAULT date_trunc('month', current_date)::date,
  end_month date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fixed_costs TO authenticated;
GRANT ALL ON public.fixed_costs TO service_role;
ALTER TABLE public.fixed_costs ENABLE ROW LEVEL SECURITY;
CREATE POLICY fixed_costs_select_member ON public.fixed_costs FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY fixed_costs_insert_member ON public.fixed_costs FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY fixed_costs_update_member ON public.fixed_costs FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY fixed_costs_delete_member ON public.fixed_costs FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_fixed_costs_updated_at BEFORE UPDATE ON public.fixed_costs FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cash_opening (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL UNIQUE REFERENCES public.organizations(id) ON DELETE CASCADE,
  amount numeric(14,2) NOT NULL DEFAULT 0,
  opening_date date NOT NULL DEFAULT current_date,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cash_opening TO authenticated;
GRANT ALL ON public.cash_opening TO service_role;
ALTER TABLE public.cash_opening ENABLE ROW LEVEL SECURITY;
CREATE POLICY cash_opening_select_member ON public.cash_opening FOR SELECT TO authenticated USING (public.is_member(org_id));
CREATE POLICY cash_opening_insert_member ON public.cash_opening FOR INSERT TO authenticated WITH CHECK (public.is_member(org_id));
CREATE POLICY cash_opening_update_member ON public.cash_opening FOR UPDATE TO authenticated USING (public.is_member(org_id)) WITH CHECK (public.is_member(org_id));
CREATE POLICY cash_opening_delete_member ON public.cash_opening FOR DELETE TO authenticated USING (public.is_member(org_id));
CREATE TRIGGER update_cash_opening_updated_at BEFORE UPDATE ON public.cash_opening FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();