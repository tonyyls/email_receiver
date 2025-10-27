# Email Receiver API

一个通用的邮件处理后端服务，提供邮件接收、处理和智能发票识别功能。

## 🚀 功能特性

- **邮件接收与处理**：支持 IMAP 和 POP3 协议的邮件获取
- **智能发票识别**：基于关键词和内容分析的发票邮件检测
- **RESTful API**：完整的 REST API 接口，支持各种邮件操作
- **Docker 部署**：完整的容器化部署方案
- **Nginx 代理**：生产环境代理配置
- **健康检查**：内置健康检查和监控接口
- **配置管理**：灵活的环境变量配置系统

## 📋 功能清单

### 核心 API 接口

| 接口 | 方法 | 描述 |
|------|------|------|
| `/api/health` | GET | 健康检查 |
| `/api/test-connection` | POST | 邮箱连接测试 |
| `/api/fetch-emails` | POST | 获取邮件列表 |
| `/api/detect-invoices` | POST | 发票邮件检测 |
| `/api/fetch-and-detect` | POST | 获取邮件并检测发票（组合接口） |
| `/api/fetch-invoice-emails` | POST | 获取发票邮件（只返回发票邮件） |
| `/api/invoice-keywords` | GET | 获取发票关键词 |
| `/api/invoice-keywords` | PUT | 更新发票关键词 |

### 主要功能

1. **邮件连接管理**
   - 支持 IMAP/POP3 协议
   - 连接池管理
   - 自动重连机制

2. **邮件处理**
   - 邮件列表获取
   - 邮件内容解析
   - 附件处理
   - 邮件过滤

3. **发票识别**
   - 基于关键词的智能识别
   - 可配置的置信度阈值
   - 多维度评分系统（主题、发件人、内容、附件）

4. **数据管理**
   - 邮箱预设配置
   - 发票关键词管理
   - 本地数据存储

## 🛠 技术栈

- **运行时**：Node.js 18+
- **框架**：Express.js + TypeScript
- **邮件处理**：node-imap, node-poplib
- **容器化**：Docker
- **代理**：Nginx
- **日志**：Winston
- **开发工具**：ESLint, Prettier

## 🚀 快速开始

### 环境要求

- Node.js 18.0+
- npm 或 pnpm
- Docker（可选，用于容器化部署）

### 安装与运行

1. **克隆项目**
```bash
git clone <repository-url>
cd email_receiver
```

2. **安装依赖**
```bash
# 使用 npm
npm install

# 或使用 pnpm
pnpm install
```

3. **配置环境变量**
```bash
cp .env.example .env
# 编辑 .env 文件，配置必要的参数
```

4. **启动开发服务器**
```bash
# 开发模式
npm run dev

# 或
pnpm dev
```

5. **访问服务**
```
http://localhost:3000/api/health
```

## 🔧 开发环境搭建

### 项目结构

```
email_receiver/
├── src/                    # 源代码目录
│   ├── controllers/        # 控制器
│   ├── services/          # 业务逻辑服务
│   ├── routes/            # 路由定义
│   ├── config/            # 配置文件
│   ├── types/             # TypeScript 类型定义
│   └── server.ts          # 服务器入口
├── dist/                  # 编译输出目录
├── data/                  # 数据存储目录
├── logs/                  # 日志目录
├── docker-compose.yml     # Docker Compose 配置
├── Dockerfile            # Docker 镜像配置
├── nginx.conf.example    # Nginx 配置示例
└── README.md            # 项目文档
```

### 开发脚本

```bash
# 开发模式（热重载）
npm run dev

# 构建项目
npm run build

# 生产模式运行
npm start

# 类型检查
npm run check

# 代码格式化
npm run format

# 代码检查
npm run lint
```

### 环境变量配置

复制 `.env.example` 到 `.env` 并配置以下参数：

```env
# 服务器配置
PORT=3000                              # 服务端口
NODE_ENV=development                   # 环境模式
HOST=0.0.0.0                         # 监听地址

# API 配置
API_PREFIX=/api                        # API 前缀
CORS_ORIGIN=*                         # CORS 允许的源

# 日志配置
LOG_LEVEL=info                        # 日志级别
LOG_FILE_PATH=./logs/app.log          # 日志文件路径

# 数据存储
DATA_PATH=./data                      # 数据目录
EMAIL_PRESETS_PATH=./data/email_presets.json
INVOICE_KEYWORDS_PATH=./data/invoice_keywords.json
ENABLE_LOCAL_STORAGE=false            # 是否启用本地存储

# 发票识别配置
INVOICE_CONFIDENCE_THRESHOLD=0.5       # 置信度阈值
```

## 📖 API 文档

### 健康检查

```http
GET /api/health
```

**响应示例：**
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "uptime": 3600
}
```

### 邮箱连接测试

```http
POST /api/test-connection
Content-Type: application/json

{
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "user": "your-email@gmail.com",
  "password": "your-password"
}
```

### 获取邮件列表

```http
POST /api/fetch-emails
Content-Type: application/json

