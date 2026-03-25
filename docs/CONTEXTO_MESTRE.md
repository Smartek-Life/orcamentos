# CONTEXTO MESTRE DO PROJETO

Ultima atualizacao: 2026-03-24

## 1) Objetivo do produto

Sistema de orcamentos tecnicos para vendas, com fluxo:

1. Upload de planta em PDF.
2. Selecao de pavimentos validos.
3. Calibracao por area real (perimetro + m2 informado pelo vendedor).
4. Execucao por modulo (Wi-Fi, Cameras, Sonorizacao), com opcao de pular pavimento por modulo.
5. Geracao de orcamento com base no catalogo de precos.
6. Exportacao de PDF completo (orcamento + croquis).

Meta final: operacao 100% web (sem depender de desktop local), com Supabase + Cloudflare Pages.

## 2) Status atual (resumo executivo)

- Aplicacao web funcional em paralelo ao legado desktop.
- Login web com Supabase Auth ativo.
- Persistencia em Supabase ativa.
- Biblioteca web de projetos ativa.
- Modulos ativos:
  - Wi-Fi (heatmap dinamico + APs).
  - Cameras (com tipo de camera selecionavel por SKU alvo).
  - Sonorizacao (sistemas, zonas, caixas, subwoofer, TVs de extracao).
- Orcamento comercial editavel ativo.
- Exportacao de PDF completo ativa (orcamento antes das plantas).

## 3) Arquitetura atual

- Frontend: React + Vite + TypeScript.
- Backend gerenciado: Supabase (Auth + Postgres).
- Deploy alvo: Cloudflare Pages.
- Legado ainda existente: Electron/desktopApi (nao removido ainda por estrategia de transicao segura).

## 4) Regras de negocio ja consolidadas

- A area hachurada e apenas para calibracao: nao deve aparecer nos modulos nem no PDF final.
- Em modulo, prancha pode ser `salva` ou `pulada`.
- Modulo so fecha quando todas as plantas daquele modulo estiverem salvas ou puladas.
- Projeto web deve salvar na biblioteca apenas via botao manual `Salvar projeto na biblioteca`.
- PDF completo deve incluir orcamento antes dos croquis.
- Biblioteca deve permitir excluir projeto e abrir relatorio salvo em nova aba, sem interromper edicao atual.

## 5) CFTV (tipos de camera)

Tipos exigidos no modulo de cameras:

- `1220d` = cabeada interna
- `1220b` = cabeada externa
- `im5` = wifi externa
- `imx` = wifi interna

Esses tipos alimentam a composicao do orcamento de cameras.

## 6) SKU e catalogo de precos

Fonte: tabela `price_catalog` no Supabase.

Modelo de preco:

- `preco de custo * markup = preco de venda`

Campos relevantes no catalogo:

- `sku`
- `product_name`
- `cost`
- `markup`
- `sale_price`
- `active`

Mapeamento atual:

- Wi-Fi: busca principal por "Access Point UniFi U6+" e similares.
- Cameras: prioriza SKU exato por tipo (`1220d`, `1220b`, `im5`, `imx`), com fallback por nome/hints.
- Sonorizacao: amplificador + modelos de caixas/sub por sistema.

## 7) Estrutura de dados Supabase (macro)

Tabelas principais:

- `profiles`
- `projects` (estado completo do projeto em `state` JSONB)
- `price_catalog`
- `project_items`
- `reports`

Seguranca:

- RLS habilitado para isolamento por usuario.

## 8) Fluxo de uso esperado (vendedor)

1. Faz login.
2. Sobe PDF.
3. Escolhe plantas.
4. Configura nome + area por planta.
5. Executa modulo por modulo.
6. Salva projeto na biblioteca.
7. Visualiza orcamento.
8. Exporta PDF completo para cliente.

## 9) Arquivos-chave do codigo

- App principal: `client/src/App.tsx`
- Shell web/autenticacao: `client/src/components/AppShell.tsx`
- Biblioteca web: `client/src/components/ProjectLibraryPanel.tsx`
- Persistencia de projeto: `client/src/lib/projectStorage.ts`
- Resumo comercial: `client/src/lib/budgetSummary.ts`
- Geracao de relatorio/PDF HTML: `client/src/lib/reporting.ts`
- Wi-Fi overlay/render: `client/src/lib/canvas/renderers.ts`
- RF/heatmap: `client/src/lib/rf/coverageEngine.ts`
- Deteccao de paredes: `client/src/lib/walls/detection.ts`
- Cameras: `client/src/components/CameraPlannerPanel.tsx`
- Sonorizacao: `client/src/components/AudioPlannerPanel.tsx`
- Tipos centrais: `client/src/types/index.ts`
- Schema SQL: `docs/supabase-schema.sql`
- Setup Supabase: `docs/SUPABASE_SETUP.md`

## 10) Como rodar localmente

No diretorio raiz do projeto:

```bash
npm install
npm run dev
```

Abrir:

- http://localhost:5173

Build de validacao:

```bash
npm run typecheck
npm run build
```

## 11) Variaveis de ambiente web

Arquivo `.env` (nao versionar segredos):

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

## 12) Pendencias principais (proxima fase)

- Finalizar migracao web-only:
  - validar 100% do fluxo em producao web.
  - remover Electron/desktopApi apenas no fechamento da migracao.
- Adicionar regras de negocio avancadas de orcamento:
  - switch PoE por quantidade de APs.
  - gateway cloud.
  - estimativa de cabos e mao de obra.
  - regras adicionais ensinadas pelo time comercial/tecnico.
- Melhorias de performance de bundle (code-splitting dos chunks grandes).

## 13) Convencao para continuidade (importante)

Antes de qualquer mudanca grande:

1. Atualizar este arquivo com decisao/impacto.
2. Fazer alteracoes em lotes pequenos.
3. Rodar `typecheck + build`.
4. Validar fluxo principal com teste manual rapido.

