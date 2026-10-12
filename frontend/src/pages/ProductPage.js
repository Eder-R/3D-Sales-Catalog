import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Scales, Clock, Cube, Ruler, Palette, Drop } from "@phosphor-icons/react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductImage } from "@/components/ProductImage";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api, fileUrl } from "@/lib/api";
import { formatBRL, formatPrintTime } from "@/lib/format";

const SpecRow = ({ icon: Icon, label, value }) => (
  <div className="flex items-center justify-between border-b border-border/60 py-3.5">
    <span className="flex items-center gap-2.5 text-sm text-muted-foreground">
      <Icon size={17} weight="duotone" className="text-primary" /> {label}
    </span>
    <span className="text-sm font-medium font-mono">{value}</span>
  </div>
);

export default function ProductPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState(null);
  const [notFound, setNotFound] = useState(false);
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    setProduct(null);
    setNotFound(false);
    api
      .get(`/products/${id}`)
      .then(({ data }) => setProduct(data))
      .catch(() => setNotFound(true));
  }, [id]);

  if (notFound) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-28 text-center">
          <Cube size={44} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
          <h1 className="font-heading font-bold text-2xl mb-3">Produto não encontrado</h1>
          <Button asChild variant="outline" className="rounded-md"><Link to="/catalogo">Voltar ao catálogo</Link></Button>
        </div>
      </SiteLayout>
    );
  }

  if (!product) {
    return (
      <SiteLayout>
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14 grid lg:grid-cols-2 gap-12">
          <Skeleton className="aspect-square w-full" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
          </div>
        </div>
      </SiteLayout>
    );
  }

  const images = product.images?.length ? product.images : [null];

  return (
    <SiteLayout>
      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8">
        <Link to="/catalogo" className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200 mb-8" data-testid="back-to-catalog">
          <ArrowLeft size={16} /> Voltar ao catálogo
        </Link>

        <div className="grid lg:grid-cols-2 gap-12">
          {/* Gallery */}
          <div>
            <div className="aspect-square border border-border/60 bg-secondary overflow-hidden">
              <ProductImage
                src={images[activeImg] ? fileUrl(images[activeImg]) : null}
                alt={product.name}
                className="h-full w-full object-cover"
              />
            </div>
            {images.length > 1 && (
              <div className="mt-4 grid grid-cols-5 gap-3">
                {images.map((img, i) => (
                  <button
                    key={i}
                    onClick={() => setActiveImg(i)}
                    data-testid={`thumbnail-${i}`}
                    className={`aspect-square border overflow-hidden transition-colors duration-200 ${i === activeImg ? "border-primary" : "border-border/60 hover:border-border"}`}
                  >
                    <ProductImage src={fileUrl(img)} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <div>
            {product.category && <span className="overline-label">{product.category}</span>}
            <h1 className="mt-3 font-heading font-black text-3xl md:text-4xl tracking-tight" data-testid="product-name">{product.name}</h1>
            {product.code && <p className="mt-2 font-mono text-sm text-muted-foreground">Código: {product.code}</p>}

            <div className="mt-6 flex items-baseline gap-3">
              <span className="font-heading font-bold text-3xl text-primary" data-testid="product-price">{formatBRL(product.price_cents)}</span>
              {!product.available && (
                <span className="text-xs font-mono uppercase tracking-widest text-destructive border border-destructive/40 px-2 py-1">Indisponível</span>
              )}
            </div>

            {product.description && (
              <p className="mt-6 text-muted-foreground leading-relaxed whitespace-pre-line">{product.description}</p>
            )}

            {product.colors?.length > 0 && (
              <div className="mt-7">
                <span className="overline-label">Cores / Variantes</span>
                <div className="mt-3 flex flex-wrap gap-2">
                  {product.colors.map((c) => (
                    <span key={c} className="text-sm border border-border px-3 py-1.5 bg-secondary">{c}</span>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-8 border-t border-border/60">
              <SpecRow icon={Cube} label="Material" value={product.material || "—"} />
              <SpecRow icon={Scales} label="Peso" value={product.weight_grams != null ? `${product.weight_grams} g` : "—"} />
              <SpecRow icon={Clock} label="Tempo de impressão" value={formatPrintTime(product.print_time_minutes)} />
              <SpecRow icon={Ruler} label="Dimensões" value={product.dimensions || "—"} />
              <SpecRow icon={Palette} label="Variantes" value={product.colors?.length ? `${product.colors.length}` : "—"} />
            </div>

            {product.materials_used?.length > 0 && (
              <div className="mt-8" data-testid="materials-used">
                <span className="overline-label">Materiais utilizados</span>
                <div className="mt-3 border border-border/60">
                  {product.materials_used.map((m, i) => (
                    <div key={i} className="flex items-center justify-between border-b border-border/60 last:border-b-0 px-4 py-3">
                      <span className="flex items-center gap-2.5 text-sm">
                        <Drop size={17} weight="duotone" className="text-primary" /> {m.name}
                      </span>
                      <span className="text-sm font-medium font-mono">{m.grams} g</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={() => navigate("/orcamento")} size="lg" className="mt-9 w-full rounded-md" data-testid="product-quote-cta">
              Solicitar orçamento desta peça
            </Button>
          </div>
        </div>
      </div>
    </SiteLayout>
  );
}
