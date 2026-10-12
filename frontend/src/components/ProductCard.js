import { Link } from "react-router-dom";
import { ArrowRight } from "@phosphor-icons/react";
import { ProductImage } from "@/components/ProductImage";
import { fileUrl } from "@/lib/api";
import { formatBRL } from "@/lib/format";

export const ProductCard = ({ product, index = 0 }) => {
  const img = product.images?.[0] ? fileUrl(product.images[0]) : null;
  return (
    <Link
      to={`/produto/${product.id}`}
      data-testid={`product-card-${product.id}`}
      className="group relative flex flex-col border-r border-b border-border/60 bg-card transition-colors duration-200 hover:bg-secondary animate-fade-up"
      style={{ animationDelay: `${Math.min(index * 60, 400)}ms` }}
    >
      <div className="relative aspect-square overflow-hidden bg-secondary">
        <ProductImage
          src={img}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
        {product.code && (
          <span className="absolute left-3 top-3 font-mono text-[10px] uppercase tracking-widest bg-black/70 backdrop-blur px-2 py-1 text-muted-foreground">
            {product.code}
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-5">
        {product.category && <span className="overline-label mb-2">{product.category}</span>}
        <h3 className="font-heading font-bold text-base leading-tight mb-3 group-hover:text-primary transition-colors duration-200">
          {product.name}
        </h3>
        <div className="mt-auto flex items-center justify-between pt-3">
          <span className="font-mono text-sm font-medium text-foreground">{formatBRL(product.price_cents)}</span>
          <ArrowRight size={18} className="text-muted-foreground transition-transform duration-200 group-hover:translate-x-1 group-hover:text-primary" />
        </div>
      </div>
    </Link>
  );
};
