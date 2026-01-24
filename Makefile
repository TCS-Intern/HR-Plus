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
# Restart Services
# =============================================================================

restart: ## Restart both backend and frontend servers
	@echo "🔄 Restarting all services..."
	@echo ""
	@echo "1️⃣  Stopping services..."
	@echo "   • Killing port 8000 (backend)..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "   ✓ Port 8000 already free"
	@echo "   • Killing port 3000 (frontend)..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "   ✓ Port 3000 already free"
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@sleep 2
	@echo ""
	@echo "2️⃣  Starting backend..."
	@cd backend && uv run uvicorn app.main:app --reload --port 8000 > /dev/null 2>&1 &
	@sleep 3
	@echo "   ✅ Backend started on http://localhost:8000"
	@echo ""
	@echo "3️⃣  Starting frontend..."
	@cd frontend && npm run dev > /dev/null 2>&1 &
	@sleep 3
	@echo "   ✅ Frontend started on http://localhost:3000"
	@echo ""
	@echo "✨ All services restarted successfully!"
	@echo "   Backend:  http://localhost:8000"
	@echo "   Frontend: http://localhost:3000"
	@echo "   API Docs: http://localhost:8000/docs"

restart-backend: ## Restart backend server only
	@echo "🔄 Restarting backend..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || echo "Port 8000 already free"
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@sleep 2
	@cd backend && uv run uvicorn app.main:app --reload --port 8000 > /dev/null 2>&1 &
	@sleep 3
	@echo "✅ Backend restarted on http://localhost:8000"

restart-frontend: ## Restart frontend server only
	@echo "🔄 Restarting frontend..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || echo "Port 3000 already free"
	@pkill -f "next dev" 2>/dev/null || true
	@sleep 2
	@cd frontend && npm run dev > /dev/null 2>&1 &
	@sleep 3
	@echo "✅ Frontend restarted on http://localhost:3000"

stop-backend: ## Stop backend server
	@echo "Stopping backend..."
	@lsof -ti:8000 | xargs kill -9 2>/dev/null || true
	@pkill -f "uvicorn app.main:app" 2>/dev/null || true
	@echo "✅ Backend stopped"

stop-frontend: ## Stop frontend server
	@echo "Stopping frontend..."
	@lsof -ti:3000 | xargs kill -9 2>/dev/null || true
	@pkill -f "next dev" 2>/dev/null || true
	@echo "✅ Frontend stopped"

stop: stop-backend stop-frontend ## Stop all services

status: ## Check status of all services
	@echo "📊 Service Status:"
	@echo ""
	@echo "Backend (port 8000):"
	@lsof -ti:8000 > /dev/null 2>&1 && echo "  ✅ Running (PID: $$(lsof -ti:8000))" || echo "  ❌ Not running"
	@echo ""
	@echo "Frontend (port 3000):"
	@lsof -ti:3000 > /dev/null 2>&1 && echo "  ✅ Running (PID: $$(lsof -ti:3000))" || echo "  ❌ Not running"
	@echo ""
	@echo "URLs:"
	@lsof -ti:8000 > /dev/null 2>&1 && echo "  • Backend:  http://localhost:8000" || true
	@lsof -ti:8000 > /dev/null 2>&1 && echo "  • API Docs: http://localhost:8000/docs" || true
	@lsof -ti:3000 > /dev/null 2>&1 && echo "  • Frontend: http://localhost:3000" || true

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
