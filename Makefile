.PHONY: build install-local

build:  ## generate the CLI build
	npm run build

install-local: build  ## build and link the CLI for local use
	npm link
