import { useEffect, useState } from "react";
import { Envelope, Image as ImageIcon } from "@phosphor-icons/react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import { api, fileUrl } from "@/lib/api";
import { QUOTE_STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";

const statusStyle = {
  new: "text-primary border-primary/40",
  in_review: "text-discreet border-discreet/40",
  answered: "text-success border-success/40",
  archived: "text-muted-foreground border-border",
};

export default function AdminQuotes() {
  const [quotes, setQuotes] = useState(null);
  const [preview, setPreview] = useState(null);

  const load = () => api.get("/admin/quotes").then(({ data }) => setQuotes(data));
  useEffect(() => { load(); }, []);

  const changeStatus = async (q, status) => {
    await api.patch(`/admin/quotes/${q.id}/status`, { status });
    toast.success("Status atualizado.");
    load();
  };

  const fmtDate = (iso) => new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

  return (
    <AdminLayout>
      <div className="px-6 lg:px-8 py-10 max-w-7xl mx-auto">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl tracking-tight">Orçamentos</h1>
          <p className="text-sm text-muted-foreground mt-1">Solicitações de peças personalizadas enviadas pelos clientes.</p>
        </div>

        {quotes === null ? (
          <div className="space-y-px">{Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full" />)}</div>
        ) : quotes.length === 0 ? (
          <div className="border border-border/60 p-16 text-center" data-testid="admin-quotes-empty">
            <Envelope size={40} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhuma solicitação de orçamento recebida.</p>
          </div>
        ) : (
          <div className="space-y-4" data-testid="admin-quotes-list">
            {quotes.map((q) => (
              <div key={q.id} className="border border-border/60 bg-card p-5" data-testid={`quote-row-${q.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-heading font-bold text-base">{q.name}</h3>
                      <span className={`text-[10px] font-mono uppercase tracking-widest border px-1.5 py-0.5 ${statusStyle[q.status]}`}>{QUOTE_STATUS_LABELS[q.status]}</span>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">
                      {q.email}{q.phone ? ` · ${q.phone}` : ""} · Qtd: {q.quantity}
                    </p>
                    <p className="text-[11px] text-muted-foreground font-mono mt-0.5">{fmtDate(q.created_at)}</p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {q.reference_image && (
                      <button onClick={() => setPreview(q.reference_image)} className="h-14 w-14 border border-border/60 overflow-hidden bg-secondary" title="Ver imagem de referência" data-testid={`quote-image-${q.id}`}>
                        <img src={fileUrl(q.reference_image)} alt="ref" className="h-full w-full object-cover" />
                      </button>
                    )}
                    <Select value={q.status} onValueChange={(v) => changeStatus(q, v)}>
                      <SelectTrigger className="w-40 h-10 bg-background border-border rounded-md" data-testid={`quote-status-${q.id}`}><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Object.entries(QUOTE_STATUS_LABELS).map(([v, l]) => <SelectItem key={v} value={v}>{l}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <p className="mt-4 text-sm text-foreground/90 whitespace-pre-line border-t border-border/60 pt-4">{q.description}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!preview} onOpenChange={(o) => !o && setPreview(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>Imagem de referência</DialogTitle></DialogHeader>
          {preview && <img src={fileUrl(preview)} alt="referência" className="w-full object-contain max-h-[70vh]" />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
