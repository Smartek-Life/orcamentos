# Refactor Checklist v2

## Historico concluido

### Fase A - Estabilizacao Estrutural

- [x] Extrair geracao de relatorio de `App.tsx`
- [x] Extrair estado-base de planta para modulo proprio
- [x] Extrair persistencia para hook dedicado
- [x] Extrair workflow principal para hook dedicado

### Fase B - Desmontar PlantCanvas

- [x] Extrair geometria de perimetro para `geometry/perimeter.ts`
- [x] Extrair deteccao de paredes para `walls/detection.ts`
- [x] Extrair metricas e cobertura para `rf/coverageEngine.ts`
- [x] Extrair funcoes de desenho para `canvas/renderers.ts`
- [x] Deixar `PlantCanvas.tsx` majoritariamente como componente React + eventos

## Fase C - Persistencia Correta

Prioridade: critica

- [x] Parar de salvar `croquiDataUrl` em `localStorage` no app desktop
- [x] Criar armazenamento de projeto em arquivo local via Electron
- [x] Criar IPC para salvar projeto
- [x] Criar IPC para abrir projeto
- [x] Migrar projeto principal de `localStorage` para arquivo
- [x] Deixar `localStorage` apenas como fallback leve fora do desktop
- [x] Substituir `catch {}` silencioso por erro visivel ao usuario
- [x] Revisar exportacao PDF para evitar risco com `encodeURIComponent`

## Fase D - Modelo de Estado

Prioridade: alta

- [x] Unificar `moduleState` e `savedBoards`
- [x] Definir fonte unica de verdade por `planta x modulo`
- [x] Modelar estados como `idle | editing | saved | skipped`
- [x] Derivar badges, botoes e permissoes da mesma fonte
- [x] Reduzir acoplamento do `useProjectWorkflow` com setters externos

## Fase E - Limpeza de Arquitetura

Prioridade: media

- [x] Decidir se o servidor Express continua ou sai
- [x] Remover `@anthropic-ai/sdk` se realmente nao houver mais uso
- [x] Revisar `.env` no empacotamento desktop
- [x] Revisar `build.files` do `electron-builder`
- [x] Revisar `sandbox: false` da janela auxiliar de exportacao
- [ ] Revisar modulo `audio` exposto sem implementacao real

## Fase F - App Final

Prioridade: media

- [ ] Mover `getPolygonArea` para `lib/geometry`
- [ ] Mover `SummaryRow` para `components`
- [ ] Mover `CollapsedStep` para `components`
- [ ] Reduzir handlers inline restantes em `App.tsx`
- [ ] Revisar `window.alert` e trocar por feedback padronizado

## Fase G - Qualidade

Prioridade: media

- [ ] Testes unitarios para area e poligono
- [ ] Testes unitarios para escala `sqrt(area real / area desenhada)`
- [ ] Testes unitarios para cobertura
- [ ] Testes unitarios para parede/perimetro
- [ ] Adaptar partes do `planner.ts` para teste sem DOM

## Ordem recomendada

1. Fase C - persistencia correta
2. Fase D - unificar estado do modulo
3. Fase E - limpar deps e Electron
4. Fase F - fechar `App.tsx`
5. Fase G - testes
