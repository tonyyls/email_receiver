# Docker 环境变量配置解决方案

## 问题分析

您发现 `.env` 文件在构建 Docker 镜像时没有被拷贝进去，这是因为：

1. **`.dockerignore` 文件中排除了 `.env` 文件**
   ```
   # dotenv 环境变量文件
   .env
   .env.local
   .env.development.local
   .env.test.local
   .env.production.local
   ```

2. **这是 Docker 的安全最佳实践**
   - 避免将敏感信息（如密码、API 密钥）打包到镜像中
   - 防止配置信息泄露到镜像层中
   - 提高镜像的可移植性和安全性

## 解决方案

### 方案一：生产环境推荐 - 使用环境变量

#### 1. 修改 Dockerfile（推荐）
```dockerfile
# 生产环境镜像
FROM node:18-alpine

# 安装 dumb-init 用于信号处理
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package 文件
COPY --chown=nextjs:nodejs package*.json ./

# 复制 node_modules
COPY --chown=nextjs:nodejs node_modules ./node_modules

# 复制构建产物
COPY --chown=nextjs:nodejs dist ./dist

# 创建数据和日志目录
RUN mkdir -p data logs && \
    chown -R nextjs:nodejs data logs

# 切换到非 root 用户
USER nextjs

# 暴露端口
EXPOSE 3000

# 设置默认环境变量（可被外部覆盖）
ENV NODE_ENV=production
ENV PORT=3000
ENV HOST=0.0.0.0
ENV API_PREFIX=/email-receiver-api

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: process.env.PORT || 3000, path: '/api/health', timeout: 2000 }; \
    const req = http.request(options, (res) => { \
        if (res.statusCode === 200) process.exit(0); \
        else process.exit(1); \
    }); \
    req.on('error', () => process.exit(1)); \
    req.on('timeout', () => process.exit(1)); \
    req.end();"

# 使用 dumb-init 启动应用
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/server.js"]
```

#### 2. 更新 docker-compose.yml
```yaml
version: '3.8'

services:
  email-receiver:
    build: .
    ports:
      - "3000:3000"
    environment:
      # 基础配置
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      
      # API 配置
      - API_PREFIX=/email-receiver-api
      - CORS_ORIGIN=https://bridge.yunc.tech
      
      # 日志配置
      - LOG_LEVEL=info
      - LOG_FILE_PATH=logs/app.log
      - ERROR_LOG_FILE_PATH=logs/error.log
      
      # 数据路径
      - DATA_PATH=data
      - EMAILS_PATH=data/emails
      - INVOICES_PATH=data/invoices
      
      # 发票识别配置
      - INVOICE_CONFIDENCE_THRESHOLD=0.3
      - INVOICE_KEYWORD_SCORE_WEIGHT=0.4
      - INVOICE_SENDER_SCORE_WEIGHT=0.3
      - INVOICE_SUBJECT_SCORE_WEIGHT=0.3
      
      # IMAP 配置
      - IMAP_CONNECTION_TIMEOUT=10000
      - IMAP_AUTH_TIMEOUT=5000
      
      # 邮件处理配置
      - MAX_EMAILS_TO_FETCH=50
      - ENABLE_LOCAL_STORAGE=true
      
      # 敏感信息（从外部文件或 secrets 加载）
      - EMAIL_PASSWORD_FILE=/run/secrets/email_password
      
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
      
    secrets:
      - email_password
      
    restart: unless-stopped
    
    healthcheck:
      test: ["CMD", "node", "-e", "const http = require('http'); const req = http.request({hostname: 'localhost', port: 3000, path: '/api/health'}, (res) => process.exit(res.statusCode === 200 ? 0 : 1)); req.on('error', () => process.exit(1)); req.end();"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s

secrets:
  email_password:
    file: ./secrets/email_password.txt
```

#### 3. 创建 secrets 目录结构
```bash
mkdir -p secrets
echo "your_email_password_here" > secrets/email_password.txt
chmod 600 secrets/email_password.txt
```

### 方案二：开发环境 - 包含 .env 文件

如果您确实需要在镜像中包含 `.env` 文件（仅限开发环境），可以：

#### 1. 修改 .dockerignore
```bash
# 注释掉 .env 排除规则（仅开发环境）
# .env

# 或者创建特定的 .env 文件
!.env.docker
```

#### 2. 在 Dockerfile 中添加
```dockerfile
# 仅开发环境使用
COPY --chown=nextjs:nodejs .env.docker ./.env
```

## 安全最佳实践

### 1. 环境变量分层管理
```bash
# 公共配置（可以放在镜像中）
ENV NODE_ENV=production
ENV PORT=3000
ENV API_PREFIX=/email-receiver-api

# 敏感配置（通过外部传入）
# EMAIL_PASSWORD（通过 docker run -e 或 docker-compose）
# DATABASE_URL（通过 secrets 或环境变量）
```

### 2. 使用 Docker Secrets（推荐）
```yaml
# docker-compose.yml
secrets:
  email_password:
    external: true
  database_url:
    external: true

services:
  app:
    secrets:
      - email_password
      - database_url
```

### 3. 环境变量文件管理
```bash
# 生产环境
docker run -d --env-file .env.production your-app

# 或使用多个环境文件
docker run -d \
  --env-file .env.base \
  --env-file .env.production \
  your-app
```

## 部署脚本示例

### 1. 本地构建脚本
```bash
#!/bin/bash
# build-and-run.sh

# 构建镜像
docker build -t email-receiver:latest .

# 运行容器（使用环境变量）
docker run -d \
  --name email-receiver \
  -p 3000:3000 \
  --env-file .env.production \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  email-receiver:latest
```

### 2. 生产环境部署脚本
```bash
#!/bin/bash
# deploy-production.sh

# 设置环境变量
export NODE_ENV=production
export CORS_ORIGIN=https://bridge.yunc.tech
export EMAIL_PASSWORD=$(cat /etc/secrets/email_password)

# 使用 docker-compose 部署
docker-compose -f docker-compose.prod.yml up -d
```

## 总结

**推荐方案**：
1. ✅ 保持 `.env` 在 `.dockerignore` 中（安全）
2. ✅ 使用环境变量或 Docker secrets 传递配置
3. ✅ 创建 `.env.production` 作为模板
4. ✅ 在 docker-compose.yml 中定义环境变量
5. ✅ 敏感信息使用 secrets 管理

这样既保证了安全性，又提供了灵活的配置管理方式。