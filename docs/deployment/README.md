# Deployment Docs

## Local (Termux)

```bash
bash scripts/termux_setup.sh
bash scripts/termux_start.sh
# http://127.0.0.1:8000/docs
```

## Server (Docker)

```bash
cp .env.example .env
# Edit .env
docker compose up -d --build
```

## Nginx

`nginx/arep.conf` — reverse proxy برای Frontend + Backend

TODO:
- termux.md — راهنمای کامل Termux
- server.md — راهنمای کامل Server
- backup.md — استراتژی Backup
