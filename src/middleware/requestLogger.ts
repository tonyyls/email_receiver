import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';

/**
 * 请求日志中间件
 */
export const requestLogger = (req: Request, res: Response, next: NextFunction): void => {
  const startTime = Date.now();
  const { method, url, ip } = req;
  
  // 记录请求开始
  logger.info('请求开始', {
    method,
    url,
    ip,
    userAgent: req.headers['user-agent'],
    contentType: req.headers['content-type']
  });

  // 监听响应结束事件
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const { statusCode } = res;
    
    logger.info('请求完成', {
      method,
      url,
      ip,
      statusCode,
      duration: `${duration}ms`,
      contentLength: res.get('content-length') || 0
    });
  });

  next();
};