{
  "host": "imap.gmail.com",
  "port": 993,
  "secure": true,
  "user": "your-email@gmail.com",
  "password": "your-password",
  "mailbox": "INBOX",
  "limit": 10
}
```

### 发票邮件检测

```http
POST /api/detect-invoices
Content-Type: application/json

{
  "emails": [
    {
      "subject": "发票通知",
      "from": "billing@company.com",
      "body": "您的发票已生成",
      "attachments": ["invoice.pdf"]
    }
  ]
}
```

## 🐳 Docker 部署

### 使用 Docker Compose（推荐）

1. **创建 docker-compose.yml**
```yaml
version: '3.8'

services:
  email-receiver:
    build: .
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - HOST=0.0.0.0
      - API_PREFIX=/email-receiver-api
      - CORS_ORIGIN=*,https://bridge.yunc.tech
      - LOG_LEVEL=info
      - INVOICE_CONFIDENCE_THRESHOLD=0.3
    volumes:
      - ./data:/app/data
      - ./logs:/app/logs
    restart: unless-stopped
    healthcheck:
      test: ["CMD", "node", "-e", "require('http').get('http://localhost:3000/email-receiver-api/health', (res) => process.exit(res.statusCode === 200 ? 0 : 1)).on('error', () => process.exit(1))"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 40s
```

2. **构建并启动**
```bash
docker-compose up -d
```

### 使用 Docker 命令

```bash
# 构建镜像
docker build -t email-receiver .

# 运行容器
docker run -d \
  --name email-receiver \
  -p 3000:3000 \
  -e NODE_ENV=production \
  -e PORT=3000 \
  -e HOST=0.0.0.0 \
  -e API_PREFIX=/email-receiver-api \
  -e CORS_ORIGIN=*,https://bridge.yunc.tech \
  -v $(pwd)/data:/app/data \
  -v $(pwd)/logs:/app/logs \
  email-receiver
```

## 🌐 Nginx 代理配置

### 基础配置

创建 `/etc/nginx/sites-available/email-receiver`：

```nginx
server {
    listen 80;
    server_name bridge.yunc.tech;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name bridge.yunc.tech;

    # SSL 配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    # 代理配置
    location /email-receiver-api/ {
        proxy_pass http://172.17.0.1:3000/email-receiver-api/;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        proxy_set_header X-Forwarded-Port $server_port;

        # 超时设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;

        # 缓冲设置
        proxy_buffering on;
        proxy_buffer_size 4k;
        proxy_buffers 8 4k;
    }

    # 健康检查
    location /health {
        proxy_pass http://172.17.0.1:3000/email-receiver-api/health;
        access_log off;
    }
}
```

### 启用配置

```bash
# 创建软链接
sudo ln -s /etc/nginx/sites-available/email-receiver /etc/nginx/sites-enabled/

# 测试配置
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

## 🔧 配置说明

### 发票识别配置

发票识别系统使用多维度评分机制：

- **主题权重**：0.3（检查邮件主题中的发票关键词）
- **发件人权重**：0.2（检查发件人域名和地址）
- **内容权重**：0.3（检查邮件正文内容）
- **附件权重**：0.2（检查附件名称和类型）

### 关键词管理

发票关键词存储在 `data/invoice_keywords.json` 中：

```json
{
  "subject_keywords": ["发票", "invoice", "bill", "receipt"],
  "sender_keywords": ["billing", "invoice", "finance"],
  "content_keywords": ["发票号", "税号", "金额", "invoice number"],
  "attachment_keywords": ["invoice", "bill", "receipt", ".pdf"]
}
```

## 🔍 故障排查

### 常见问题

1. **TLS 连接错误**
   - 检查 Nginx SSL 配置
   - 确认证书有效性
   - 验证代理头设置

2. **邮箱连接失败**
   - 验证邮箱服务器配置
   - 检查防火墙设置
   - 确认认证信息正确

3. **Docker 容器启动失败**
   - 检查环境变量配置
   - 验证端口占用情况
   - 查看容器日志

### 日志查看

```bash
# 查看应用日志
tail -f logs/app.log

# 查看 Docker 容器日志
docker logs email-receiver

# 查看 Nginx 日志
sudo tail -f /var/log/nginx/error.log
```

### 健康检查

```bash
# 检查服务状态
curl http://localhost:3000/api/health

# 检查代理状态
curl https://bridge.yunc.tech/email-receiver-api/health
```

## 🤝 贡献指南

1. Fork 项目
2. 创建功能分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 打开 Pull Request

### 开发规范

- 使用 TypeScript 进行开发
- 遵循 ESLint 和 Prettier 规范
- 编写单元测试
- 更新相关文档

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。

## 📞 支持

如有问题或建议，请通过以下方式联系：

- 创建 Issue
- 发送邮件至项目维护者
- 查看项目文档和 Wiki

---

**注意**：在生产环境中使用前，请确保正确配置所有安全设置，包括 SSL 证书、防火墙规则和访问控制。