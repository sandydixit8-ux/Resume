# ============================================================
# ResumeIQ AI - BACKEND production image (FastAPI + uvicorn)
#
# Build (from repo root):
#   docker build -f deploy/Dockerfile -t resumeiq-backend .
# Run: docker compose -f deploy/docker-compose.yml up -d --build
# ============================================================
FROM python:3.13-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    PIP_NO_CACHE_DIR=1

WORKDIR /app

# Minimal OS libs for pdfplumber/Pillow image extraction in resumes.
RUN apt-get update \
    && apt-get install -y --no-install-recommends \
        libjpeg62-turbo \
        zlib1g \
        libgcc-s1 \
        fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*

# Python deps (layer-cached - only reruns when requirements.txt changes)
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# App code
COPY backend/app ./app
COPY backend/run.py ./run.py

# Data (SQLite db + uploaded resumes) lives on a named volume / persistent disk.
# Set DATABASE_URL=sqlite:////data/dpiic.db and UPLOAD_DIR=/data/uploads
RUN mkdir -p /data/uploads \
    && chown -R 65532:65532 /app /data

# Run as unprivileged user (uid 65532 = "nobody")
USER 65532

EXPOSE 8000
VOLUME ["/data"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/v1/health', timeout=3)"

CMD ["python", "-m", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
