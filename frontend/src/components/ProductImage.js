import { useState } from "react";
import { Cube } from "@phosphor-icons/react";

export const ProductImage = ({ src, alt, className = "" }) => {
  const [failed, setFailed] = useState(false);

  if (!src || failed) {
    return (
      <div className={`flex items-center justify-center bg-secondary ${className}`}>
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Cube size={40} weight="duotone" />
          <span className="overline-label">Sem imagem</span>
        </div>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      onError={() => setFailed(true)}
      className={className}
      loading="lazy"
    />
  );
};
