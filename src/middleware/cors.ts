import { Request, Response, NextFunction } from 'express';
import { config } from '../config';

/**
 * CORS 中间件
 */
export const corsHandler = (req: Request, res: Response, next: NextFunction): void => {
  // 设置允许的源
  const allowedOrigins = config.server.corsOrigin.split(',').map(origin => origin.trim());
  const origin = req.headers.origin;

  // 支持代理域名
  if (origin && allowedOrigins.includes(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  } else {
    // 如果是通过代理访问，检查 X-Forwarded-Host 头
    const forwardedHost = req.headers['x-forwarded-host'] as string;
    if (forwardedHost) {
      const forwardedOrigin = `https://${forwardedHost}`;
      if (allowedOrigins.includes(forwardedOrigin) || allowedOrigins.includes('*')) {
        res.setHeader('Access-Control-Allow-Origin', forwardedOrigin);
      }
    }
  }

  // 设置允许的方法
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');

  // 设置允许的头部 - 添加代理相关头部
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With, X-Forwarded-For, X-Forwarded-Proto, X-Forwarded-Host');

  // 设置允许携带凭证
  res.setHeader('Access-Control-Allow-Credentials', 'true');

  // 处理预检请求
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  next();
};