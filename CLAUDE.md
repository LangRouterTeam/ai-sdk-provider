# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

LangRouter Provider for Vercel AI SDK (`@langrouter/ai-sdk-provider`) - A TypeScript provider that integrates LangRouter's API with the Vercel AI SDK, enabling access to 300+ language models through a unified interface.

## Common Commands

```bash
pnpm build              # Build with tsup (ESM + CJS outputs)
pnpm dev                # Watch mode development build
pnpm test               # Run all tests (node + edge environments)
pnpm test:node          # Run Node.js tests only
pnpm test:edge          # Run Edge runtime tests only
pnpm test:e2e           # Run E2E tests (requires LANGROUTER_API_KEY in .env.e2e)
pnpm typecheck          # TypeScript type checking
pnpm stylecheck         # Biome linting + formatting check
pnpm format             # Auto-fix formatting issues
pnpm changeset          # Create a changeset for release
```

### Running a Single Test

```bash
pnpm vitest run src/chat/index.test.ts              # Single test file (node)
pnpm vitest run src/chat/index.test.ts -t "test name"  # Specific test by name
```

## Architecture

### Source Structure

```
src/
├── provider.ts              # Factory: createLangRouter() and default langrouter instance
├── facade.ts                # Deprecated LangRouter class (legacy support)
├── chat/index.ts            # LangRouterChatLanguageModel - main chat implementation
├── completion/index.ts      # LangRouterCompletionLanguageModel - completions
├── embedding/index.ts       # LangRouterEmbeddingModel - embeddings
├── types/                   # TypeScript interfaces for settings
├── schemas/                 # Zod schemas for request/response validation
└── internal/                # Conditional export: @langrouter/ai-sdk-provider/internal
```

### Key Patterns

- **Provider Factory**: `createLangRouter(options)` returns a provider with `.chat()`, `.completion()`, and `.textEmbeddingModel()` methods
- **Message Conversion**: `convert-to-langrouter-chat-messages.ts` transforms AI SDK messages to LangRouter format (handles images, files, cache control, tool results)
- **Dual Build Output**: tsup generates both main (`dist/`) and internal (`dist/internal/`) exports

### Test Environments

Tests run in three environments via separate Vitest configs:
- **Node.js** (`vitest.node.config.ts`) - Server-side tests
- **Edge Runtime** (`vitest.edge.config.ts`) - Serverless compatibility
- **E2E** (`vitest.e2e.config.ts`) - Real API integration (uses `.env.e2e`)

Test files are co-located with source: `src/chat/index.test.ts` tests `src/chat/index.ts`.

## Code Style

- Biome for linting/formatting (2 spaces, single quotes, 80 char line width)
- Tests may use explicit any and console (configured in biome.json overrides)
- Import organization: type imports first, then regular imports, then aliases

## Dev Workflow

After completing any implementation task, automatically:

1. Commit **all** changes (including `package.json`, `pnpm-lock.yaml`)
2. Run `pnpm stylecheck && pnpm typecheck && pnpm test && pnpm build`
3. Add changeset (`pnpm changeset --empty` for non-user-facing changes)
4. Create PR on a `claude/` branch using the template in `.github/PULL_REQUEST_TEMPLATE.md`
5. Wait for CI to pass, fix any issues
6. Provide the PR link when complete

**Key principle**: Always ensure git state is clean and CI passes before considering work complete. Local tests can pass with uncommitted dependency changes - CI is the source of truth.
