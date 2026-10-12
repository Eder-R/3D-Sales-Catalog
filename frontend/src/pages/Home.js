import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Cube, Lightning, Stack, Ruler } from "@phosphor-icons/react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { api } from "@/lib/api";

const HERO_IMG =
  "https://images.unsplash.com/photo-1622737133809-d95047b9e673?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2Njd8MHwxfHNlYXJjaHwxfHxnZW9tZXRyaWMlMjAzZCUyMG9iamVjdCUyMG1pbmltYWx8ZW58MHx8fHwxNzkxNzY3Mzk0fDA&ixlib=rb-4.1.0&q=85";

const features = [
  { icon: Cube, title: "PLA de qualidade", text: "Filamento PLA com acabamento preciso para peças duráveis." },
  { icon: Lightning, title: "Sob demanda", text: "Cada projeto impresso conforme o pedido, sem estoque parado." },
  { icon: Stack, title: "Catálogo organizado", text: "Projetos com especificações técnicas completas." },
  { icon: Ruler, title: "Personalização", text: "Solicite peças sob medida através de orçamento." },
];

export default function Home() {
  const [products, setProducts] = useState(null);

  useEffect(() => {
    api.get("/products", { params: { sort: "newest" } }).then(({ data }) => setProducts(data.slice(0, 6)));
  }, []);

  return (
    <SiteLayout>
      {/* Hero */}
      <section className="relative grain overflow-hidden border-b border-border">
        <div className="absolute inset-0 z-0">
          <img src={HERO_IMG} alt="" className="h-full w-full object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-background/30" />
          <div className="absolute inset-0 bg-gradient-to-t from-background to-transparent" />
        </div>
        <div className="relative z-10 mx-auto max-w-7xl px-6 lg:px-10 py-24 md:py-36">
          <div className="max-w-2xl animate-fade-up">
            <span className="overline-label">Impressão 3D · PLA</span>
            <h1 className="mt-5 font-heading font-black text-4xl sm:text-5xl lg:text-6xl leading-none tracking-tighter">
              Projetos impressos
              <br />
              <span className="text-primary">camada por camada.</span>
            </h1>
            <p className="mt-6 text-base md:text-lg text-muted-foreground max-w-xl leading-relaxed">
              Um catálogo de peças em PLA criadas sob demanda. Explore os projetos disponíveis ou solicite uma peça personalizada.
            </p>
            <div className="mt-9 flex flex-wrap gap-4">
              <Button asChild size="lg" className="rounded-md" data-testid="hero-catalog-cta">
                <Link to="/catalogo">
                  Ver catálogo <ArrowRight size={18} className="ml-2" />
                </Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-md border-border" data-testid="hero-quote-cta">
                <Link to="/orcamento">Solicitar orçamento</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border-t border-l border-border/60">
          {features.map((f) => (
            <div key={f.title} className="border-r border-b border-border/60 p-7">
              <f.icon size={28} weight="duotone" className="text-primary mb-4" />
              <h3 className="font-heading font-bold text-base mb-2">{f.title}</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">{f.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Featured products */}
      <section className="mx-auto max-w-7xl px-6 lg:px-10 py-10 pb-20">
        <div className="flex items-end justify-between mb-8">
          <div>
            <span className="overline-label">Destaques</span>
            <h2 className="mt-2 font-heading font-bold text-2xl md:text-3xl tracking-tight">Projetos em destaque</h2>
          </div>
          <Link to="/catalogo" className="hidden sm:flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors duration-200" data-testid="view-all-link">
            Ver tudo <ArrowRight size={16} />
          </Link>
        </div>

        {products === null ? (
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-border/60">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="border-r border-b border-border/60 p-5">
                <Skeleton className="aspect-square w-full mb-4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="border border-border/60 p-16 text-center">
            <Cube size={40} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum projeto publicado ainda.</p>
            <p className="text-sm text-muted-foreground mt-1">Os produtos aparecerão aqui assim que forem publicados na administração.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 lg:grid-cols-3 border-t border-l border-border/60">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </section>
    </SiteLayout>
  );
}
