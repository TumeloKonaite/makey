FROM python:3.12-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

RUN apt-get update \
    && apt-get install --yes --no-install-recommends ca-certificates \
    && cat \
        /usr/share/ca-certificates/mozilla/DigiCert_Global_Root_G2.crt \
        /usr/share/ca-certificates/mozilla/Microsoft_RSA_Root_Certificate_Authority_2017.crt \
        > /etc/ssl/certs/azure-postgresql-roots.pem \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-compile -r requirements.txt \
    && addgroup --system --gid 10001 app \
    && adduser --system --uid 10001 --ingroup app --home /nonexistent --no-create-home app

COPY --chown=app:app alembic.ini ./
COPY --chown=app:app alembic ./alembic
COPY --chown=app:app app ./app
COPY --chown=app:app --chmod=755 start.sh ./start.sh

USER app

EXPOSE 8000
STOPSIGNAL SIGTERM

CMD ["./start.sh"]
