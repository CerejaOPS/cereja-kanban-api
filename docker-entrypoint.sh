#!/bin/sh
set -e

# Run seed if DB doesn't exist yet
if [ ! -f /app/data/kanban.db ]; then
  echo "🌱 Banco de dados não encontrado. Executando seed inicial..."
  node seed.js
  echo "✅ Seed concluído."
fi

exec node server.js
