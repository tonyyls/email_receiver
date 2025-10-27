import { Request, Response, NextFunction } from 'express';
import logger from '../utils/logger';
import { ApiResponse } from '../types';

/**
 * 全局错误处理中间件
 */
export const errorHandler = (
  error: Error,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  logger.error('未处理的错误', {
    error: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    body: req.body,
    params: req.params,
    query: req.query
  });

  const response: ApiResponse<null> = {
    success: false,
    message: process.env['NODE_ENV'] === 'production' ? '服务器内部错误' : error.message,
    data: null
  };

  res.status(500).json(response);
};

/**
 * 404 错误处理中间件
 */
export const notFoundHandler = (
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const response: ApiResponse<null> = {
    success: false,
    message: `接口 ${req.method} ${req.url} 不存在`,
    data: null
  };

  res.status(404).json(response);
};

/**
 * 异步路由错误捕获包装器
 */
export const asyncHandler = (fn: Function) => {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};