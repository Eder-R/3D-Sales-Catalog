# PRD — Forja 3D (Loja Virtual de Impressão 3D)

## Problema original
Site de vendas/catálogo para pequena operação de impressão 3D em PLA. Visual moderno, minimalista,
tecnológico, tema escuro (grafite/preto), pt-BR, preços em R$. Páginas: inicial, catálogo (busca por
nome/código, filtros por categoria, ordenação), página de produto (imagens, código, descrição, preço,
material, peso, dimensões, variantes), solicitação de orçamento (descrição, quantidade, imagem opcional).
Área administrativa protegida para cadastrar/editar/arquivar/publicar produtos. Integração futura com
sistema existente de precificação (Flask/SQLAlchemy/Alembic/SQLite — campos Projeto, Peso, Tempo, Preço),
sem duplicar regras. Sem pagamentos/frete/checkout/redes sociais nesta etapa.

## Arquitetura
- Frontend: React (Craco) + Tailwind + shadcn/ui + @phosphor-icons. Rotas públicas e /admin/*.
- Backend: FastAPI + MongoDB (Motor), rotas com prefixo /api.
- Acesso a dados: MongoDB + camada `pricing.py` (gateway de preço) + `storage.py` (imagens em Object Storage).
- Auth: JWT custom (bcrypt), admin único semeado via env.

## Personas
- Cliente visitante: navega catálogo, vê produtos, solicita orçamento.
- Administrador: gerencia catálogo (CRUD, publicar/arquivar) e visualiza orçamentos.

## Requisitos centrais (estáticos)
1. Catálogo funcional com busca/filtro/ordenação. ✔
2. Páginas individuais de produto com especificações. ✔
3. Cadastro e gestão administrativa protegida. ✔
4. Persistência de dados (MongoDB). ✔
5. Formulário de orçamento (com upload opcional). ✔
6. Testes e documentação de instalação. ✔
7. Preço vindo de fonte confiável via gateway, preparado para integração futura. ✔

## Implementado (2026-06)
- Backend: auth JWT (/api/auth/login, /me), produtos público (list/search/filter/sort, categorias, detalhe),
  produtos admin (CRUD + status), orçamentos (create público, list/status admin), upload admin + upload
  orçamento + serviço de arquivos.
- Integração de precificação ATIVA (PRICING_SOURCE=legacy, arquivo custos_3D.db): preço (projetos.preco_venda),
  tempo (projetos.tempo_impressao_minutos) e peso (SUM projeto_materiais.peso_usado_g) vêm do sistema,
  casando pelo NOME do produto com projetos.nome; fallback para valores manuais quando não há correspondência.
  Admin exibe badge de fonte do preço: "Sistema" (legacy) ou "Manual" (admin).
  Projetos disponíveis no banco: "Porta Vassouras", "Suporte Celular", "Grampo de Embalagem".
- Importação de projetos: GET /api/admin/pricing/projects + POST /api/admin/pricing/import (idempotente via pricing_ref)
  criam produtos rascunho a partir dos projetos do sistema, já com preço/peso/tempo. Botão "Importar do sistema" no admin.
- Vínculo explícito (casar por código): campo pricing_ref no produto (Select no formulário); prioridade de match pricing_ref > name > code.
- Detalhe de custo: quebra (material, mão de obra, impressora, custo total, margem, preço de venda) calculada de
  materiais/configuracoes/projeto_materiais e exibida no formulário admin.
- Frontend: Home (hero + destaques), Catálogo (busca/filtros/ordenação), Página de produto (galeria +
  specs + variantes), Orçamento (form + upload referência), Admin (login, lista de produtos com
  publicar/despublicar/arquivar/excluir, formulário completo, lista de orçamentos com mudança de status).
- Testes: 26/26 backend (pytest) + fluxo e2e frontend — 100%.
- Docs de instalação em README.md.

## Backlog priorizado
### P1
- Integração real com o SQLite de precificação (implementar `LegacyPricingSource`).
- Notificação por e-mail ao receber novo orçamento (ex.: Resend).
### P2
- Endpoint GET /api/admin/products/{id} dedicado (hoje o form busca a lista completa).
- Cache-Control nas imagens servidas em /api/files.
- Proteção anti-abuso no upload público de orçamento (rate limit/captcha).
- Paginação do catálogo quando o volume crescer.

## Recursos que dependem de implementação (não concluídos)
- Integração com sistema de precificação existente (apenas camada preparada).
- Envio de e-mail de orçamentos (apenas persistido + exibido no admin).

## Credenciais de teste
admin / Impressao3D@2026 (ver /app/memory/test_credentials.md).
