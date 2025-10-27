# 部署指南：解决 TLS 连接错误

## 问题描述
通过 nginx 代理访问 `https://your-domain.com` 时出现错误：
```
Client network socket disconnected before secure TLS connection was established
```

## 问题分析

这个错误通常由以下几个原因造成：

1. **应用未正确处理代理请求**：应用没有设置 `trust proxy`
2. **CORS 配置不支持代理域名**：应用的 CORS 设置没有包含代理域名
3. **nginx 代理配置不当**：缺少必要的代理头部设置
4. **SSL/TLS 配置问题**：证书或 SSL 配置有误

## 解决方案

### 1. 应用端修复（已完成）

#### 1.1 启用代理信任
在 `src/app.ts` 中添加：
```typescript
app.set('trust proxy', true);
```

#### 1.2 更新 CORS 配置
在 `src/middleware/cors.ts` 中支持代理域名：
```typescript
// 支持代理域名
const forwardedHost = req.headers['x-forwarded-host'] as string;
if (forwardedHost) {
  const forwardedOrigin = `https://${forwardedHost}`;
  if (allowedOrigins.includes(forwardedOrigin) || allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', forwardedOrigin);
  }
}
```

#### 1.3 更新环境变量
在 `.env` 文件中：
```bash
HOST=0.0.0.0
CORS_ORIGIN=*,https://your-domain.com
```

### 2. Nginx 配置建议

创建 nginx 配置文件 `/etc/nginx/sites-available/your-domain.com`：

```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl http2;
    server_name your-domain.com;

    # SSL 证书配置
    ssl_certificate /path/to/your/certificate.crt;
    ssl_certificate_key /path/to/your/private.key;
    
    # SSL 安全配置
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_prefer_server_ciphers on;
    ssl_session_cache shared:SSL:10m;

    location / {
        proxy_pass http://127.0.0.1:3000;
        
        # 关键代理头部设置
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;
        
        # 连接设置
        proxy_connect_timeout 60s;
        proxy_send_timeout 60s;
        proxy_read_timeout 60s;
        
        # HTTP 版本
        proxy_http_version 1.1;
        proxy_set_header Connection "";
    }
}
```

### 3. 部署步骤

#### 3.1 重新编译应用
```bash
pnpm run build
```

#### 3.2 重启应用服务
```bash
# 如果使用 PM2
pm2 restart email-receiver

# 如果使用 systemd
sudo systemctl restart email-receiver

# 如果直接运行
pnpm start
```

#### 3.3 更新 nginx 配置
```bash
# 测试配置
sudo nginx -t

# 重载配置
sudo nginx -s reload
```

### 4. 验证修复

#### 4.1 检查应用状态
```bash
curl -H "Host: your-domain.com" http://localhost:3000/
```

#### 4.2 检查代理访问
```bash
curl -H "X-Forwarded-Host: your-domain.com" \
     -H "X-Forwarded-Proto: https" \
     https://your-domain.com/
```

#### 4.3 测试 API 接口
```bash
curl -X POST https://your-domain.com/email-receiver-api/fetch-invoice-emails \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 5. 常见问题排查

#### 5.1 检查 SSL 证书
```bash
openssl s_client -connect your-domain.com:443 -servername your-domain.com
```

#### 5.2 检查 nginx 日志
```bash
sudo tail -f /var/log/nginx/error.log
sudo tail -f /var/log/nginx/your-domain.com.error.log
```

#### 5.3 检查应用日志
```bash
tail -f logs/app.log
```

### 6. 安全建议

1. **限制 CORS 源**：生产环境中不要使用 `*`，明确指定允许的域名
2. **SSL 配置**：使用强加密套件和最新的 TLS 版本
3. **防火墙**：确保只有必要的端口对外开放
4. **日志监控**：定期检查访问日志和错误日志

## 总结

通过以上修复，应用现在能够：
- 正确处理 nginx 代理请求
- 支持 HTTPS 代理访问
- 处理跨域请求
- 提供详细的错误日志

如果问题仍然存在，请检查：
1. SSL 证书是否正确配置
2. 防火墙是否阻止了连接
3. 应用是否正常运行在 3000 端口
4. nginx 配置是否正确加载