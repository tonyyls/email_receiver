# 生产环境部署指南

## 概述

本指南提供了将邮件接收器应用部署到生产环境的完整方案，重点关注安全性、可靠性和可维护性。

## 环境变量管理策略

### 1. 配置分层

```bash
# 公共配置（可以在 Dockerfile 中设置）
NODE_ENV=production
PORT=3000
HOST=0.0.0.0
API_PREFIX=/email-receiver-api

# 环境特定配置（通过 docker-compose 设置）
CORS_ORIGIN=https://bridge.yunc.tech
LOG_LEVEL=info

# 敏感配置（通过 secrets 或外部环境变量）
EMAIL_PASSWORD=<secret>
DATABASE_URL=<secret>
```

### 2. Docker Secrets 配置

#### 创建 secrets 目录
```bash
mkdir -p secrets
chmod 700 secrets

# 创建敏感信息文件
echo "your_email_password_here" > secrets/email_password.txt
echo "postgresql://user:pass@host:5432/db" > secrets/database_url.txt

# 设置安全权限
chmod 600 secrets/*.txt
```

#### 在应用中读取 secrets
```javascript
// src/config/secrets.js
const fs = require('fs');
const path = require('path');

function readSecret(secretName) {
  try {
    const secretPath = `/run/secrets/${secretName}`;
    if (fs.existsSync(secretPath)) {
      return fs.readFileSync(secretPath, 'utf8').trim();
    }
    // 回退到环境变量
    return process.env[secretName.toUpperCase()];
  } catch (error) {
    console.error(`Failed to read secret ${secretName}:`, error);
    return null;
  }
}

module.exports = {
  emailPassword: readSecret('email_password'),
  databaseUrl: readSecret('database_url')
};
```

## 部署方案

### 方案一：Docker Compose（推荐）

#### 1. 使用生产环境配置
```bash
# 使用生产环境 compose 文件
docker-compose -f docker-compose.prod.yml up -d

# 或者使用环境变量覆盖
CORS_ORIGIN=https://your-domain.com docker-compose up -d
```

#### 2. 环境变量文件部署
```bash
# 创建生产环境变量文件
cp .env.production .env.prod

# 编辑生产配置
vim .env.prod

# 使用环境文件部署
docker-compose --env-file .env.prod up -d
```

### 方案二：Kubernetes 部署

#### 1. 创建 ConfigMap
```yaml
# k8s/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: email-receiver-config
data:
  NODE_ENV: "production"
  PORT: "3000"
  HOST: "0.0.0.0"
  API_PREFIX: "/email-receiver-api"
  CORS_ORIGIN: "https://bridge.yunc.tech"
  LOG_LEVEL: "info"
  INVOICE_CONFIDENCE_THRESHOLD: "0.3"
```

#### 2. 创建 Secret
```yaml
# k8s/secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: email-receiver-secrets
type: Opaque
data:
  email-password: <base64-encoded-password>
  database-url: <base64-encoded-url>
```

#### 3. 创建 Deployment
```yaml
# k8s/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: email-receiver
spec:
  replicas: 2
  selector:
    matchLabels:
      app: email-receiver
  template:
    metadata:
      labels:
        app: email-receiver
    spec:
      containers:
      - name: email-receiver
        image: email-receiver-api:latest
        ports:
        - containerPort: 3000
        envFrom:
        - configMapRef:
            name: email-receiver-config
        env:
        - name: EMAIL_PASSWORD
          valueFrom:
            secretKeyRef:
              name: email-receiver-secrets
              key: email-password
        volumeMounts:
        - name: data-volume
          mountPath: /app/data
        - name: logs-volume
          mountPath: /app/logs
      volumes:
      - name: data-volume
        persistentVolumeClaim:
          claimName: email-receiver-data
      - name: logs-volume
        persistentVolumeClaim:
          claimName: email-receiver-logs
```

## 安全配置

### 1. 容器安全
```dockerfile
# 使用非 root 用户
USER nextjs

# 只读文件系统（除了必要目录）
RUN mkdir -p /app/data /app/logs && \
    chown -R nextjs:nodejs /app/data /app/logs

# 在 docker-compose 中设置
security_opt:
  - no-new-privileges:true
read_only: true
tmpfs:
  - /tmp
  - /var/tmp
```

### 2. 网络安全
```yaml
# docker-compose.yml
networks:
  email-network:
    driver: bridge
    internal: true  # 内部网络，不直接暴露到外网
    
services:
  nginx:
    networks:
      - email-network
      - default  # 只有 nginx 可以访问外网
```

### 3. 资源限制
```yaml
deploy:
  resources:
    limits:
      cpus: '2.0'
      memory: 1G
      pids: 100
    reservations:
      cpus: '0.5'
      memory: 256M
```

