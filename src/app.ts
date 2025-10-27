import express from 'express';
import { config } from './config';
import logger from './utils/logger';
import { corsHandler } from './middleware/cors';
import { requestLogger } from './middleware/requestLogger';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';
import routes from './routes';

/**
 * 创建 Express 应用
 */
export function createApp(): express.Application {
  const app = express();

  // 信任代理设置 - 重要：支持 nginx 代理
  app.set('trust proxy', true);

  // 基础中间件
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // CORS 处理
  app.use(corsHandler);

  // 请求日志
  app.use(requestLogger);

  // API 路由
  app.use(config.server.apiPrefix, routes);

  // 根路径健康检查
  app.get('/', (_req, res) => {
    res.json({
      success: true,
      message: '邮件接收服务运行正常',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });
  });

  // 404 处理
  app.use(notFoundHandler);

  // 全局错误处理
  app.use(errorHandler);

  return app;
}

/**
 * 启动服务器
 */
export function startServer(): void {
  const app = createApp();
  const port = config.server.port;
  const host = config.server.host || '0.0.0.0'; // 监听所有接口

  app.listen(port, host, () => {
    logger.info(`邮件接收服务已启动`, {
      port,
      host,
      env: config.server.nodeEnv,
      apiPrefix: config.server.apiPrefix,
      localStorage: config.storage.enableLocalStorage,
      trustProxy: true
    });
    
    console.log(`🚀 服务器已启动在 ${host}:${port}`);
    console.log(`📧 API 接口前缀: ${config.server.apiPrefix}`);
    console.log(`🌍 环境: ${config.server.nodeEnv}`);
    console.log(`📝 日志级别: ${config.logging.level}`);
    console.log(`💾 本地存储: ${config.storage.enableLocalStorage ? '启用' : '禁用'}`);
    console.log(`🔒 代理信任: 已启用`);
  });

  // 优雅关闭处理
  process.on('SIGTERM', () => {
    logger.info('收到 SIGTERM 信号，正在关闭服务器...');
    process.exit(0);
  });

  process.on('SIGINT', () => {
    logger.info('收到 SIGINT 信号，正在关闭服务器...');
    process.exit(0);
  });

  // 未捕获异常处理
  process.on('uncaughtException', (error) => {
    logger.error('未捕获的异常', { error: error.message, stack: error.stack });
    process.exit(1);
  });

  process.on('unhandledRejection', (reason, promise) => {
    logger.error('未处理的 Promise 拒绝', { reason, promise });
    process.exit(1);
  });
}