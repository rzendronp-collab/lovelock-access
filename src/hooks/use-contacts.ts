import { useMemo } from "react";
import { useRecords } from "@/hooks/use-records";
import { useOrgId } from "@/hooks/use-org";
import type { FieldDef } from "@/components/detail-panel";

export type ContactRow = {
  id: string;
  kind: string;
  name: string;
  email: string | null;
  phone: string | null;
  doc: string | null;
  note: string;
};

export const CONTACT_KINDS = [
  { value: "cliente", label: "Cliente" },
  { value: "fornecedor", label: "Fornecedor" },
  { value: "parceiro", label: "Parceiro" },
  { value: "equipe", label: "Equipe" },
] as const;

export function contactKindLabel(kind: string) {
  return CONTACT_KINDS.find((k) => k.value === kind)?.label ?? kind;
}

/** Cadastro ÚNICO de pessoas (contacts) — usado pelo módulo Pessoas e pelos vínculos. */
export function useContacts() {
  const { data: orgId } = useOrgId();
  return useRecords<ContactRow>({
    table: "contacts",
    columns: "id, kind, name, email, phone, doc, note",
    orgId: orgId ?? null,
    orderBy: { column: "name", ascending: true },
    trackCreatedBy: true,
    label: "contato",
  });
}

/**
 * Campo opcional "Contato" para os formulários de Dinheiro, Trabalho e Arquivos.
 * Reaproveita o tipo "choice" do RecordPanel, com busca pelo nome já cadastrado.
 */
export function useContactField(): { field: FieldDef; contacts: ContactRow[] } {
  const contacts = useContacts();
  const rows = contacts.rows;
  const field = useMemo<FieldDef>(
    () => ({
      name: "contact_id",
      label: "Contato (opcional)",
      type: "choice",
      options: [
        { value: "", label: "Sem contato" },
        ...rows.map((c) => ({ value: c.id, label: c.name })),
      ],
    }),
    [rows],
  );
  return { field, contacts: rows };
}
