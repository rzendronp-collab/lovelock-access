import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Camada de servidor da Stripe. A chave secreta (sk) só existe aqui, na memória
 * do servidor: entra pelo corpo da requisição, vai para o cofre criptografado do
 * banco (vault) e nunca volta em nenhuma resposta, coluna comum ou log.
 */

export type StripeNumbers = {
  balance_available: number;
  balance_pending: number;
  balance_reserved: number;
  gross_volume: number;
  fees_total: number;
  refunds_total: number;
  payouts_total: number;
  last_synced_at: string;
};

const STRIPE = "https://api.stripe.com/v1";

async function stripeGet(secret: string, path: string) {
  const res = await fetch(`${STRIPE}${path}`, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const json = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    const err = json['error'] as { message?: string } | undefined;
    throw new Error(err?.message ?? `Stripe respondeu ${res.status}`);
  }
  return json;
}

function sumAmounts(list: { amount?: number }[]) {
  return list.reduce((total, item) => total + Math.abs(Number(item.amount ?? 0)), 0) / 100;
}

/** Conecta (ou reconecta) uma conta Stripe: valida a chave e guarda no cofre. */
export const stripeConnect = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: {
    connection_id?: string | null;
    project_id: string;
    label: string;
    secret_key: string;
  }) => {
    if (!input.project_id) throw new Error("Projeto obrigatório");
    if (!input.label.trim()) throw new Error("Nome da conta obrigatório");
    if (!input.secret_key.trim()) throw new Error("Chave obrigatória");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: project, error: projectError } = await supabase
      .from("projects")
      .select("id, org_id")
      .eq("id", data.project_id)
      .maybeSingle();
    if (projectError || !project) throw new Error("Projeto não encontrado");

    const { data: isAdmin } = await supabase.rpc("is_admin_or_owner", {
      target_org: project.org_id,
    });
    if (!isAdmin) throw new Error("Só o dono ou administradores podem conectar contas.");

    const secret = data.secret_key.trim();

    // Teste da chave antes de guardar qualquer coisa.
    try {
      await stripeGet(secret, "/balance");
    } catch (error) {
      return { ok: false as const, error: (error as Error).message };
    }

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const mask = `•••• ${secret.slice(-4)}`;

    let connectionId = data.connection_id ?? null;
    if (connectionId) {
      const { error } = await supabaseAdmin
        .from("connections")
        .update({
          label: data.label.trim(),
          key_mask: mask,
          status: "conectado",
          project_id: data.project_id,
        })
        .eq("id", connectionId)
        .eq("org_id", project.org_id);
      if (error) throw new Error("Não foi possível salvar a conexão.");
    } else {
      const { data: inserted, error } = await supabaseAdmin
        .from("connections")
        .insert({
          org_id: project.org_id,
          project_id: data.project_id,
          provider: "stripe",
          label: data.label.trim(),
          key_mask: mask,
          status: "conectado",
          created_by: userId,
        })
        .select("id")
        .single();
      if (error || !inserted) throw new Error("Não foi possível criar a conexão.");
      connectionId = inserted.id;
    }

    const secretRef = `stripe_sk_${connectionId}`;
    const { error: vaultError } = await supabaseAdmin.rpc("vault_store_secret", {
      p_name: secretRef,
      p_secret: secret,
    });
    if (vaultError) throw new Error("Não foi possível guardar a chave no cofre.");

    await supabaseAdmin
      .from("connections")
      .update({ secret_ref: secretRef })
      .eq("id", connectionId);

    // Garante a conta de recebimento espelhando a conexão.
    const { data: account } = await supabaseAdmin
      .from("payment_accounts")
      .select("id")
      .eq("stripe_connection_id", connectionId)
      .maybeSingle();

    if (!account) {
      await supabaseAdmin.from("payment_accounts").insert({
        org_id: project.org_id,
        project_id: data.project_id,
        name: data.label.trim(),
        provider: "stripe",
        stripe_connection_id: connectionId,
        created_by: userId,
      });
    } else {
      await supabaseAdmin
        .from("payment_accounts")
        .update({ name: data.label.trim(), sync_error: null })
        .eq("id", account.id);
    }

    return { ok: true as const, connection_id: connectionId, key_mask: mask };
  });

