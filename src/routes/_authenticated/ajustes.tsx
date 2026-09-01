import { useRef, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { Download, Upload } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";
import { AppCard } from "@/components/app-card";
import { ErrorState, LoadingState } from "@/components/states";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { useOrgId, usePermissions } from "@/hooks/use-org";
import { useEurRate } from "@/hooks/use-eur-rate";
import {
  downloadBackup,
  exportOrgData,
  getLastExportAt,
  importBackup,
  parseBackup,
} from "@/lib/backup";

export const Route = createFileRoute("/_authenticated/ajustes")({
  head: () => ({
    meta: [
      { title: "Ajustes | EuroHub" },
      {
        name: "description",
        content: "Exportar e importar todos os dados da empresa no EuroHub.",
      },
      { property: "og:title", content: "Ajustes | EuroHub" },
      {
        property: "og:description",
        content: "Exportar e importar todos os dados da empresa no EuroHub.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Ajustes,
});

function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString("pt-BR");
}

function Ajustes() {
  const queryClient = useQueryClient();
  const { data: orgId, isLoading, error, refetch } = useOrgId();
  const fileRef = useRef<HTMLInputElement>(null);
  const [lastExport, setLastExport] = useState(() => getLastExportAt());
  const [busy, setBusy] = useState<"export" | "import" | null>(null);
  const [onlyMissing, setOnlyMissing] = useState(true);
  const perms = usePermissions();
  const { rate, isLoading: loadingRate, save: saveRate } = useEurRate();
  const [rateText, setRateText] = useState<string | null>(null);
  const rateValue = rateText ?? String(rate).replace(".", ",");

  async function handleExport() {
    if (!orgId) return;
    setBusy("export");
    try {
      const backup = await exportOrgData(orgId);
      const name = downloadBackup(backup);
      setLastExport(backup.exported_at);
      toast.success(`Backup gerado: ${name}`);
    } catch {
      toast.error("Não foi possível exportar os dados.");
    } finally {
      setBusy(null);
    }
  }

  async function handleImport(file: File) {
    if (!orgId) return;
    setBusy("import");
    try {
      const backup = parseBackup(await file.text());
      const { total, skipped } = await importBackup(orgId, backup, {
        skipExisting: onlyMissing,
      });
      await queryClient.invalidateQueries();
      toast.success(
        total > 0
          ? `${total} registro(s) importado(s).${skipped ? ` ${skipped} já existiam.` : ""}`
          : "Nada a importar — todos os registros do arquivo já estão no sistema.",
      );
    } catch {
      toast.error("Não foi possível importar este arquivo.");
    } finally {
      setBusy(null);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  return (
    <>
      <PageHeader title="Ajustes" subtitle="Preferências da empresa e cópia de segurança." />

      <AppCard
        title="Cotação do euro (R$)"
        subtitle="Usada para mostrar o equivalente em real ao lado dos valores em euro da Stripe. Atualize quando o câmbio mudar."
      >
        {loadingRate ? (
          <LoadingState />
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <div className="space-y-1">
              <Label htmlFor="eur-rate" className="text-label">
                1 € equivale a
              </Label>
              <Input
                id="eur-rate"
                inputMode="decimal"
                className="text-body w-40"
                value={rateValue}
                disabled={!perms.isAdmin}
                onChange={(e) => setRateText(e.target.value)}
              />
            </div>
            <Button
              className="text-body"
              disabled={!perms.isAdmin || saveRate.isPending}
              onClick={() => {
                const parsed = Number(rateValue.replace(",", "."));
                if (!Number.isFinite(parsed) || parsed <= 0) {
                  toast.error("Informe uma cotação válida (ex.: 6,20).");
                  return;
                }
                saveRate.mutate(Number(parsed.toFixed(4)));
              }}
            >
              Salvar cotação
            </Button>
            {!perms.isAdmin && (
              <p className="text-label text-muted-foreground">
                Só dono ou admin pode alterar a cotação.
              </p>
            )}
          </div>
        )}
      </AppCard>

      <AppCard
        title="Cópia de segurança"
        subtitle="Exporte tudo em um arquivo JSON e restaure quando precisar."
      >
        {isLoading ? (
          <LoadingState />
        ) : error ? (
          <ErrorState onRetry={refetch} />
        ) : (
          <div className="space-y-4">
            <p className="text-body text-muted-foreground">
              O arquivo inclui lançamentos, despesas fixas, saldo inicial, quadros, colunas,
              cartões, itens de cartão, pastas e arquivos. Os arquivos em si continuam guardados
              no armazenamento — o backup guarda apenas os caminhos.
            </p>

            <div className="flex flex-wrap items-center gap-2">
              <Button
                className="text-body"
                onClick={handleExport}
                disabled={busy !== null || !orgId}
              >
                <Download className="size-4" aria-hidden />
                Exportar tudo
              </Button>
              <Button
                variant="outline"
                className="text-body"
                onClick={() => fileRef.current?.click()}
                disabled={busy !== null || !orgId}
              >
                <Upload className="size-4" aria-hidden />
                Importar backup
              </Button>
              <input
                ref={fileRef}
                type="file"
                accept="application/json,.json"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void handleImport(file);
                }}
              />
            </div>

            <div className="flex items-center gap-2">
              <Switch
                id="only-missing"
                checked={onlyMissing}
                onCheckedChange={setOnlyMissing}
                disabled={busy !== null}
              />
              <Label htmlFor="only-missing" className="text-body font-normal">
                Restaurar só o que está faltando (evita duplicar o que já existe)
              </Label>
            </div>

            <p className="text-label text-muted-foreground">
              {busy === "export"
                ? "Gerando o arquivo…"
                : busy === "import"
                  ? "Importando registros…"
                  : lastExport
                    ? `Última exportação: ${formatDateTime(lastExport)}`
                    : "Nenhuma exportação feita ainda."}
            </p>
          </div>
        )}
      </AppCard>
    </>
  );
}
