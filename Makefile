# Health Ready — common tasks. Run `make` (or `make help`) for the list.
#
# First-time production setup (run in order):
#   make login              # authenticate with Cloudflare (opens a browser)
#   make db-create          # create the D1 database, then paste the printed
#                           #   database_id into apps/api/wrangler.toml
#                           #   (keep the binding as "DB")
#   make db-migrate         # apply the schema to the remote database
#   make secret-bootstrap   # set BOOTSTRAP_SECRET (choose a strong value)
#   make deploy             # build the web app + deploy the Worker (API + SPA)
#   make bootstrap-admin EMAIL=you@example.com PASSWORD=yourpass8 NAME="Tú" SECRET=the-secret-you-set
#
# Everyday:
#   make deploy             # build + deploy
#   make migrate-generate   # create a migration after changing the Drizzle schema
#   make db-migrate         # apply it to production
#   make dev                # run the full app locally on http://localhost:8787

API_DIR := apps/api
DB_NAME := health-ready
APP_URL := https://health-ready-api.jhosedo.workers.dev

WEB_FILTER := --filter @health-ready/web
API_FILTER := --filter @health-ready/api

# Default role for `make add-user` (override with ROLE=admin)
ROLE ?= user

.DEFAULT_GOAL := help

.PHONY: help install typecheck test build dev dev-web login whoami \
        db-create migrate-generate db-migrate-local db-migrate \
        secret-bootstrap deploy logs bootstrap-admin add-user

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN{FS=":.*?## "}{printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'

## ---- Setup & quality --------------------------------------------------------

install: ## Install all workspace dependencies
	pnpm install

typecheck: ## Typecheck every package
	pnpm -r typecheck

test: ## Run all test suites (API + web)
	pnpm -r test

build: ## Build the web app (required before deploy)
	pnpm $(WEB_FILTER) build

## ---- Local development ------------------------------------------------------

dev: ## Run the full app (API + built SPA) locally on http://localhost:8787
	cd $(API_DIR) && npx wrangler dev

dev-web: ## Run the web app with hot reload on http://localhost:5173 (run `make dev` too)
	pnpm $(WEB_FILTER) dev

## ---- Cloudflare auth --------------------------------------------------------

login: ## Log in to Cloudflare (opens a browser)
	cd $(API_DIR) && npx wrangler login

whoami: ## Show the logged-in Cloudflare account
	cd $(API_DIR) && npx wrangler whoami

## ---- Database (D1) ----------------------------------------------------------

db-create: ## FIRST TIME ONLY: create the remote D1 database (then paste its id into apps/api/wrangler.toml)
	cd $(API_DIR) && npx wrangler d1 create $(DB_NAME)

migrate-generate: ## Generate a new SQL migration from Drizzle schema changes
	pnpm $(API_FILTER) db:generate

db-migrate-local: ## Apply migrations to the local dev database
	cd $(API_DIR) && npx wrangler d1 migrations apply $(DB_NAME) --local

db-migrate: ## Apply migrations to the remote (production) database
	cd $(API_DIR) && npx wrangler d1 migrations apply $(DB_NAME) --remote

## ---- Secrets & deploy -------------------------------------------------------

secret-bootstrap: ## Set the production BOOTSTRAP_SECRET (interactive prompt)
	cd $(API_DIR) && npx wrangler secret put BOOTSTRAP_SECRET

deploy: build ## Build the web app, then deploy the Worker (serves API + SPA)
	cd $(API_DIR) && npx wrangler deploy

logs: ## Tail live production logs
	cd $(API_DIR) && npx wrangler tail

## ---- One-off helpers --------------------------------------------------------

bootstrap-admin: ## Create the first prod admin. Usage: make bootstrap-admin EMAIL=.. PASSWORD=.. NAME=".." SECRET=..
	curl -i $(APP_URL)/api/auth/bootstrap-admin \
		-H 'content-type: application/json' \
		-d '{"secret":"$(SECRET)","email":"$(EMAIL)","password":"$(PASSWORD)","displayName":"$(NAME)"}'

add-user: ## Add a user (logs in as an admin first). Usage: make add-user ADMIN_EMAIL=.. ADMIN_PASSWORD=.. EMAIL=.. PASSWORD=.. NAME=".." [ROLE=admin]
	@jar=$$(mktemp); \
	code=$$(curl -s -o /dev/null -w '%{http_code}' -c $$jar -X POST $(APP_URL)/api/auth/login \
		-H 'content-type: application/json' \
		-d '{"email":"$(ADMIN_EMAIL)","password":"$(ADMIN_PASSWORD)"}'); \
	if [ "$$code" != "200" ]; then \
		echo "✗ admin login failed (HTTP $$code) — check ADMIN_EMAIL / ADMIN_PASSWORD"; rm -f $$jar; exit 1; \
	fi; \
	echo "→ creating $(ROLE) '$(EMAIL)'"; \
	curl -i -b $$jar -X POST $(APP_URL)/api/users \
		-H 'content-type: application/json' \
		-d '{"email":"$(EMAIL)","password":"$(PASSWORD)","displayName":"$(NAME)","role":"$(ROLE)"}'; \
	rm -f $$jar
