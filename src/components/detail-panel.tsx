import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { SelectPill, SelectPillGroup } from "@/components/select-pill";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";

/** Painel lateral ÚNICO de detalhe/edição do sistema. */
export function DetailPanel({
  open,
  onOpenChange,
  title,
  description,
  footer,
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  footer?: ReactNode;
  children: ReactNode;
}) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent className="flex w-full flex-col gap-0 sm:max-w-md">
        <SheetHeader>
          <SheetTitle className="text-highlight">{title}</SheetTitle>
          {description && <SheetDescription className="text-label">{description}</SheetDescription>}
        </SheetHeader>
        <div className="flex-1 overflow-y-auto py-4">{children}</div>
        {footer && <SheetFooter>{footer}</SheetFooter>}
      </SheetContent>
    </Sheet>
  );
}

/** Rótulo + campo — usado por todo formulário do sistema. */
export function Field({
  label,
  id,
  children,
}: {
  label: string;
  id: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1">
      <Label htmlFor={id} className="text-label">
        {label}
      </Label>
      {children}
    </div>
  );
}

export type FieldValue = string | boolean;

export type FieldDef = {
  name: string;
  label: string;
  type: "text" | "textarea" | "date" | "month" | "number" | "decimal" | "switch" | "choice";
  /** Opções quando type = "choice". */
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
  placeholder?: string;
  /** Mostra o campo só quando esta condição for verdadeira. */
  showWhen?: (values: Record<string, FieldValue>) => boolean;
};

/**
 * Painel de detalhe declarativo: monta os campos a partir de uma lista de
 * definições — não conhece nenhuma tabela específica.
 */
export function RecordPanel({
  open,
  onOpenChange,
  title,
  description,
  fields,
  values,
  onChange,
  onSave,
  saving = false,
  saveLabel = "Salvar",
  idPrefix = "rp",
  children,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  fields: FieldDef[];
  values: Record<string, FieldValue>;
  onChange: (name: string, value: FieldValue) => void;
  onSave: () => void;
  saving?: boolean;
  saveLabel?: string;
  idPrefix?: string;
  children?: ReactNode;
}) {
  return (
    <DetailPanel
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      footer={
        <Button className="text-body w-full" disabled={saving} onClick={onSave}>
          {saving ? "Salvando..." : saveLabel}
        </Button>
      }
    >
      <div className="space-y-4">
        {fields.map((f) => {
          if (f.showWhen && !f.showWhen(values)) return null;
          const id = `${idPrefix}-${f.name}`;
          const raw = values[f.name];

          if (f.type === "switch") {
            return (
              <div key={f.name} className="flex items-center justify-between">
                <Label htmlFor={id} className="text-body">
                  {f.label}
                </Label>
                <Switch
                  id={id}
                  checked={Boolean(raw)}
                  onCheckedChange={(v) => onChange(f.name, v)}
                />
              </div>
            );
          }

          if (f.type === "choice") {
            return (
              <div key={f.name} className="space-y-1">
                <p className="text-label text-muted-foreground">{f.label}</p>
                <SelectPillGroup>
                  {(f.options ?? []).map((o) => (
                    <SelectPill
                      key={o.value}
                      active={String(raw ?? "") === o.value}
                      onClick={() => onChange(f.name, o.value)}
                    >
                      {o.label}
                    </SelectPill>
                  ))}
                </SelectPillGroup>
              </div>
            );
          }

          if (f.type === "textarea") {
            return (
              <Field key={f.name} label={f.label} id={id}>
                <Textarea
                  id={id}
                  className="text-body"
                  placeholder={f.placeholder}
                  value={String(raw ?? "")}
                  onChange={(e) => onChange(f.name, e.target.value)}
                />
              </Field>
            );
          }

          return (
            <Field key={f.name} label={f.label} id={id}>
              <Input
                id={id}
                className="text-body"
                type={f.type === "decimal" ? "text" : f.type === "number" ? "number" : f.type}
                inputMode={f.type === "decimal" ? "decimal" : undefined}
                min={f.min}
                max={f.max}
                placeholder={f.placeholder}
                value={String(raw ?? "")}
                onChange={(e) => onChange(f.name, e.target.value)}
              />
            </Field>
          );
        })}
        {children}
      </div>
    </DetailPanel>
  );
}

/** Confirmação ÚNICA do sistema (usada em exclusões e ações destrutivas). */
export function ConfirmDialog({
  open,
  onOpenChange,
  title = "Tem certeza?",
  description = "Esta ação não pode ser desfeita.",
  confirmLabel = "Confirmar",
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onConfirm: () => void;
}) {
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="text-highlight">{title}</AlertDialogTitle>
          <AlertDialogDescription className="text-body">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel className="text-body">Cancelar</AlertDialogCancel>
          <AlertDialogAction className="text-body" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
