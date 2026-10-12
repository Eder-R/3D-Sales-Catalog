import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, PencilSimple, Trash, Eye, Archive, FileDashed, Package, DownloadSimple } from "@phosphor-icons/react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { ProductImage } from "@/components/ProductImage";
import { api, fileUrl } from "@/lib/api";
import { formatBRL, STATUS_LABELS } from "@/lib/format";
import { toast } from "sonner";

const statusStyle = {
  published: "text-success border-success/40",
  draft: "text-muted-foreground border-border",
  archived: "text-destructive border-destructive/40",
};

export default function AdminProducts() {
  const [products, setProducts] = useState(null);
  const [toDelete, setToDelete] = useState(null);
  const [importOpen, setImportOpen] = useState(false);
  const [importInfo, setImportInfo] = useState(null);
  const [importing, setImporting] = useState(false);

  const load = () => api.get("/admin/products").then(({ data }) => setProducts(data));
  useEffect(() => { load(); }, []);

  const openImport = async () => {
    setImportInfo(null);
    setImportOpen(true);
    try {
      const { data } = await api.get("/admin/pricing/projects");
      const pending = (data.projects || []).filter((p) => !p.in_catalog);
      setImportInfo({ enabled: data.enabled, total: (data.projects || []).length, pending: pending.length, projects: pending });
    } catch {
      setImportInfo({ enabled: false, total: 0, pending: 0, projects: [] });
    }
  };

  const doImport = async () => {
    setImporting(true);
    try {
      const { data } = await api.post("/admin/pricing/import");
      toast.success(`${data.created} projeto(s) importado(s) como rascunho.`);
      setImportOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha ao importar.");
    } finally {
      setImporting(false);
    }
  };

  const changeStatus = async (p, status) => {
    await api.put(`/admin/products/${p.id}`, { status });
    toast.success(`Status atualizado: ${STATUS_LABELS[status]}`);
    load();
  };

  const remove = async () => {
    await api.delete(`/admin/products/${toDelete.id}`);
    setToDelete(null);
    toast.success("Produto excluído.");
    load();
  };

  return (
    <AdminLayout>
      <div className="px-6 lg:px-8 py-10 max-w-7xl mx-auto">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl tracking-tight">Produtos</h1>
            <p className="text-sm text-muted-foreground mt-1">Cadastre, edite, publique e arquive projetos.</p>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" onClick={openImport} className="rounded-md border-border" data-testid="import-projects-button">
              <DownloadSimple size={18} className="mr-1.5" /> Importar do sistema
            </Button>
            <Button asChild className="rounded-md" data-testid="new-product-button">
              <Link to="/admin/produtos/novo"><Plus size={18} className="mr-1.5" /> Novo produto</Link>
            </Button>
          </div>
        </div>

        {products === null ? (
          <div className="space-y-px">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}
          </div>
        ) : products.length === 0 ? (
          <div className="border border-border/60 p-16 text-center" data-testid="admin-products-empty">
            <Package size={40} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum produto cadastrado ainda.</p>
            <Button asChild className="rounded-md mt-5"><Link to="/admin/produtos/novo">Cadastrar primeiro produto</Link></Button>
          </div>
        ) : (
          <div className="border-t border-l border-border/60" data-testid="admin-products-list">
            {products.map((p) => (
              <div key={p.id} className="flex items-center gap-4 border-r border-b border-border/60 p-4 bg-card hover:bg-secondary transition-colors duration-200" data-testid={`admin-product-row-${p.id}`}>
                <div className="h-16 w-16 shrink-0 border border-border/60 overflow-hidden bg-secondary">
                  <ProductImage src={p.images?.[0] ? fileUrl(p.images[0]) : null} alt={p.name} className="h-full w-full object-cover" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[11px] text-muted-foreground">{p.code}</span>
                    <span className={`text-[10px] font-mono uppercase tracking-widest border px-1.5 py-0.5 ${statusStyle[p.status]}`}>{STATUS_LABELS[p.status]}</span>
                    {!p.available && <span className="text-[10px] font-mono uppercase tracking-widest border border-destructive/40 text-destructive px-1.5 py-0.5">Indisponível</span>}
                  </div>
                  <h3 className="font-heading font-bold text-sm truncate mt-0.5">{p.name}</h3>
                  <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-2 flex-wrap">
                    <span>{p.category || "Sem categoria"}</span>
                    <span>·</span>
                    <span className="font-mono text-foreground">{formatBRL(p.effective_price_cents)}</span>
                    <span
                      data-testid={`price-source-${p.id}`}
                      className={`text-[10px] font-mono uppercase tracking-widest border px-1.5 py-0.5 ${p.price_source === "legacy" ? "text-discreet border-discreet/40" : "text-muted-foreground border-border"}`}
                    >
                      {p.price_source === "legacy" ? "Sistema" : "Manual"}
                    </span>
                  </p>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {p.status !== "published" ? (
                    <Button variant="ghost" size="icon" title="Publicar" onClick={() => changeStatus(p, "published")} data-testid={`publish-${p.id}`} className="h-9 w-9 text-muted-foreground hover:text-success">
                      <Eye size={18} />
                    </Button>
                  ) : (
                    <Button variant="ghost" size="icon" title="Despublicar (rascunho)" onClick={() => changeStatus(p, "draft")} data-testid={`unpublish-${p.id}`} className="h-9 w-9 text-muted-foreground">
                      <FileDashed size={18} />
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" title="Arquivar" onClick={() => changeStatus(p, "archived")} data-testid={`archive-${p.id}`} className="h-9 w-9 text-muted-foreground hover:text-foreground">
                    <Archive size={18} />
                  </Button>
                  <Button asChild variant="ghost" size="icon" title="Editar" className="h-9 w-9 text-muted-foreground hover:text-primary">
                    <Link to={`/admin/produtos/${p.id}`} data-testid={`edit-${p.id}`}><PencilSimple size={18} /></Link>
                  </Button>
                  <Button variant="ghost" size="icon" title="Excluir" onClick={() => setToDelete(p)} data-testid={`delete-${p.id}`} className="h-9 w-9 text-muted-foreground hover:text-destructive">
                    <Trash size={18} />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <AlertDialog open={importOpen} onOpenChange={(o) => !o && setImportOpen(false)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Importar projetos do sistema</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                {importInfo === null ? (
                  <span>Carregando projetos…</span>
                ) : !importInfo.enabled ? (
                  <span>A integração de precificação não está ativa.</span>
                ) : importInfo.pending === 0 ? (
                  <span>Todos os {importInfo.total} projetos do sistema já estão no catálogo.</span>
                ) : (
                  <>
                    <span className="block">
                      {importInfo.pending} de {importInfo.total} projeto(s) ainda não estão no catálogo. Eles serão criados como <strong>rascunho</strong>, já com preço, peso e tempo do sistema.
                    </span>
                    <ul className="text-xs font-mono text-muted-foreground max-h-40 overflow-auto border border-border/60 p-2">
                      {importInfo.projects.map((p) => (
                        <li key={p.key}>• {p.name} — {formatBRL(p.price_cents)}</li>
                      ))}
                    </ul>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Fechar</AlertDialogCancel>
            {importInfo?.enabled && importInfo?.pending > 0 && (
              <AlertDialogAction onClick={doImport} disabled={importing} data-testid="confirm-import" className="rounded-md">
                {importing ? "Importando..." : `Importar ${importInfo.pending} projeto(s)`}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!toDelete} onOpenChange={(o) => !o && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir produto?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita. O produto "{toDelete?.name}" será removido permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-md">Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={remove} data-testid="confirm-delete" className="rounded-md bg-destructive text-destructive-foreground hover:bg-destructive/90">Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}
