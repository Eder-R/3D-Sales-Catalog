Coloque aqui o arquivo SQLite do seu sistema de precificação (Flask/SQLAlchemy/Alembic).

- Caminho esperado (padrão): /app/backend/pricing_data/pricing.db
  (configurável via a variável de ambiente PRICING_DB_PATH)

- Para ativar a precificação pelo seu banco, defina no backend/.env:
    PRICING_SOURCE="legacy"
  e reinicie o backend.

- O conector detecta automaticamente a tabela e as colunas de Projeto e Preço.
  Caso queira forçar, use:
    PRICING_TABLE, PRICING_KEY_COLUMN, PRICING_PRICE_COLUMN
    PRICING_MATCH_FIELD (code | name), PRICING_PRICE_FORMAT (decimal | cents | text)

- Acesso é somente leitura. Produtos não encontrados usam o preço do admin como fallback.
