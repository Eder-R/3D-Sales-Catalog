import { useState } from "react";
import { UploadSimple, CheckCircle, X } from "@phosphor-icons/react";
import { SiteLayout } from "@/components/SiteLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { api, fileUrl } from "@/lib/api";

export default function QuoteRequest() {
  const [form, setForm] = useState({ name: "", email: "", phone: "", description: "", quantity: 1 });
  const [reference, setReference] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("file", file);
      const { data } = await api.post("/upload/quote-reference", fd, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setReference(data.path);
      toast.success("Imagem anexada.");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Falha ao enviar imagem.");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (e) => {
    e.preventDefault();
    if (!form.name || !form.email || !form.description) {
      toast.error("Preencha nome, e-mail e descrição.");
      return;
    }
    setSubmitting(true);
    try {
      await api.post("/quotes", {
        ...form,
        quantity: Number(form.quantity) || 1,
        reference_image: reference,
      });
      setDone(true);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Não foi possível enviar a solicitação.");
    } finally {
      setSubmitting(false);
    }
  };

  if (done) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-xl px-6 py-28 text-center" data-testid="quote-success">
          <CheckCircle size={56} weight="duotone" className="mx-auto text-success mb-5" />
          <h1 className="font-heading font-black text-3xl tracking-tight">Solicitação enviada!</h1>
          <p className="mt-4 text-muted-foreground">
            Recebemos seu pedido de orçamento. Entraremos em contato pelo e-mail informado em breve.
          </p>
          <Button onClick={() => { setDone(false); setForm({ name: "", email: "", phone: "", description: "", quantity: 1 }); setReference(null); }} variant="outline" className="mt-8 rounded-md">
            Enviar outra solicitação
          </Button>
        </div>
      </SiteLayout>
    );
  }

  return (
    <SiteLayout>
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14">
          <span className="overline-label">Orçamento</span>
          <h1 className="mt-3 font-heading font-black text-4xl md:text-5xl tracking-tighter">Peça personalizada</h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Descreva a peça que deseja imprimir. Quanto mais detalhes, mais preciso será o orçamento.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-6 lg:px-10 py-12">
        <form onSubmit={submit} className="space-y-6" data-testid="quote-form">
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="name">Nome *</Label>
              <Input id="name" value={form.name} onChange={set("name")} data-testid="quote-name" className="bg-background border-border rounded-md h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="email">E-mail *</Label>
              <Input id="email" type="email" value={form.email} onChange={set("email")} data-testid="quote-email" className="bg-background border-border rounded-md h-11" />
            </div>
          </div>
          <div className="grid sm:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="phone">Telefone</Label>
              <Input id="phone" value={form.phone} onChange={set("phone")} data-testid="quote-phone" className="bg-background border-border rounded-md h-11" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="quantity">Quantidade *</Label>
              <Input id="quantity" type="number" min="1" value={form.quantity} onChange={set("quantity")} data-testid="quote-quantity" className="bg-background border-border rounded-md h-11" />
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="description">Descrição da peça *</Label>
            <Textarea id="description" rows={6} value={form.description} onChange={set("description")} data-testid="quote-description" placeholder="Descreva dimensões, uso, cor desejada, prazo, etc." className="bg-background border-border rounded-md resize-none" />
          </div>

          <div className="space-y-2">
            <Label>Imagem de referência (opcional)</Label>
            {reference ? (
              <div className="relative inline-block">
                <img src={fileUrl(reference)} alt="referência" className="h-32 w-32 object-cover border border-border" />
                <button type="button" onClick={() => setReference(null)} className="absolute -right-2 -top-2 bg-destructive text-destructive-foreground rounded-full p-1" data-testid="remove-reference">
                  <X size={14} />
                </button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-3 border border-dashed border-border bg-background py-8 text-sm text-muted-foreground hover:border-primary transition-colors duration-200" data-testid="quote-upload-label">
                <UploadSimple size={20} />
                {uploading ? "Enviando..." : "Clique para anexar uma imagem (JPG, PNG, WEBP)"}
                <input type="file" accept="image/*" onChange={handleUpload} className="hidden" disabled={uploading} data-testid="quote-reference-input" />
              </label>
            )}
          </div>

          <Button type="submit" size="lg" disabled={submitting} className="w-full rounded-md" data-testid="quote-submit">
            {submitting ? "Enviando..." : "Enviar solicitação"}
          </Button>
        </form>
      </div>
    </SiteLayout>
  );
}
