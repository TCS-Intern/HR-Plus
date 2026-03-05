FROM python:3.11-slim

WORKDIR /app

# Copy everything (filtered by .dockerignore)
COPY . .

# Install dependencies using pip
RUN pip install --no-cache-dir .

# Expose port (Railway uses $PORT)
EXPOSE 8000

# Run the application (use shell form for variable expansion)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
