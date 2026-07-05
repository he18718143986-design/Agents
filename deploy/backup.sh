#!/usr/bin/env bash
# Stagent 数据备份：workspaces（生成应用 + 各应用 PocketBase 数据库）。
# 用法：
#   直接部署：  bash deploy/backup.sh /backup
#   Docker 部署：bash deploy/backup.sh /backup stagent_workspaces
# 建议 crontab：0 3 * * * bash /path/to/stagent/deploy/backup.sh /backup [卷名]
set -euo pipefail

BACKUP_DIR="${1:?用法: backup.sh <备份目录> [docker卷名]}"
VOLUME_NAME="${2:-}"
KEEP_DAYS="${KEEP_DAYS:-14}"
STAMP="$(date +%F-%H%M)"

mkdir -p "$BACKUP_DIR"

if [[ -n "$VOLUME_NAME" ]]; then
  # Docker 卷模式
  docker run --rm -v "$VOLUME_NAME":/data:ro -v "$BACKUP_DIR":/backup alpine \
    tar czf "/backup/stagent-workspaces-$STAMP.tar.gz" -C /data .
else
  # 直接部署模式：备份仓库内 workspaces 目录
  REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
  SRC="$REPO_ROOT/prototype/workspaces"
  [[ -d "$SRC" ]] || { echo "未找到 $SRC"; exit 1; }
  tar czf "$BACKUP_DIR/stagent-workspaces-$STAMP.tar.gz" -C "$SRC" .
fi

# 滚动清理
find "$BACKUP_DIR" -name "stagent-workspaces-*.tar.gz" -mtime "+$KEEP_DAYS" -delete

echo "备份完成: $BACKUP_DIR/stagent-workspaces-$STAMP.tar.gz（保留 $KEEP_DAYS 天）"
ls -lh "$BACKUP_DIR" | tail -5
