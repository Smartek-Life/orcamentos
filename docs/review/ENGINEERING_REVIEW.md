# Engineering Review

## Scope

Project reviewed:

- `client/`
- `server/`
- `electron/`
- `package.json`

Review focus:

- architecture
- maintainability
- persistence strategy
- packaging / desktop behavior
- module workflow integrity

## Executive Summary

The project is functional and already delivers a real MVP, but it is still structured like an accelerated product prototype rather than a production-grade desktop application.

The biggest engineering risks today are:

1. excessive responsibility concentrated in `App.tsx`
2. high-complexity rendering and RF logic concentrated in `PlantCanvas.tsx`
3. persistence based on `localStorage` for large project payloads and croqui images
4. partial backend / dependency leftovers from the old Anthropic architecture

These are all solvable without rewriting the product from zero.

## Findings

### 1. `App.tsx` is acting as workflow engine, state store, module coordinator, persistence orchestrator and export layer at once

File:

- `client/src/App.tsx`

Why this matters:

- the file has become the orchestration point for almost every concern in the product
- feature velocity will slow down because any new module touches the same central component
- regression risk rises quickly when Wi-Fi, CFTV and future audio evolve independently

Recommended direction:

- move project workflow state into a dedicated `useProjectWorkflow` hook or state machine
- move plan mutation handlers into a `useProjectPlans` hook
- move report export into a `reporting` service
- keep `App.tsx` as composition only

### 2. `PlantCanvas.tsx` mixes UI, geometry, wall detection, signal model, dynamic metrics and drawing pipeline in one file

File:

- `client/src/components/PlantCanvas.tsx`

Why this matters:

- the file is currently both a UI component and the domain engine for coverage behavior
- it is difficult to test independently
- changes in RF logic can accidentally break rendering, and vice versa

Recommended direction:

- split into:
  - `canvas/renderers/*`
  - `rf/coverageEngine.ts`
  - `geometry/perimeter.ts`
  - `walls/detection.ts`
- keep React component code thin and use pure functions for domain logic

### 3. Persisting full project state into `localStorage` is fragile and will eventually fail with real customer projects

Files:

- `client/src/lib/projectStorage.ts`
- `client/src/App.tsx`

Why this matters:

- saved boards contain full image data URLs
- `localStorage` quota is small
- current implementation silently ignores write failures
- this can lead to data loss without user feedback

Recommended direction:

- migrate persistence to filesystem-backed project files in Electron
- keep only lightweight UI session state in `localStorage`
- if persistence fails, surface a visible error instead of swallowing it

### 4. The server and dependencies still carry legacy remote-analysis shape, but the product is now local-first

Files:

- `server/routes/analyze.ts`
- `package.json`

Why this matters:

- `/api/analyze` now only returns `410`
- `@anthropic-ai/sdk` is still installed
- the app still ships a server process for functionality that no longer seems central to the current roadmap

Recommended direction:

- choose one of two paths explicitly:
  - keep the server as future integration infrastructure and document that
  - or remove the dead route and unused dependency now

### 5. Module completion state and saved board state are close, but still conceptually duplicated

Files:

- `client/src/App.tsx`
- `client/src/types/index.ts`

Why this matters:

- a module can be “done” because of state flags
- a board can also be “saved” because of stored artifacts
- these concepts are related but modeled separately

Recommended direction:

- define a single source of truth for module progress per plan:
  - `idle`
  - `editing`
  - `saved`
  - `skipped`
- derive UI state from saved board existence + explicit workflow state

### 6. Desktop export is now correct functionally, but reporting is still string-built HTML inside the main app component

Files:

- `client/src/App.tsx`
- `electron/main.mjs`

Why this matters:

- report layout and report data mapping are embedded in UI orchestration
- future additions like cover page, client data, totals and per-module summaries will become hard to maintain

Recommended direction:

- create `client/src/lib/reporting/buildProjectReportHtml.ts`
- later evolve to `buildProjectReportModel.ts` + renderer

## Good Decisions Already Present

These are worth preserving:

- local analysis instead of cloud dependency for the current use case
- per-module workflow with explicit `Trabalhar / Salvar / Pular`
- desktop PDF generation in Electron instead of relying on browser print flow
- fixed reports directory on desktop
- project preparation before module execution

## Recommended Refactor Roadmap

### Phase 1 - Stabilization

- extract persistence service from `App.tsx`
- extract report builder from `App.tsx`
- remove dead Anthropic dependency and legacy route if no longer needed
- add visible persistence/export error handling

### Phase 2 - Domain Separation

- split `PlantCanvas.tsx` into rendering vs. domain logic
- create `wifi`, `cctv`, `project-base` service folders
- move wall/perimeter/coverage logic into pure modules

### Phase 3 - Product-Grade Project Model

- save projects as files on disk
- introduce project metadata:
  - client
  - project name
  - address
  - createdAt / updatedAt
- introduce versioned project schema for migrations

### Phase 4 - Quality

- add unit tests for:
  - polygon area
  - scale derivation
  - wall detection helpers
  - coverage calculations
- add integration tests for:
  - module workflow
  - report export

## Suggested Folder Target

```text
client/src/
  app/
    App.tsx
    routes/
    state/
  modules/
    wifi/
      components/
      services/
      model/
    cctv/
      components/
      services/
      model/
    audio/
      components/
      services/
      model/
  core/
    project/
    persistence/
    reporting/
    geometry/
    canvas/
    pdf/
  shared/
    ui/
    types/
    utils/
```

## Final Assessment

The product is already valuable and demonstrable. The current codebase does not need a rewrite, but it does need a structured refactor before continuing to scale features such as audio, cameras, automatic planning improvements and AI-assisted learning.

The highest-leverage next move is:

1. extract project workflow and persistence from `App.tsx`
2. extract RF / geometry logic from `PlantCanvas.tsx`
3. move project storage from `localStorage` to filesystem-backed project files
