# 🚀 Nginx 部署和测试完整指南

## 📋 部署前准备

### 1. 环境检查
```bash
# 检查 nginx 版本
nginx -v

# 检查当前配置状态
sudo nginx -t

# 检查服务状态
sudo systemctl status nginx

# 检查端口占用
sudo netstat -tlnp | grep -E ':80|:443'
```

### 2. 备份当前配置
```bash
# 创建带时间戳的备份
sudo cp /etc/nginx/sites-available/your-domain.com \
       /etc/nginx/sites-available/your-domain.com.backup.$(date +%Y%m%d_%H%M%S)

# 查看备份文件
ls -la /etc/nginx/sites-available/your-domain.com.backup.*
```

### 3. 检查证书文件
```bash
# 检查证书文件存在性和权限
ls -la /etc/nginx/cert/your-domain.com.*

# 检查证书有效期
openssl x509 -in /etc/nginx/cert/your-domain.com.pem -text -noout | grep -A2 "Validity"

# 验证证书和私钥匹配
cert_hash=$(openssl x509 -noout -modulus -in /etc/nginx/cert/your-domain.com.pem | openssl md5)
key_hash=$(openssl rsa -noout -modulus -in /etc/nginx/cert/your-domain.com.key | openssl md5)
echo "证书哈希: $cert_hash"
echo "私钥哈希: $key_hash"
```

## 🔧 部署步骤

### 步骤 1: 应用新配置
```bash
# 复制修复后的配置文件
sudo cp nginx-bridge-yunc-tech-fixed.conf /etc/nginx/sites-available/your-domain.com

# 或者手动编辑现有配置
sudo nano /etc/nginx/sites-available/your-domain.com
```

### 步骤 2: 验证配置语法
```bash
# 测试配置语法
sudo nginx -t

# 如果有错误，查看详细信息
sudo nginx -T | grep -A5 -B5 "error"
```

### 步骤 3: 重载配置
```bash
# 重载 nginx 配置（推荐，不中断服务）
sudo nginx -s reload

# 或者重启服务（如果重载失败）
sudo systemctl restart nginx

# 检查服务状态
sudo systemctl status nginx
```

### 步骤 4: 验证部署
```bash
# 基础连接测试
curl -I https://your-domain.com/

# API 端点测试
curl -I https://your-domain.com/email-receiver-api/

# 详细连接测试
curl -vvv https://your-domain.com/email-receiver-api/
```

## 🧪 测试方案

### 1. SSL/TLS 连接测试

#### 基础 SSL 测试
```bash
# OpenSSL 连接测试
echo "测试 TLS 连接..."
openssl s_client -connect your-domain.com:443 -servername your-domain.com < /dev/null

# 测试 TLS 1.2
echo "测试 TLS 1.2..."
openssl s_client -connect your-domain.com:443 -tls1_2 < /dev/null

# 测试 TLS 1.3
echo "测试 TLS 1.3..."
openssl s_client -connect your-domain.com:443 -tls1_3 < /dev/null
```

#### SSL 安全性测试
```bash
# 检查支持的加密套件
nmap --script ssl-enum-ciphers -p 443 your-domain.com

# 使用 testssl.sh 进行全面测试
testssl.sh your-domain.com
```

### 2. API 功能测试

#### HTTP 方法测试
```bash
# GET 请求测试
curl -X GET https://your-domain.com/email-receiver-api/ \
  -H "Accept: application/json"

# POST 请求测试
curl -X POST https://your-domain.com/email-receiver-api/ \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'

# OPTIONS 请求测试（CORS）
curl -X OPTIONS https://your-domain.com/email-receiver-api/ \
  -H "Origin: https://example.com" \
  -H "Access-Control-Request-Method: POST" \
  -H "Access-Control-Request-Headers: Content-Type"
```

#### 大文件上传测试
```bash
# 创建测试文件
dd if=/dev/zero of=test_file.dat bs=1M count=10

# 测试文件上传
curl -X POST https://your-domain.com/email-receiver-api/upload \
  -F "file=@test_file.dat" \
  -v

# 清理测试文件
rm test_file.dat
```

### 3. 性能测试

#### 并发连接测试
```bash
# 使用 ab 进行压力测试
ab -n 1000 -c 50 https://your-domain.com/email-receiver-api/

# 使用 wrk 进行压力测试
wrk -t12 -c400 -d30s https://your-domain.com/email-receiver-api/
```

