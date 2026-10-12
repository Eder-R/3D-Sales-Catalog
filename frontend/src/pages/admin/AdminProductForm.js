import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ArrowLeft, UploadSimple, X, Plus, Receipt } from "@phosphor-icons/react";
import { AdminLayout } from "@/pages/admin/AdminLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ProductImage } from "@/components/ProductImage";
import { api, fileUrl } from "@/lib/api";
import { parseBRLToCents, formatBRL, formatPrintTime } from "@/lib/format";
import { toast } from "sonner";

const AUTO = "__auto__";

const empty = {
  code: "", name: "", description: "", category: "",
  weight_grams: "", print_time_minutes: "", material: "PLA", dimensions: "",
  images: [], price: "", colors: [], status: "draft", available: true,
  pricing_ref: AUTO, cost_breakdown: null, price_source: "admin", specs_source: "admin",
};

export default function AdminProductForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = !!id;
  const [form, setForm] = useState(empty);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [colorInput, setColorInput] = useState("");
  const [projects, setProjects] = useState([]);
  const [pricingEnabled, setPricingEnabled] = useState(false);

  useEffect(() => {
    api.get("/admin/pricing/projects")
      .then(({ data }) => { setPricingEnabled(data.enabled); setProjects(data.projects || []); })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!isEdit) return;
    api.get("/admin/products").then(({ data }) => {
      const p = data.find((x) => x.id === id);
      if (!p) { toast.error("Produto não encontrado."); navigate("/admin/produtos"); return; }
      setForm({
        ...empty, ...p,
        weight_grams: p.weight_grams ?? "",
        print_time_minutes: p.print_time_minutes ?? "",
        price: p.price_cents != null ? (p.price_cents / 100).toFixed(2).replace(".", ",") : "",
        colors: p.colors || [], images: p.images || [],
        pricing_ref: p.pricing_ref || AUTO,
      });
      setLoading(false);
    });
  }, [id]);

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const handleUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData();
        fd.append("file", file);
        const { data } = await api.post("/admin/upload", fd, { headers: { "Content-Type": "multipart/form-data" } });
        setForm((f) => ({ ...f, images: [...f.images, data.path] }));
      }
      toast.success("Imagem(ns) enviada(s).");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha no upload.");
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (path) => setForm((f) => ({ ...f, images: f.images.filter((i) => i !== path) }));

  const addColor = () => {
    const c = colorInput.trim();
    if (c && !form.colors.includes(c)) setForm((f) => ({ ...f, colors: [...f.colors, c] }));
    setColorInput("");
  };

  const save = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name) { toast.error("Código e nome são obrigatórios."); return; }
    setSaving(true);
    const payload = {
      code: form.code, name: form.name, description: form.description, category: form.category,
      material: form.material, dimensions: form.dimensions, images: form.images,
      colors: form.colors, status: form.status, available: form.available,
      weight_grams: form.weight_grams === "" ? null : Number(form.weight_grams),
      print_time_minutes: form.print_time_minutes === "" ? null : Number(form.print_time_minutes),
      price_cents: parseBRLToCents(form.price),
      pricing_ref: form.pricing_ref && form.pricing_ref !== AUTO ? form.pricing_ref : null,
    };
    try {
      if (isEdit) await api.put(`/admin/products/${id}`, payload);
      else await api.post("/admin/products", payload);
      toast.success(isEdit ? "Produto atualizado." : "Produto criado.");
      navigate("/admin/produtos");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <AdminLayout><div className="p-10 font-mono text-sm text-muted-foreground">Carregando…</div></AdminLayout>;

  const fieldCls = "bg-background border-border rounded-md h-11";

  return (
    <AdminLayout>
      <div className="px-6 lg:px-8 py-10 max-w-3xl mx-auto">
        <Link to="/admin/produtos" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-6">
          <ArrowLeft size={16} /> Voltar
        </Link>
        <h1 className="font-heading font-black text-3xl tracking-tight mb-8">{isEdit ? "Editar produto" : "Novo produto"}</h1>

        {isEdit && form.specs_source === "legacy" && (
          <div className="mb-6 border border-discreet/40 bg-discreet/5 px-4 py-3 text-sm" data-testid="legacy-match-banner">
            <span className="font-mono text-xs uppercase tracking-widest text-discreet">Sistema de precificação</span>
            <p className="mt-1 text-muted-foreground">
              Este produto corresponde a um projeto no seu sistema. Preço{form.price_source === "legacy" ? "" : " (manual)"}, peso e tempo exibidos na loja vêm do sistema. Os campos abaixo são o valor manual de fallback.
            </p>
          </div>
        )}

        <form onSubmit={save} className="space-y-6" data-testid="product-form">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="code">Código *</Label>
              <Input id="code" value={form.code} onChange={set("code")} data-testid="field-code" className={fieldCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="category">Categoria</Label>
              <Input id="category" value={form.category} onChange={set("category")} data-testid="field-category" className={fieldCls} placeholder="Ex: Decoração, Utilidades" />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Nome *</Label>
            <Input id="name" value={form.name} onChange={set("name")} data-testid="field-name" className={fieldCls} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">Descrição</Label>
            <Textarea id="description" rows={4} value={form.description} onChange={set("description")} data-testid="field-description" className="bg-background border-border rounded-md resize-none" />
          </div>

          {pricingEnabled && (
            <div className="space-y-2">
              <Label>Vínculo com o sistema de precificação</Label>
              <Select value={form.pricing_ref || AUTO} onValueChange={(v) => setForm((f) => ({ ...f, pricing_ref: v }))}>
                <SelectTrigger className={fieldCls} data-testid="field-pricing-ref"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={AUTO}>Automático (casar pelo nome)</SelectItem>
                  {projects.map((p) => (
                    <SelectItem key={p.key} value={p.key}>{p.name} — {formatBRL(p.price_cents)}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-[11px] text-muted-foreground">
                Vincule este produto a um projeto do seu sistema para herdar preço, peso e tempo — útil quando o nome difere.
              </p>
            </div>
          )}

          {isEdit && form.cost_breakdown && (
            <div className="border border-border/60 bg-card p-5" data-testid="cost-breakdown">
              <div className="flex items-center gap-2 mb-4">
                <Receipt size={18} weight="duotone" className="text-discreet" />
                <h3 className="font-heading font-bold text-sm">Detalhe de custo (sistema)</h3>
              </div>
              <div className="space-y-2 text-sm">
                {form.cost_breakdown.materials?.length > 0 && (
                  <div className="pb-2 mb-2 border-b border-border/60">
                    {form.cost_breakdown.materials.map((m, i) => (
                      <div key={i} className="flex justify-between text-muted-foreground">
                        <span>Material · {m.name} ({m.grams} g)</span>
                        <span className="font-mono">{formatBRL(m.cost_cents)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="flex justify-between"><span className="text-muted-foreground">Custo de material</span><span className="font-mono">{formatBRL(form.cost_breakdown.material_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Mão de obra ({form.cost_breakdown.labor_minutes} min)</span><span className="font-mono">{formatBRL(form.cost_breakdown.labor_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Impressora ({formatPrintTime(form.cost_breakdown.print_minutes)})</span><span className="font-mono">{formatBRL(form.cost_breakdown.printer_cents)}</span></div>
                <div className="flex justify-between border-t border-border/60 pt-2 font-medium"><span>Custo total</span><span className="font-mono">{formatBRL(form.cost_breakdown.total_cost_cents)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Margem configurada</span><span className="font-mono">{Math.round((form.cost_breakdown.margin_pct || 0) * 100)}%</span></div>
                <div className="flex justify-between border-t border-border/60 pt-2 text-primary font-bold"><span>Preço de venda (sistema)</span><span className="font-mono">{formatBRL(form.cost_breakdown.sale_price_cents)}</span></div>
              </div>
            </div>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="price">Preço de venda (R$)</Label>
              <Input id="price" value={form.price} onChange={set("price")} data-testid="field-price" className={fieldCls} placeholder="0,00" />
              <p className="text-[11px] text-muted-foreground">
                {isEdit && form.price_source === "legacy"
                  ? "Preço atual vindo do sistema de precificação. Este campo é o fallback manual."
                  : "Preço manual (administração). Usado quando não há correspondência no sistema."}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="material">Material</Label>
              <Input id="material" value={form.material} onChange={set("material")} data-testid="field-material" className={fieldCls} />
            </div>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            <div className="space-y-2">
              <Label htmlFor="weight">Peso (g)</Label>
              <Input id="weight" type="number" step="0.1" value={form.weight_grams} onChange={set("weight_grams")} data-testid="field-weight" className={fieldCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="time">Tempo impressão (min)</Label>
              <Input id="time" type="number" value={form.print_time_minutes} onChange={set("print_time_minutes")} data-testid="field-time" className={fieldCls} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dimensions">Dimensões</Label>
              <Input id="dimensions" value={form.dimensions} onChange={set("dimensions")} data-testid="field-dimensions" className={fieldCls} placeholder="10 × 5 × 3 cm" />
            </div>
          </div>

          {/* Colors */}
          <div className="space-y-2">
            <Label>Cores / Variantes</Label>
            <div className="flex gap-2">
              <Input value={colorInput} onChange={(e) => setColorInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addColor(); } }} placeholder="Adicionar cor e Enter" data-testid="field-color-input" className={fieldCls} />
              <Button type="button" variant="outline" onClick={addColor} className="rounded-md border-border shrink-0"><Plus size={18} /></Button>
            </div>
            {form.colors.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {form.colors.map((c) => (
                  <span key={c} className="flex items-center gap-1.5 text-sm border border-border px-2.5 py-1 bg-secondary">
                    {c}
                    <button type="button" onClick={() => setForm((f) => ({ ...f, colors: f.colors.filter((x) => x !== c) }))}><X size={13} className="text-muted-foreground hover:text-destructive" /></button>
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Images */}
          <div className="space-y-3">
            <Label>Imagens</Label>
            <div className="flex flex-wrap gap-3">
              {form.images.map((path) => (
                <div key={path} className="relative h-24 w-24 border border-border/60 overflow-hidden bg-secondary">
                  <ProductImage src={fileUrl(path)} alt="" className="h-full w-full object-cover" />
                  <button type="button" onClick={() => removeImage(path)} className="absolute -right-2 -top-2 bg-destructive text-destructive-foreground rounded-full p-1" data-testid="remove-image">
                    <X size={12} />
                  </button>
                </div>
              ))}
              <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 border border-dashed border-border text-muted-foreground hover:border-primary transition-colors duration-200" data-testid="image-upload-label">
                <UploadSimple size={20} />
                <span className="text-[10px]">{uploading ? "..." : "Enviar"}</span>
                <input type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" disabled={uploading} data-testid="field-images" />
              </label>
            </div>
          </div>

          {/* Status & availability */}
          <div className="grid sm:grid-cols-2 gap-6 border-t border-border/60 pt-6">
            <div className="space-y-2">
              <Label>Status de publicação</Label>
              <Select value={form.status} onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}>
                <SelectTrigger className={fieldCls} data-testid="field-status"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Rascunho</SelectItem>
                  <SelectItem value="published">Publicado</SelectItem>
                  <SelectItem value="archived">Arquivado</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between border border-border rounded-md px-4 h-11 self-end">
              <Label htmlFor="available" className="cursor-pointer">Disponível</Label>
              <Switch id="available" checked={form.available} onCheckedChange={(v) => setForm((f) => ({ ...f, available: v }))} data-testid="field-available" />
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <Button type="submit" disabled={saving} className="rounded-md" data-testid="save-product">
              {saving ? "Salvando..." : "Salvar produto"}
            </Button>
            <Button type="button" variant="outline" onClick={() => navigate("/admin/produtos")} className="rounded-md border-border">Cancelar</Button>
          </div>
        </form>
      </div>
    </AdminLayout>
  );
}
