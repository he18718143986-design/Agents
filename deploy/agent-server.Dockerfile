# 大陆服务器 Docker Hub 直连受限时，用镜像站替换基础镜像，例如：
#   docker compose build --build-arg PY_BASE=docker.m.daocloud.io/library/python:3.12-slim
ARG PY_BASE=python:3.12-slim
FROM ${PY_BASE}

# PyPI 用阿里云镜像，避免境外源超时
ARG PIP_INDEX=https://mirrors.aliyun.com/pypi/simple/
ENV UV_DEFAULT_INDEX=${PIP_INDEX}

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git bash \
    && rm -rf /var/lib/apt/lists/*

RUN pip install --no-cache-dir -i ${PIP_INDEX} uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY prototype/agent-server.config.json prototype/agent-server.config.json
RUN mkdir -p prototype/workspaces/mvp-demo prototype/.agent_tmp/conversations

EXPOSE 8000
CMD ["uv", "run", "agent-server", "--host", "0.0.0.0", "--port", "8000"]
