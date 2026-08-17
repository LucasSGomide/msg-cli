# 02 — Refine backend architecture template

**Depends on:** — · **Status:** done · **Estimate:** 8

## Context

Replace the use-case pattern in architecture-api.md with NestJS's `@nestjs/cqrs`
module. Today, `application/read/` and `application/write/` hold one-method-`execute`
use cases, called directly by the controller. The new pattern splits into
`application/command/` and `application/query/`: a `.command.ts`/`.query.ts`
data object paired with a `.command-handler.ts`/`.query-handler.ts`, dispatched
by the controller through `CommandBus`/`QueryBus` rather than injected directly.
`@nestjs/cqrs` is a new stack dependency, not just a rename.

The composition ban carries over unchanged: no handler triggers another handler,
whether by import or by bus — multi-command flows still need a domain service,
saga, or explicit orchestrator, agreed first. The DAO pass-through exception
(controller calls a DAO directly for a trivial read, no query needed) also
carries over unchanged.

## Key Areas:

- **Design** — architecture patterns and organization rules
- **Naming** — new suffixes for command/query/handler files, `.use-case.ts` retired

## Technical Details:

1. Rewrite the canonical request flow in architecture-api.md: command →
   `CommandBus.execute()` → command-handler → `repository.save()`; query →
   `QueryBus.execute()` → query-handler → DAO.
2. Replace "one use case per file" with command/command-handler and
   query/query-handler pairing; controller injects `CommandBus` and `QueryBus`,
   never a handler directly.
3. Reword the "never import a use case from another use case" gotcha for CQRS
   terms: no handler calls another handler, directly or through the bus.
4. Keep the DAO-pass-through exception as-is; reword "use case" to "handler"
   elsewhere in the read-path and repository/DAO sections.
5. Update stack-api.md's layout: `application/read/` + `application/write/` →
   `application/command/` + `application/query/`; `dao/` and `port/` unchanged.
6. Add `@nestjs/cqrs` to stack-api.md's "What is chosen" table: CommandBus /
   QueryBus, decoupled dispatch, future sagas/events.
7. Update stack-api.md gotcha 4's wording and rule to match the new module.
8. Update naming.md's suffix table: drop `.use-case.ts`, add `.command.ts`,
   `.command-handler.ts`, `.query.ts`, `.query-handler.ts` with class-name
   examples (`CreateCharacterCommand`, `CreateCharacterCommandHandler`, …).
9. Add `.use-case.ts` to naming.md's "Retired suffixes" table, pointing at the
   four new suffixes, with why (CQRS module adopted).
10. Update architecture-api.md's Testing table: "Use cases" row becomes
    "Command/query handlers", same tier (unit, mocks bound to DI tokens).
11. Sweep remaining "use case" references (Domain object shape section's
    example, Transactions section) for CQRS terminology.

## As built

- The suffix-example blocks and the "Class names mirror the file" bullet in
  naming.md still named `.use-case.ts`/`CreateCharacterUseCase` outside the two
  suffix tables the roadmap called out — updated to `.command.ts`/
  `.command-handler.ts` for consistency with the retired suffix.
- stack-api.md's dependency-enforcement table and testing-tooling line also said
  "use case" outside the layout and gotcha-4 spots named in the roadmap —
  reworded to "handler" so the doc doesn't contradict its own layout section.
- `docs/auth.md`'s "use case" references were left as-is — that doc is out of
  scope for this item (see roadmap item 07).

## Blockers:

- None identified
