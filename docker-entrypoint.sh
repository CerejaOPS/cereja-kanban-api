#!/bin/sh
set -e

echo "🚀 Starting Node server..."
# Note: Migrations are handled automatically by lib/db.js on startup

exec node server.js
