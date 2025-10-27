# 🔍 Nginx TLS 连接问题故障排查指南

## 快速诊断步骤

### 1. 🚨 立即检查项目

#### 检查 Nginx 配置语法
```bash
# 测试配置文件语法
sudo nginx -t

# 如果有错误，查看详细信息
sudo nginx -T
```

#### 检查 SSL 证书
```bash
# 检查证书文件是否存在
ls -la /etc/nginx/cert/bridge.yunc.tech.*

# 检查证书有效期
openssl x509 -in /etc/nginx/cert/bridge.yunc.tech.pem -text -noout | grep -A2 "Validity"

# 检查证书和私钥是否匹配
openssl x509 -noout -modulus -in /etc/nginx/cert/bridge.yunc.tech.pem | openssl md5
openssl rsa -noout -modulus -in /etc/nginx/cert/bridge.yunc.tech.key | openssl md5
```

#### 检查端口和进程
```bash
# 检查 443 端口是否被占用
sudo netstat -tlnp | grep :443

# 检查 nginx 进程状态
sudo systemctl status nginx

# 检查后端服务是否运行
curl -I http://172.17.0.1:3000/email-receiver-api/
```

### 2. 🔧 SSL/TLS 连接测试

#### 使用 OpenSSL 测试 TLS 连接
```bash
# 测试 TLS 连接
openssl s_client -connect bridge.yunc.tech:443 -servername bridge.yunc.tech

# 测试特定 TLS 版本
openssl s_client -connect bridge.yunc.tech:443 -tls1_2
openssl s_client -connect bridge.yunc.tech:443 -tls1_3
```

#### 使用 curl 测试
```bash
# 详细测试 HTTPS 连接
curl -vvv https://bridge.yunc.tech/email-receiver-api/

# 忽略证书验证测试
curl -k -vvv https://bridge.yunc.tech/email-receiver-api/

# 测试特定 TLS 版本
curl --tlsv1.2 -vvv https://bridge.yunc.tech/email-receiver-api/
```

### 3. 📊 日志分析

#### 查看 Nginx 错误日志
```bash
# 实时查看错误日志
sudo tail -f /var/log/nginx/error.log

# 查看特定站点错误日志
sudo tail -f /var/log/nginx/bridge.yunc.tech.error.log

# 搜索 TLS 相关错误
sudo grep -i "ssl\|tls" /var/log/nginx/error.log
```

#### 查看访问日志
```bash
# 查看访问日志
sudo tail -f /var/log/nginx/bridge.yunc.tech.access.log

# 查看特定 API 访问
sudo grep "/email-receiver-api" /var/log/nginx/bridge.yunc.tech.access.log
```

## 🎯 常见问题解决方案

### 问题 1: SSL 证书问题

**症状：** `SSL_ERROR_BAD_CERT_DOMAIN` 或证书验证失败

**解决方案：**
```bash
# 1. 检查证书域名匹配
openssl x509 -in /etc/nginx/cert/bridge.yunc.tech.pem -text -noout | grep -A1 "Subject Alternative Name"

# 2. 重新生成证书（如果使用 Let's Encrypt）
sudo certbot renew --dry-run

# 3. 检查证书链完整性
openssl verify -CAfile /etc/ssl/certs/ca-certificates.crt /etc/nginx/cert/bridge.yunc.tech.pem
```

### 问题 2: TLS 协议不兼容

**症状：** `SSL_ERROR_NO_CYPHER_OVERLAP` 或协议协商失败

**解决方案：**
```nginx
# 在 nginx 配置中使用现代安全配置
ssl_protocols TLSv1.2 TLSv1.3;
ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
ssl_prefer_server_ciphers off;
```

### 问题 3: 代理后端连接失败

**症状：** `502 Bad Gateway` 或连接超时

**解决方案：**
```bash
# 1. 检查后端服务状态
curl -I http://172.17.0.1:3000/email-receiver-api/

# 2. 检查 Docker 容器状态
docker ps | grep email-receiver

# 3. 检查网络连通性
telnet 172.17.0.1 3000
```

### 问题 4: 防火墙阻塞

**症状：** 连接超时或拒绝连接

**解决方案：**
```bash
# 检查防火墙状态
sudo ufw status

# 开放必要端口
sudo ufw allow 80
sudo ufw allow 443

# 检查 iptables 规则
sudo iptables -L -n
```

## 🧪 验证修复效果

### 1. 基础连接测试
```bash
# 测试 HTTPS 连接
curl -I https://bridge.yunc.tech/

# 测试 API 端点
curl -I https://bridge.yunc.tech/email-receiver-api/

# 测试 POST 请求
curl -X POST https://bridge.yunc.tech/email-receiver-api/ \
  -H "Content-Type: application/json" \
  -d '{"test": "data"}'
```

### 2. SSL 安全性测试
```bash
# 使用 SSL Labs 在线测试（推荐）
# 访问：https://www.ssllabs.com/ssltest/analyze.html?d=bridge.yunc.tech

# 本地 SSL 测试
nmap --script ssl-enum-ciphers -p 443 bridge.yunc.tech
```

### 3. 性能测试
```bash
# 简单性能测试
ab -n 100 -c 10 https://bridge.yunc.tech/email-receiver-api/

# 或使用 wrk
wrk -t12 -c400 -d30s https://bridge.yunc.tech/email-receiver-api/
```

## 🚀 部署检查清单

### 部署前检查
- [ ] 备份当前配置文件
- [ ] 验证新配置语法 (`nginx -t`)
- [ ] 检查证书文件权限和路径
- [ ] 确认后端服务正常运行
- [ ] 检查防火墙规则

### 部署步骤
```bash
# 1. 备份当前配置
sudo cp /etc/nginx/sites-available/bridge.yunc.tech /etc/nginx/sites-available/bridge.yunc.tech.backup.$(date +%Y%m%d_%H%M%S)

# 2. 应用新配置
sudo cp nginx-bridge-yunc-tech-fixed.conf /etc/nginx/sites-available/bridge.yunc.tech

# 3. 测试配置
sudo nginx -t

# 4. 重载配置
sudo nginx -s reload

# 5. 验证服务
curl -I https://bridge.yunc.tech/email-receiver-api/
```

### 部署后验证
- [ ] HTTPS 连接正常
- [ ] API 端点响应正常
- [ ] SSL 证书验证通过
- [ ] 日志中无错误信息
- [ ] 性能测试通过

## 🆘 紧急回滚

如果新配置导致问题：

```bash
# 立即回滚到备份配置
sudo cp /etc/nginx/sites-available/bridge.yunc.tech.backup.* /etc/nginx/sites-available/bridge.yunc.tech

# 重载配置
sudo nginx -s reload

# 验证回滚成功
sudo nginx -t
curl -I https://bridge.yunc.tech/
```

## 📞 进一步支持

如果问题仍然存在，请收集以下信息：

1. **Nginx 版本**：`nginx -v`
2. **操作系统版本**：`cat /etc/os-release`
3. **错误日志**：最近的错误日志内容
4. **SSL 测试结果**：OpenSSL 连接测试输出
5. **网络配置**：`ip addr show` 和 `netstat -tlnp`

这些信息将帮助进行更深入的问题诊断。