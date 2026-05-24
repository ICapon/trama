#!/usr/bin/env bash

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"

echo "🚀 Levantando infraestructura de Trama..."
echo "📁 Project root: $PROJECT_ROOT"

if ! command -v docker >/dev/null 2>&1; then
  echo "❌ Docker no está instalado o no está disponible en PATH."
  exit 1
fi

if ! docker compose version >/dev/null 2>&1; then
  echo "❌ Docker Compose no está disponible."
  exit 1
fi

cd "$PROJECT_ROOT"

docker compose up -d

echo ""
echo "✅ Infraestructura levantada."
echo ""
echo "PostgreSQL:"
echo "  localhost:5432"
echo ""
echo "Neo4j Browser:"
echo "  http://localhost:7474"
echo ""
echo "Neo4j Bolt:"
echo "  bolt://localhost:7687"
echo ""