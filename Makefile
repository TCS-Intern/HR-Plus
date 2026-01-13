.PHONY: install install-backend install-frontend dev dev-backend dev-frontend test test-backend test-frontend lint lint-backend lint-frontend format format-backend format-frontend db-push db-types db-start db-stop clean

# =============================================================================
# Installation
# =============================================================================

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install backend dependencies
	cd backend && uv sync

install-frontend: ## Install frontend dependencies
	cd frontend && npm install

# =============================================================================
# Development
# =============================================================================

dev: ## Run both backend and frontend dev servers
	@make -j2 dev-backend dev-frontend

dev-backend: ## Run backend dev server
	cd backend && uv run uvicorn app.main:app --reload --port 8000

dev-frontend: ## Run frontend dev server
	cd frontend && npm run dev

# =============================================================================
# Testing
# =============================================================================

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	cd backend && uv run pytest

test-frontend: ## Run frontend tests
	cd frontend && npm test

test-backend-cov: ## Run backend tests with coverage
	cd backend && uv run pytest --cov=app --cov-report=html

# =============================================================================
# Linting
# =============================================================================

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Run backend linters
	cd backend && uv run ruff check .
	cd backend && uv run mypy app

lint-frontend: ## Run frontend linter
	cd frontend && npm run lint

# =============================================================================
# Formatting
# =============================================================================

format: format-backend format-frontend ## Format all code

format-backend: ## Format backend code
	cd backend && uv run ruff format .
	cd backend && uv run ruff check --fix .

format-frontend: ## Format frontend code
	cd frontend && npm run format

# =============================================================================
# Database (Supabase)
# =============================================================================

db-start: ## Start local Supabase
	supabase start

db-stop: ## Stop local Supabase
	supabase stop

db-push: ## Push database migrations
	supabase db push

db-reset: ## Reset database (destructive)
	supabase db reset

db-types: ## Generate TypeScript types from schema
	supabase gen types typescript --local > frontend/types/supabase.ts

db-migrate: ## Create a new migration
	@read -p "Migration name: " name; \
	supabase migration new $$name

# =============================================================================
# Docker
# =============================================================================

docker-build: ## Build Docker images
	docker-compose build

docker-up: ## Start Docker containers
	docker-compose up -d

docker-down: ## Stop Docker containers
	docker-compose down

docker-logs: ## View Docker logs
	docker-compose logs -f

# =============================================================================
# Utilities
# =============================================================================

clean: ## Clean build artifacts
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".mypy_cache" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name "node_modules" -exec rm -rf {} + 2>/dev/null || true
	find . -type d -name ".next" -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.venv 2>/dev/null || true

help: ## Show this help
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

.DEFAULT_GOAL := help
