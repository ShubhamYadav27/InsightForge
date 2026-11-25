#!/bin/sh
set -e

DB_HOST="${DB_HOST:-db}"
DB_PORT="${DB_PORT:-5432}"

echo "Waiting for PostgreSQL at ${DB_HOST}:${DB_PORT}..."
python -c "
import os, socket, time, sys
host = os.getenv('DB_HOST', 'db')
port = int(os.getenv('DB_PORT', '5432'))
for attempt in range(30):
    try:
        with socket.create_connection((host, port), timeout=2):
            sys.exit(0)
    except OSError:
        time.sleep(1)
print(f'Timed out waiting for PostgreSQL at {host}:{port}', file=sys.stderr)
sys.exit(1)
"
echo "PostgreSQL is reachable."

python manage.py makemigrations --check --dry-run
python manage.py migrate --noinput

exec python manage.py runserver 0.0.0.0:8000
