create or replace function public.can_write(target_org uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.memberships m
    where m.org_id = target_org and m.user_id = auth.uid() and m.role in ('dono','admin','membro','parceiro')
  );
$$;

create or replace function public.can_delete(target_org uuid, row_creator uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select public.is_admin_or_owner(target_org) or row_creator = auth.uid();
$$;

create or replace function public.can_delete_card_item(target_card uuid, row_author uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.cards c
    where c.id = target_card and (public.is_admin_or_owner(c.org_id) or row_author = auth.uid())
  );
$$;

-- finance_entries
drop policy if exists "membros criam lancamentos" on public.finance_entries;
drop policy if exists "membros editam lancamentos" on public.finance_entries;
drop policy if exists "membros excluem lancamentos" on public.finance_entries;
drop policy if exists "finance_entries_insert_member" on public.finance_entries;
drop policy if exists "finance_entries_update_member" on public.finance_entries;
drop policy if exists "finance_entries_delete_member" on public.finance_entries;
create policy "escrita restrita lancamentos" on public.finance_entries for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita lancamentos" on public.finance_entries for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita lancamentos" on public.finance_entries for delete to authenticated using (public.can_delete(org_id, created_by));

-- fixed_costs
drop policy if exists "membros criam fixos" on public.fixed_costs;
drop policy if exists "membros editam fixos" on public.fixed_costs;
drop policy if exists "membros excluem fixos" on public.fixed_costs;
drop policy if exists "fixed_costs_insert_member" on public.fixed_costs;
drop policy if exists "fixed_costs_update_member" on public.fixed_costs;
drop policy if exists "fixed_costs_delete_member" on public.fixed_costs;
create policy "escrita restrita fixos" on public.fixed_costs for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita fixos" on public.fixed_costs for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita fixos" on public.fixed_costs for delete to authenticated using (public.can_delete(org_id, created_by));

-- cash_opening (saldo inicial: escrita restrita)
drop policy if exists "cash_opening_insert_member" on public.cash_opening;
drop policy if exists "cash_opening_update_member" on public.cash_opening;
create policy "escrita restrita saldo inicial" on public.cash_opening for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita saldo inicial" on public.cash_opening for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));

-- boards
drop policy if exists "membros criam quadros" on public.boards;
drop policy if exists "membros editam quadros" on public.boards;
drop policy if exists "membros excluem quadros" on public.boards;
drop policy if exists "boards_insert_member" on public.boards;
drop policy if exists "boards_update_member" on public.boards;
drop policy if exists "boards_delete_member" on public.boards;
create policy "escrita restrita quadros" on public.boards for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita quadros" on public.boards for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita quadros" on public.boards for delete to authenticated using (public.can_delete(org_id, created_by));

-- board_columns
drop policy if exists "board_columns_insert_member" on public.board_columns;
drop policy if exists "board_columns_update_member" on public.board_columns;
drop policy if exists "board_columns_delete_member" on public.board_columns;
create policy "escrita restrita colunas" on public.board_columns for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita colunas" on public.board_columns for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita colunas" on public.board_columns for delete to authenticated using (public.can_write(org_id));

-- cards
drop policy if exists "membros criam cartoes" on public.cards;
drop policy if exists "membros editam cartoes" on public.cards;
drop policy if exists "membros excluem cartoes" on public.cards;
drop policy if exists "cards_insert_member" on public.cards;
drop policy if exists "cards_update_member" on public.cards;
drop policy if exists "cards_delete_member" on public.cards;
create policy "escrita restrita cartoes" on public.cards for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita cartoes" on public.cards for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita cartoes" on public.cards for delete to authenticated using (public.can_delete(org_id, created_by));

-- card_items: qualquer papel cria/edita (comentario e checklist); exclusao restrita
drop policy if exists "membros excluem itens" on public.card_items;
drop policy if exists "card_items_delete_member" on public.card_items;
create policy "exclusao restrita itens" on public.card_items for delete to authenticated using (public.can_delete_card_item(card_id, created_by));

-- folders
drop policy if exists "membros criam pastas" on public.folders;
drop policy if exists "membros editam pastas" on public.folders;
drop policy if exists "membros excluem pastas" on public.folders;
drop policy if exists "folders_insert_member" on public.folders;
drop policy if exists "folders_update_member" on public.folders;
drop policy if exists "folders_delete_member" on public.folders;
create policy "escrita restrita pastas" on public.folders for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita pastas" on public.folders for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita pastas" on public.folders for delete to authenticated using (public.can_delete(org_id, created_by));

-- files
drop policy if exists "membros criam arquivos" on public.files;
drop policy if exists "membros editam arquivos" on public.files;
drop policy if exists "membros excluem arquivos" on public.files;
drop policy if exists "files_insert_member" on public.files;
drop policy if exists "files_update_member" on public.files;
drop policy if exists "files_delete_member" on public.files;
create policy "escrita restrita arquivos" on public.files for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita arquivos" on public.files for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita arquivos" on public.files for delete to authenticated using (public.can_delete(org_id, created_by));

-- payment_accounts
drop policy if exists "membros criam contas de recebimento" on public.payment_accounts;
drop policy if exists "membros editam contas de recebimento" on public.payment_accounts;
drop policy if exists "membros excluem contas de recebimento" on public.payment_accounts;
create policy "escrita restrita contas recebimento" on public.payment_accounts for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita contas recebimento" on public.payment_accounts for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita contas recebimento" on public.payment_accounts for delete to authenticated using (public.can_delete(org_id, created_by));

-- payment_receipts
drop policy if exists "membros criam recebimentos" on public.payment_receipts;
drop policy if exists "membros editam recebimentos" on public.payment_receipts;
drop policy if exists "membros excluem recebimentos" on public.payment_receipts;
create policy "escrita restrita recebimentos" on public.payment_receipts for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita recebimentos" on public.payment_receipts for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita recebimentos" on public.payment_receipts for delete to authenticated using (public.can_delete(org_id, created_by));

-- agenda_items
drop policy if exists "membros criam agenda" on public.agenda_items;
drop policy if exists "membros editam agenda" on public.agenda_items;
drop policy if exists "membros excluem agenda" on public.agenda_items;
create policy "escrita restrita agenda" on public.agenda_items for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita agenda" on public.agenda_items for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita agenda" on public.agenda_items for delete to authenticated using (public.can_delete(org_id, created_by));

-- goals
drop policy if exists "membros criam metas" on public.goals;
drop policy if exists "membros editam metas" on public.goals;
drop policy if exists "membros excluem metas" on public.goals;
create policy "escrita restrita metas" on public.goals for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita metas" on public.goals for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita metas" on public.goals for delete to authenticated using (public.can_delete(org_id, created_by));

-- contacts
drop policy if exists "membros criam contatos" on public.contacts;
drop policy if exists "membros editam contatos" on public.contacts;
drop policy if exists "membros excluem contatos" on public.contacts;
create policy "escrita restrita contatos" on public.contacts for insert to authenticated with check (public.can_write(org_id));
create policy "edicao restrita contatos" on public.contacts for update to authenticated using (public.can_write(org_id)) with check (public.can_write(org_id));
create policy "exclusao restrita contatos" on public.contacts for delete to authenticated using (public.can_delete(org_id, created_by));