/** Sincroniza os números da conta Stripe. Nunca devolve a chave. */
export const stripeSync = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: { connection_id: string; from?: string; to?: string }) => {
    if (!input.connection_id) throw new Error("Conexão obrigatória");
    return input;
  })
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    const { data: connection, error } = await supabase
      .from("connections")
      .select("id, org_id, secret_ref, status")
      .eq("id", data.connection_id)
      .maybeSingle();
    if (error || !connection) throw new Error("Conexão não encontrada");
    if (!connection.secret_ref) throw new Error("Conexão sem chave no cofre. Reconecte a conta.");

    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: secret, error: secretError } = await supabaseAdmin.rpc("vault_read_secret", {
      p_name: connection.secret_ref,
    });
    if (secretError || !secret) throw new Error("Chave não encontrada no cofre. Reconecte a conta.");

    async function fail(message: string) {
      await supabaseAdmin
        .from("connections")
        .update({ status: "erro" })
        .eq("id", connection!.id);
      await supabaseAdmin
        .from("payment_accounts")
        .update({ sync_error: message })
        .eq("stripe_connection_id", connection!.id);
      return { ok: false as const, error: message };
    }

    let numbers: StripeNumbers;
    try {
      const balance = (await stripeGet(secret, "/balance")) as {
        available?: { amount: number }[];
        pending?: { amount: number }[];
        connect_reserved?: { amount: number }[];
      };

      const params = new URLSearchParams({ limit: "100" });
      if (data.from) {
        params.set("created[gte]", String(Math.floor(new Date(`${data.from}T00:00:00Z`).getTime() / 1000)));
      }
      if (data.to) {
        params.set("created[lte]", String(Math.floor(new Date(`${data.to}T23:59:59Z`).getTime() / 1000)));
      }

      type Txn = { id: string; type: string; amount: number; fee: number };
      const txns: Txn[] = [];
      let startingAfter: string | undefined;
      for (let page = 0; page < 10; page += 1) {
        const query = new URLSearchParams(params);
        if (startingAfter) query.set("starting_after", startingAfter);
        const res = (await stripeGet(secret, `/balance_transactions?${query.toString()}`)) as {
          data?: Txn[];
          has_more?: boolean;
        };
        const rows = res.data ?? [];
        txns.push(...rows);
        if (!res.has_more || rows.length === 0) break;
        startingAfter = rows[rows.length - 1]!.id;
      }

      const charges = txns.filter((t) => t.type === "charge" || t.type === "payment");
      const refunds = txns.filter((t) => t.type === "refund" || t.type === "payment_refund");
      const payouts = txns.filter((t) => t.type === "payout");

      numbers = {
        balance_available: sumAmounts(balance.available ?? []),
        balance_pending: sumAmounts(balance.pending ?? []),
        balance_reserved: sumAmounts(balance.connect_reserved ?? []),
        gross_volume: sumAmounts(charges),
        fees_total: txns.reduce((total, t) => total + Math.abs(Number(t.fee ?? 0)), 0) / 100,
        refunds_total: sumAmounts(refunds),
        payouts_total: sumAmounts(payouts),
        last_synced_at: new Date().toISOString(),
      };
    } catch (stripeError) {
      return await fail((stripeError as Error).message);
    }

    const { error: updateError } = await supabaseAdmin
      .from("payment_accounts")
      .update({ ...numbers, sync_error: null })
      .eq("stripe_connection_id", connection.id);
    if (updateError) return await fail("Não foi possível gravar os números.");

    await supabaseAdmin
      .from("connections")
      .update({ status: "conectado", last_sync_at: numbers.last_synced_at })
      .eq("id", connection.id);

    return { ok: true as const, numbers };
  });
