# POP3协议支持说明

## 概述

邮箱插件现已支持POP3协议作为IMAP的备选方案。用户可以通过添加`protocol`参数来选择使用哪种协议。

## 功能特性

### 支持的协议
- **IMAP** (默认): 完整的邮箱管理功能
- **POP3**: 基础的邮件获取功能

### 主要功能
1. **连接测试**: 支持POP3和IMAP连接测试
2. **邮件获取**: 支持两种协议的邮件获取
3. **发票检测**: 保持与IMAP相同的发票检测功能
4. **缓存机制**: 统一的缓存策略
5. **错误处理**: 完整的错误处理和日志记录

## API使用方法

### 1. 连接测试

```bash
# POP3连接测试
curl -X POST http://localhost:3000/api/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "your_email@qq.com",
    "password": "your_authorization_code",
    "imap_server": "pop.qq.com",
    "port": 995,
    "use_ssl": true,
    "protocol": "POP3"
  }'

# IMAP连接测试（默认）
curl -X POST http://localhost:3000/api/test-connection \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "your_email@qq.com",
    "password": "your_authorization_code",
    "imap_server": "imap.qq.com",
    "port": 993,
    "use_ssl": true,
    "protocol": "IMAP"
  }'
```

### 2. 获取邮件

```bash
# 使用POP3获取邮件
curl -X POST http://localhost:3000/api/fetch-emails \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "your_email@qq.com",
    "password": "your_authorization_code",
    "imap_server": "pop.qq.com",
    "port": 995,
    "use_ssl": true,
    "protocol": "POP3",
    "limit": 10
  }'
```

### 3. 发票检测

```bash
# 使用POP3获取邮件并检测发票
curl -X POST http://localhost:3000/api/fetch-and-detect-invoices \
  -H "Content-Type: application/json" \
  -d '{
    "email_address": "your_email@qq.com",
    "password": "your_authorization_code",
    "imap_server": "pop.qq.com",
    "port": 995,
    "use_ssl": true,
    "protocol": "POP3",
    "limit": 10
  }'
```

## 配置参数

### 通用参数
- `email_address`: 邮箱地址
- `password`: 邮箱密码或授权码
- `port`: 端口号
- `use_ssl`: 是否使用SSL
- `protocol`: 协议类型 ("IMAP" | "POP3")，默认为"IMAP"

### IMAP特定参数
- `imap_server`: IMAP服务器地址
- `mail_box`: 邮箱文件夹，默认为"INBOX"

### POP3特定参数
- `imap_server`: POP3服务器地址（复用IMAP字段）

## 常用邮箱配置

### QQ邮箱
```json
{
  "email_address": "your_email@qq.com",
  "password": "your_authorization_code",
  "imap_server": "pop.qq.com",  // POP3
  "port": 995,
  "use_ssl": true,
  "protocol": "POP3"
}
```

### 163邮箱
```json
{
  "email_address": "your_email@163.com",
  "password": "your_authorization_code",
  "imap_server": "pop.163.com",  // POP3
  "port": 995,
  "use_ssl": true,
  "protocol": "POP3"
}
```

## POP3协议限制

### 功能限制
1. **只能访问收件箱**: POP3协议不支持文件夹概念
2. **邮件下载后删除**: 默认行为，邮件从服务器删除
3. **无服务器端搜索**: 所有过滤在客户端进行
4. **连接开销大**: 每次操作都需要重新连接

### 过滤功能
- **时间过滤**: 支持`since`参数进行时间过滤
- **发件人过滤**: 支持`from`参数进行发件人过滤
- **收件人过滤**: 支持`to`参数进行收件人过滤
- **数量限制**: 支持`limit`参数限制获取数量

## 测试脚本

项目根目录下提供了`test_pop3.js`测试脚本，可以用来测试POP3功能：

```bash
# 修改test_pop3.js中的邮箱配置
# 然后运行测试
node test_pop3.js
```

## 错误处理

### 常见错误
1. **认证失败**: 检查邮箱地址、密码和服务器配置
2. **连接超时**: 检查网络连接和防火墙设置
3. **协议不支持**: 确认邮箱服务商支持POP3协议

### 日志记录
所有POP3操作都会记录详细日志，包括：
- 连接状态变化
- 认证过程
- 邮件获取过程
- 错误信息

## 性能优化

### 缓存策略
- **连接缓存**: 避免频繁连接
- **邮件缓存**: 缓存获取的邮件数据
- **失败缓存**: 缓存失败结果避免重复尝试

### 建议
1. **合理设置limit**: 避免一次获取过多邮件
2. **使用时间过滤**: 减少不必要的邮件处理
3. **监控日志**: 及时发现和解决问题

## 兼容性

### API兼容性
- 所有现有API接口保持兼容
- 只需添加`protocol`参数即可使用POP3
- 返回数据格式完全一致

### 功能兼容性
- 发票检测功能完全兼容
- 缓存机制统一
- 错误处理一致