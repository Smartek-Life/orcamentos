# Supabase Setup

## Arquivos desta etapa

- `docs/supabase-schema.sql`
- `.env.example`
- `.env.local`

## O que cada tabela faz

### `profiles`
Guarda os dados básicos do usuário autenticado.
- Um registro por usuário do Supabase Auth
- Guarda email, nome e papel futuro (`seller`, `manager`, `admin`)

### `projects`
Guarda cada projeto salvo pelo usuário.
- Identifica de quem é o projeto
- Guarda a chave do projeto (`project_key`)
- Guarda o estado inteiro do app em `state jsonb`
- Será a base para abrir e continuar projetos na web

### `price_catalog`
É o catálogo mestre de preços.
- SKU
- nome do produto
- categoria
- custo
- markup
- preço de venda calculado automaticamente (`custo x markup`)
- metadados extras

### `project_items`
Guarda os itens comerciais de cada projeto.
- produto
- quantidade
- preço unitário
- preço total
- origem do item

### `reports`
Guarda o histórico das exportações e versões de orçamento.
- vinculado a um projeto
- payload livre em JSON

## Segurança (RLS)

As tabelas públicas usam RLS.
- cada usuário só enxerga os próprios `projects`, `project_items` e `reports`
- `price_catalog` é legível para usuário autenticado
- edição do catálogo fica reservada para `manager` e `admin`

## Como aplicar no Supabase

1. Abra o projeto no Supabase.
2. Vá em `SQL Editor`.
3. Cole todo o conteúdo de `docs/supabase-schema.sql`.
4. Execute.

## Se você já criou a tabela antes desta mudança

Rode também:

- `docs/supabase-price-catalog-markup-migration.sql`

Esse script:
- adiciona `markup`
- recalcula os registros existentes
- transforma `sale_price` em coluna calculada

## Observação importante

O frontend usa apenas:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Nunca coloque a senha do Postgres no frontend.
