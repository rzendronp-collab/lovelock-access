import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

const db = supabase as unknown as SupabaseClient;

/** Tabelas exportadas, na ordem em que devem ser recriadas na importação. */
export const BACKUP_TABLES = [
  "finance_entries",
  "fixed_costs",
  "cash_opening",
  "boards",
  "board_columns",
  "cards",
  "card_items",
  "folders",
  "files",
] as const;

export type BackupTable = (typeof BACKUP_TABLES)[number];

export type BackupFile = {
  app: "eurohub";
  version: 1;
  exported_at: string;
  org_id: string;
  tables: Record<string, Row[]>;
};

type Row = Record<string, unknown> & { id: string };

/** Campos recriados pelo banco — nunca copiados na importação. */
const OMIT_ON_IMPORT = ["id", "org_id", "created_at", "updated_at"];

/** Vínculos entre tabelas: campo -> tabela de origem do id antigo. */
const RELATIONS: Partial<Record<BackupTable, Record<string, BackupTable>>> = {
  board_columns: { board_id: "boards" },
  cards: { board_id: "boards", column_id: "board_columns" },
  card_items: { card_id: "cards" },
  folders: { parent_id: "folders" },
  files: { folder_id: "folders" },
};

export const LAST_EXPORT_KEY = "eurohub:last-export-at";

export function getLastExportAt() {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(LAST_EXPORT_KEY);
}

function setLastExportAt(iso: string) {
  if (typeof localStorage !== "undefined") localStorage.setItem(LAST_EXPORT_KEY, iso);
}

/** Lê todos os dados da empresa (inclui itens já excluídos para não perder histórico). */
export async function exportOrgData(orgId: string): Promise<BackupFile> {
  const tables: Record<string, Row[]> = {};
  for (const table of BACKUP_TABLES) {
    const { data, error } = await db.from(table).select("*").eq("org_id", orgId);
    if (error) throw error;
    tables[table] = (data ?? []) as Row[];
  }
  return {
    app: "eurohub",
    version: 1,
    exported_at: new Date().toISOString(),
    org_id: orgId,
    tables,
  };
}

/** Baixa o backup como JSON com a data no nome do arquivo. */
export function downloadBackup(backup: BackupFile) {
  const date = backup.exported_at.slice(0, 10);
  const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `eurohub-backup-${date}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
  setLastExportAt(backup.exported_at);
  return a.download;
}

export function parseBackup(text: string): BackupFile {
  const parsed = JSON.parse(text) as BackupFile;
  if (!parsed || parsed.app !== "eurohub" || typeof parsed.tables !== "object") {
    throw new Error("Arquivo de backup inválido.");
  }
  return parsed;
}

/**
 * Recria os registros do backup na empresa atual, gerando ids novos e
 * remapeando os vínculos entre as tabelas. Devolve a contagem por tabela.
 */
export async function importBackup(orgId: string, backup: BackupFile) {
  /** id antigo -> id novo, por tabela. */
  const idMap: Record<string, Map<string, string>> = {};
  const counts: Record<string, number> = {};

  for (const table of BACKUP_TABLES) {
    const rows = backup.tables[table] ?? [];
    idMap[table] = new Map();
    counts[table] = 0;
    if (!rows.length) continue;

    // folders pode apontar para si mesma: insere em ondas conforme os pais existirem.
    const pending = [...rows];
    let guard = 0;
    while (pending.length && guard < 50) {
      guard += 1;
      const batch: { old: string; values: Record<string, unknown> }[] = [];
      const skipped: Row[] = [];

      for (const row of pending) {
        const values: Record<string, unknown> = { org_id: orgId };
        let ready = true;
        for (const [key, value] of Object.entries(row)) {
          if (OMIT_ON_IMPORT.includes(key)) continue;
          const relTable = RELATIONS[table]?.[key];
          if (relTable) {
            if (value == null) {
              values[key] = null;
              continue;
            }
            const mapped = idMap[relTable]?.get(String(value));
            if (!mapped) {
              // Pai ainda não recriado (auto-relação) — tenta na próxima onda.
              if (relTable === table) {
                ready = false;
                break;
              }
              values[key] = null;
              continue;
            }
            values[key] = mapped;
            continue;
          }
          values[key] = value;
        }
        if (!ready) {
          skipped.push(row);
          continue;
        }
        batch.push({ old: row.id, values });
      }

      if (!batch.length) {
        // Nada avançou: insere o resto sem o vínculo circular.
        for (const row of skipped) {
          const values: Record<string, unknown> = { org_id: orgId };
          for (const [key, value] of Object.entries(row)) {
            if (OMIT_ON_IMPORT.includes(key)) continue;
            values[key] = RELATIONS[table]?.[key] ? null : value;
          }
          batch.push({ old: row.id, values });
        }
        skipped.length = 0;
      }

      const { data, error } = await db
        .from(table)
        .insert(batch.map((b) => b.values))
        .select("id");
      if (error) throw error;
      const inserted = (data ?? []) as { id: string }[];
      inserted.forEach((r, i) => {
        const old = batch[i]?.old;
        if (old) idMap[table]!.set(old, r.id);
      });
      counts[table] = (counts[table] ?? 0) + inserted.length;

      pending.length = 0;
      pending.push(...skipped);
    }
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0);
  return { counts, total };
}
