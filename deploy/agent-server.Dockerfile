FROM python:3.12-slim

RUN apt-get update && apt-get install -y --no-install-recommends \
    curl ca-certificates git bash \
    && rm -rf /var/lib/apt/lists/*

# uv（国内服务器如网络不畅，可改用 pip install uv -i 阿里云 PyPI 镜像）
RUN pip install --no-cache-dir uv

WORKDIR /app
COPY pyproject.toml uv.lock ./
RUN uv sync --frozen --no-dev

COPY prototype/agent-server.config.json prototype/agent-server.config.json
RUN mkdir -p prototype/workspaces/mvp-demo prototype/.agent_tmp/conversations

EXPOSE 8000
CMD ["uv", "run", "agent-server", "--host", "0.0.0.0", "--port", "8000"]
