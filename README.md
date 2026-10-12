# Forja 3D — Loja Virtual de Impressão 3D (PLA)

Site de vendas/catálogo para operação de impressão 3D em PLA, com área administrativa protegida e
solicitação de orçamentos. Visual escuro, minimalista e técnico. Idioma pt-BR, preços em R$.

## Arquitetura

```
/app
├── backend/                 FastAPI + MongoDB (Motor)
│   ├── server.py            Rotas da API (prefixo /api)
│   ├── auth.py              Autenticação JWT (bcrypt) + seed do admin
│   ├── models.py            Modelos Pydantic (Product, Quote, etc.)
│   ├── storage.py           Camada de armazenamento de imagens (Emergent Object Storage)
│   ├── pricing.py           Camada de acesso a dados de preço (gateway)
│   └── .env                 Variáveis de ambiente
└── frontend/                React (CRA/Craco) + Tailwind + shadcn/ui
    └── src/
        ├── pages/           Home, Catalog, ProductPage, QuoteRequest
        ├── pages/admin/     AdminLogin, AdminLayout, AdminProducts, AdminProductForm, AdminQuotes
        ├── components/      SiteLayout, ProductCard, ProductImage
        ├── context/         AuthContext (sessão admin)
        └── lib/             api.js (axios), format.js (R$, tempos)
```

Separação clara: **frontend** (React) ⟷ **backend** (FastAPI) ⟷ **acesso a dados** (MongoDB + camadas
`storage.py` e `pricing.py`). Toda a validação de dados é feita no servidor (Pydantic + checagens de upload).

## Integração com o sistema de precificação existente

O negócio já possui um sistema em **Flask + SQLAlchemy + Alembic + SQLite** (campos Projeto, Peso, Tempo,
Preço). Para **não duplicar regras de precificação**, todos os preços exibidos passam pelo gateway em
`backend/pricing.py`:

- `PRICING_SOURCE=admin` (atual): o preço é o cadastrado na administração — fonte de verdade única.
- `PRICING_SOURCE=legacy` (**preparado, ainda não implementado**): `LegacyPricingSource` é o ponto de
  extensão para ler o Preço diretamente do banco SQLite existente (por `code`/Projeto). Hoje ele faz
  fallback para o preço do admin. Quando a integração for feita, **nenhuma rota ou tela precisa mudar** —
  basta implementar esse método e alternar o env.

> ⚠️ A integração real com o SQLite de precificação **ainda depende de implementação** (o código do
> sistema existente não foi fornecido nesta etapa).

## Instalação / Execução

Pré-requisitos: Python 3.11+, Node 18+, Yarn, MongoDB.

### Backend
```bash
cd backend
pip install -r requirements.txt
# configure backend/.env (ver abaixo)
uvicorn server:app --host 0.0.0.0 --port 8001 --reload
```

### Frontend
```bash
cd frontend
yarn install
yarn start
```

### Variáveis de ambiente (backend/.env)
| Variável | Descrição |
|---|---|
| `MONGO_URL` | String de conexão do MongoDB |
| `DB_NAME` | Nome do banco |
| `CORS_ORIGINS` | Origens permitidas (CORS) |
| `JWT_SECRET` | Segredo para assinar os tokens JWT |
| `JWT_EXPIRE_HOURS` | Validade do token (horas) |
| `ADMIN_USERNAME` / `ADMIN_PASSWORD` | Credenciais do admin (semeadas no 1º start) |
| `EMERGENT_LLM_KEY` | Chave do armazenamento de imagens |
| `PRICING_SOURCE` | `admin` (padrão) ou `legacy` (futuro) |

O frontend usa `REACT_APP_BACKEND_URL` (frontend/.env) para todas as chamadas à API.

## Segurança
- Área administrativa protegida por JWT (senha com hash bcrypt). Endpoints `/api/admin/*` exigem token.
- Validação no servidor (tipos, limites de tamanho/formato de imagem).
- Credenciais e segredos ficam apenas no `.env` (não expostos ao cliente).

## Testes
Suíte de testes de backend em `backend/tests/backend_test.py` (pytest) — cobre autenticação, CRUD de
produtos, visibilidade por status, busca/filtros/ordenação, upload/serviço de imagens e orçamentos.
```bash
cd backend && pytest tests/backend_test.py
```

## Recursos que ainda dependem de implementação
- Integração real com o banco SQLite de precificação (hoje apenas camada preparada).
- Notificação por e-mail de novos orçamentos (atualmente apenas salvos no banco e exibidos no admin).
