import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

/** Cliente sem tipo fixo — as tabelas são passadas por nome. */
const db = supabase as unknown as SupabaseClient;

export type PaymentAccountRow = {
  id: string;
  name: string;
  provider: string;
  fee_percent: number;
  payout_days: number;
  color: string;
};

export type ConnectionRow = {
  id: string;
  provider: string;
  label: string;
  secret_ref: string | null;
  key_mask: string | null;
  status: "desconectado" | "conectado" | "erro";
  last_sync_at: string | null;
};

export type PaymentReceiptRow = {
  id: string;
  account_id: string | null;
  date: string;
  description: string;
  gross: number;
  fee_percent: number;
  paid_out: boolean;
  external_id: string | null;
  finance_entry_id: string | null;
};

/** Líquido = bruto menos a taxa (em %). */
export function netAmount(gross: number, feePercent: number) {
  return Math.round(gross * (1 - feePercent / 100) * 100) / 100;
}

/** Data prevista de repasse = data do recebimento + dias de repasse da conta. */
export function payoutDate(date: string, payoutDays: number) {
  const d = new Date(`${date}T00:00:00`);
  d.setDate(d.getDate() + (payoutDays || 0));
  return d.toISOString().slice(0, 10);
}

/** Últimos 4 caracteres, no formato de exibição. Nunca guarda a chave inteira. */
export function maskKey(value: string) {
  const tail = value.trim().slice(-4);
  return tail ? `•••• ${tail}` : "";
}

export type ReceiptInput = {
  account_id: string | null;
  date: string;
  description: string;
  gross: number;
  fee_percent: number;
  paid_out: boolean;
  external_id: string | null;
};

/**
 * Grava um recebimento e mantém o lançamento correspondente em finance_entries
 * (entrada, valor líquido, origin 'manual', received = paid_out). Quando o
 * external_id já existe para a mesma conta, atualiza em vez de duplicar.
 */
export async function saveReceipt({
  orgId,
  id,
  input,
  accountName,
}: {
  orgId: string;
  id?: string | undefined;
  input: ReceiptInput;
  accountName: string;
}) {
  let receiptId = id;

  if (!receiptId && input.external_id) {
    let q = db
      .from("payment_receipts")
      .select("id, finance_entry_id")
      .eq("org_id", orgId)
      .eq("external_id", input.external_id);
    q = input.account_id ? q.eq("account_id", input.account_id) : q.is("account_id", null);
    const { data, error } = await q.maybeSingle();
    if (error) throw error;
    if (data) receiptId = (data as { id: string }).id;
  }

  const net = netAmount(input.gross, input.fee_percent);
  const entryValues = {
    org_id: orgId,
    entry_date: input.date,
    description: input.description || "Recebimento",
    category: "Recebimento",
    account: accountName,
    kind: "entrada",
    amount: net,
    received: input.paid_out,
    origin: "manual",
  };

  if (receiptId) {
    const { data: current, error: readError } = await db
      .from("payment_receipts")
      .select("finance_entry_id")
      .eq("id", receiptId)
      .maybeSingle();
    if (readError) throw readError;

    const entryId = (current as { finance_entry_id: string | null } | null)?.finance_entry_id ?? null;
    let finalEntryId = entryId;

    if (entryId) {
      const { error } = await db.from("finance_entries").update(entryValues).eq("id", entryId);
      if (error) throw error;
    } else {
      finalEntryId = await insertEntry(entryValues);
    }

    const { error } = await db
      .from("payment_receipts")
      .update({ ...input, finance_entry_id: finalEntryId })
      .eq("id", receiptId);
    if (error) throw error;
    return { updated: true };
  }

  const entryId = await insertEntry(entryValues);
  const { error } = await db
    .from("payment_receipts")
    .insert({ ...input, org_id: orgId, finance_entry_id: entryId });
  if (error) throw error;
  return { updated: false };
}

async function insertEntry(values: Record<string, unknown>) {
  const { data, error } = await db.from("finance_entries").insert(values).select("id").single();
  if (error) throw error;
  return (data as { id: string }).id;
}

/** Exclui o recebimento (soft delete) e o lançamento ligado a ele. */
export async function deleteReceipt(receipt: PaymentReceiptRow) {
  const now = new Date().toISOString();
  if (receipt.finance_entry_id) {
    const { error } = await db
      .from("finance_entries")
      .update({ deleted_at: now })
      .eq("id", receipt.finance_entry_id);
    if (error) throw error;
  }
  const { error } = await db
    .from("payment_receipts")
    .update({ deleted_at: now })
    .eq("id", receipt.id);
  if (error) throw error;
}
