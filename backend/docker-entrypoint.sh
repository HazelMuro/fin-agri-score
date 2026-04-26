#!/bin/sh
set -e
npx --yes prisma@5.22.0 migrate deploy
exec node src/server.js
