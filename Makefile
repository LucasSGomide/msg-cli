.PHONY: build install-local

build:  ## generate the CLI build
	npm run build

install-local: build  ## build and link the CLI for local use
	npm link

# --- msg-roadmap:start
.PHONY: roadmap-sync roadmap-check

roadmap-sync:  ## recompute every derived status and table under docs/
	node scripts/roadmap-sync.mjs

roadmap-check:  ## fail on a stale table, a bad dependency, or a missing project.yml path
	node scripts/roadmap-sync.mjs --check
# --- msg-roadmap:end