## 监控和日志

### 1. 健康检查
```yaml
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:3000/api/health"]
  interval: 30s
  timeout: 10s
  retries: 3
  start_period: 40s
```

### 2. 日志管理
```yaml
logging:
  driver: "json-file"
  options:
    max-size: "10m"
    max-file: "3"
    labels: "service=email-receiver"
```

### 3. 监控集成
```yaml
# 添加 Prometheus 监控
labels:
  - "prometheus.io/scrape=true"
  - "prometheus.io/port=3000"
  - "prometheus.io/path=/metrics"
```

## 部署脚本

### 1. 自动化部署脚本
```bash
#!/bin/bash
# deploy.sh

set -e

# 配置变量
IMAGE_NAME="email-receiver-api"
IMAGE_TAG="latest"
COMPOSE_FILE="docker-compose.prod.yml"

echo "🚀 开始部署 Email Receiver..."

# 1. 构建镜像
echo "📦 构建 Docker 镜像..."
docker build -t ${IMAGE_NAME}:${IMAGE_TAG} .

# 2. 停止旧容器
echo "🛑 停止旧容器..."
docker-compose -f ${COMPOSE_FILE} down

# 3. 启动新容器
echo "▶️ 启动新容器..."
docker-compose -f ${COMPOSE_FILE} up -d

# 4. 等待服务启动
echo "⏳ 等待服务启动..."
sleep 30

# 5. 健康检查
echo "🔍 执行健康检查..."
if curl -f http://localhost:3000/api/health; then
    echo "✅ 部署成功！"
else
    echo "❌ 部署失败，回滚..."
    docker-compose -f ${COMPOSE_FILE} down
    exit 1
fi

# 6. 清理旧镜像
echo "🧹 清理旧镜像..."
docker image prune -f

echo "🎉 部署完成！"
```

### 2. 回滚脚本
```bash
#!/bin/bash
# rollback.sh

set -e

COMPOSE_FILE="docker-compose.prod.yml"
BACKUP_TAG="backup-$(date +%Y%m%d-%H%M%S)"

echo "🔄 开始回滚..."

# 1. 标记当前镜像为备份
docker tag email-receiver-api:latest email-receiver-api:${BACKUP_TAG}

# 2. 停止当前容器
docker-compose -f ${COMPOSE_FILE} down

# 3. 恢复到上一个版本
docker tag email-receiver-api:previous email-receiver-api:latest

# 4. 启动容器
docker-compose -f ${COMPOSE_FILE} up -d

echo "✅ 回滚完成！"
```

## 环境变量检查清单

### 部署前检查
```bash
#!/bin/bash
# check-env.sh

echo "🔍 检查环境变量配置..."

# 必需的环境变量
REQUIRED_VARS=(
    "NODE_ENV"
    "PORT"
    "API_PREFIX"
    "CORS_ORIGIN"
)

# 敏感变量（应通过 secrets 提供）
SENSITIVE_VARS=(
    "EMAIL_PASSWORD"
)

for var in "${REQUIRED_VARS[@]}"; do
    if [[ -z "${!var}" ]]; then
        echo "❌ 缺少必需的环境变量: $var"
        exit 1
    else
        echo "✅ $var = ${!var}"
    fi
done

for var in "${SENSITIVE_VARS[@]}"; do
    if [[ -z "${!var}" ]] && [[ ! -f "/run/secrets/${var,,}" ]]; then
        echo "⚠️  敏感变量 $var 未设置，请确保通过 secrets 提供"
    fi
done

echo "✅ 环境变量检查完成！"
```

## 故障排除

### 1. 常见问题
```bash
# 检查容器状态
docker-compose ps

# 查看容器日志
docker-compose logs -f email-receiver

# 进入容器调试
docker-compose exec email-receiver sh

# 检查环境变量
docker-compose exec email-receiver env | grep -E "(NODE_ENV|PORT|API_PREFIX)"
```

### 2. 性能监控
```bash
# 查看资源使用情况
docker stats

# 查看容器详细信息
docker inspect email-receiver-prod
```

## 总结

通过以上配置，您可以：

1. ✅ **安全地管理环境变量** - 使用 Docker secrets 和分层配置
2. ✅ **灵活部署** - 支持 Docker Compose 和 Kubernetes
3. ✅ **监控和日志** - 完整的健康检查和日志管理
4. ✅ **自动化运维** - 部署和回滚脚本
5. ✅ **安全加固** - 容器安全和网络隔离

**推荐的生产环境部署流程**：
1. 使用 `docker-compose.prod.yml` 进行部署
2. 通过 Docker secrets 管理敏感信息
3. 配置 nginx 反向代理和 SSL
4. 设置监控和日志收集
5. 定期备份数据和配置