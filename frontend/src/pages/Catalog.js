import { useEffect, useState, useCallback } from "react";
import { MagnifyingGlass, Cube } from "@phosphor-icons/react";
import { SiteLayout } from "@/components/SiteLayout";
import { ProductCard } from "@/components/ProductCard";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { api } from "@/lib/api";

const SORT_OPTIONS = [
  { value: "newest", label: "Mais recentes" },
  { value: "name_asc", label: "Nome (A–Z)" },
  { value: "name_desc", label: "Nome (Z–A)" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
];

export default function Catalog() {
  const [products, setProducts] = useState(null);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    api.get("/categories").then(({ data }) => setCategories(data));
  }, []);

  const load = useCallback(async () => {
    setProducts(null);
    const params = { sort };
    if (search) params.search = search;
    if (category !== "all") params.category = category;
    const { data } = await api.get("/products", { params });
    setProducts(data);
  }, [search, category, sort]);

  useEffect(() => {
    const t = setTimeout(load, 250);
    return () => clearTimeout(t);
  }, [load]);

  return (
    <SiteLayout>
      <div className="border-b border-border">
        <div className="mx-auto max-w-7xl px-6 lg:px-10 py-14">
          <span className="overline-label">Catálogo</span>
          <h1 className="mt-3 font-heading font-black text-4xl md:text-5xl tracking-tighter">Todos os projetos</h1>
          <p className="mt-4 text-muted-foreground max-w-xl">
            Pesquise por nome ou código, filtre por categoria e ordene os projetos disponíveis.
          </p>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 lg:px-10 py-8">
        <div className="flex flex-col lg:flex-row gap-4 mb-8">
          <div className="relative flex-1">
            <MagnifyingGlass size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Pesquisar por nome ou código..."
              data-testid="catalog-search-input"
              className="pl-11 h-11 bg-background border-border rounded-md"
            />
          </div>
          <Select value={category} onValueChange={setCategory}>
            <SelectTrigger className="w-full lg:w-56 h-11 bg-background border-border rounded-md" data-testid="catalog-category-select">
              <SelectValue placeholder="Categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as categorias</SelectItem>
              {categories.map((c) => (
                <SelectItem key={c} value={c}>{c}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={sort} onValueChange={setSort}>
            <SelectTrigger className="w-full lg:w-52 h-11 bg-background border-border rounded-md" data-testid="catalog-sort-select">
              <SelectValue placeholder="Ordenar" />
            </SelectTrigger>
            <SelectContent>
              {SORT_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {products === null ? (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 border-t border-l border-border/60">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="border-r border-b border-border/60 p-5">
                <Skeleton className="aspect-square w-full mb-4" />
                <Skeleton className="h-4 w-2/3" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="border border-border/60 p-16 text-center" data-testid="catalog-empty-state">
            <Cube size={40} weight="duotone" className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Nenhum produto encontrado.</p>
            <p className="text-sm text-muted-foreground mt-1">Tente ajustar a pesquisa ou os filtros.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 border-t border-l border-border/60" data-testid="catalog-grid">
            {products.map((p, i) => (
              <ProductCard key={p.id} product={p} index={i} />
            ))}
          </div>
        )}
      </div>
    </SiteLayout>
  );
}