#### 连接超时测试
```bash
# 测试连接超时设置
timeout 35 curl https://your-domain.com/email-receiver-api/slow-endpoint
```

### 4. 错误处理测试

#### 后端服务停止测试
```bash
# 停止后端服务
docker stop email-receiver

# 测试错误页面
curl -I https://your-domain.com/email-receiver-api/

# 重启后端服务
docker start email-receiver
```

## 📊 监控和日志

### 1. 实时监控
```bash
# 实时查看访问日志
sudo tail -f /var/log/nginx/your-domain.com.access.log

# 实时查看错误日志
sudo tail -f /var/log/nginx/your-domain.com.error.log

# 监控特定 API 访问
sudo tail -f /var/log/nginx/your-domain.com.access.log | grep "/email-receiver-api"
```

### 2. 日志分析
```bash
# 统计访问量
awk '{print $1}' /var/log/nginx/your-domain.com.access.log | sort | uniq -c | sort -nr | head -10

# 统计响应状态码
awk '{print $9}' /var/log/nginx/your-domain.com.access.log | sort | uniq -c | sort -nr

# 查找错误请求
grep " 4[0-9][0-9] \| 5[0-9][0-9] " /var/log/nginx/your-domain.com.access.log
```

### 3. 系统资源监控
```bash
# 监控 nginx 进程
ps aux | grep nginx

# 监控内存使用
free -h

# 监控磁盘使用
df -h

# 监控网络连接
ss -tuln | grep -E ':80|:443'
```

## ✅ 验证清单

### 部署验证
- [ ] Nginx 配置语法正确 (`nginx -t`)
- [ ] Nginx 服务正常运行 (`systemctl status nginx`)
- [ ] 端口 80 和 443 正常监听
- [ ] SSL 证书有效且匹配域名
- [ ] 后端服务正常响应

### 功能验证
- [ ] HTTPS 连接正常建立
- [ ] HTTP 自动重定向到 HTTPS
- [ ] API 端点正常响应
- [ ] CORS 头部正确设置
- [ ] 文件上传功能正常
- [ ] 错误页面正确显示

### 安全验证
- [ ] 只支持 TLS 1.2 和 1.3
- [ ] 使用安全的加密套件
- [ ] 安全头部正确设置
- [ ] SSL Labs 评级 A 或以上

### 性能验证
- [ ] 响应时间在可接受范围内
- [ ] 并发连接处理正常
- [ ] 内存和 CPU 使用率正常
- [ ] 日志记录正常

## 🆘 故障排除

### 常见问题及解决方案

#### 问题 1: 配置重载失败
```bash
# 检查配置语法
sudo nginx -t

# 查看详细错误信息
sudo nginx -T

# 如果语法正确但重载失败，尝试重启
sudo systemctl restart nginx
```

#### 问题 2: SSL 连接失败
```bash
# 检查证书文件
ls -la /etc/nginx/cert/

# 测试证书
openssl x509 -in /etc/nginx/cert/your-domain.com.pem -text -noout

# 检查证书权限
sudo chmod 644 /etc/nginx/cert/your-domain.com.pem
sudo chmod 600 /etc/nginx/cert/your-domain.com.key
```

#### 问题 3: 后端连接失败
```bash
# 检查后端服务
curl -I http://172.17.0.1:3000/email-receiver-api/

# 检查 Docker 容器
docker ps | grep email-receiver

# 检查网络连通性
telnet 172.17.0.1 3000
```

### 紧急回滚
```bash
# 回滚到备份配置
sudo cp /etc/nginx/sites-available/your-domain.com.backup.* \
       /etc/nginx/sites-available/your-domain.com

# 重载配置
sudo nginx -s reload

# 验证回滚
curl -I https://your-domain.com/
```

## 📈 后续优化建议

### 1. 性能优化
- 启用 HTTP/2 推送
- 配置缓存策略
- 优化 SSL 会话复用
- 实施 CDN 加速

### 2. 安全加固
- 实施 WAF 规则
- 配置 DDoS 防护
- 启用访问频率限制
- 定期更新 SSL 证书

### 3. 监控告警
- 配置 Prometheus 监控
- 设置 Grafana 仪表板
- 配置告警规则
- 实施日志聚合

这个部署指南提供了完整的部署流程和测试方案，确保您的 Nginx 配置能够正确解决 TLS 连接问题。