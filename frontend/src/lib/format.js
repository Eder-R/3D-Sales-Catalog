export const formatBRL = (cents) => {
  if (cents === null || cents === undefined) return "Sob consulta";
  return (cents / 100).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
};

export const parseBRLToCents = (value) => {
  if (value === "" || value === null || value === undefined) return null;
  const normalized = String(value).replace(/\./g, "").replace(",", ".").replace(/[^\d.]/g, "");
  const num = parseFloat(normalized);
  if (isNaN(num)) return null;
  return Math.round(num * 100);
};

export const formatPrintTime = (minutes) => {
  if (minutes === null || minutes === undefined) return "—";
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h && m) return `${h}h ${m}min`;
  if (h) return `${h}h`;
  return `${m}min`;
};

export const STATUS_LABELS = {
  draft: "Rascunho",
  published: "Publicado",
  archived: "Arquivado",
};

export const QUOTE_STATUS_LABELS = {
  new: "Novo",
  in_review: "Em análise",
  answered: "Respondido",
  archived: "Arquivado",
};
