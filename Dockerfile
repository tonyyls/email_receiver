# 生产环境镜像
FROM node:18-alpine

# 安装 dumb-init 用于信号处理
RUN apk add --no-cache dumb-init

# 创建非 root 用户
RUN addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

# 设置工作目录
WORKDIR /app

# 复制 package 文件（用于运行时信息）
COPY --chown=nextjs:nodejs package*.json ./

# 复制 node_modules（包含所有依赖）
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

# 健康检查
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD node -e "const http = require('http'); \
    const options = { hostname: 'localhost', port: 3000, path: '/api/health', timeout: 2000 }; \
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