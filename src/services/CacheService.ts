import logger from '../utils/logger';
// import { EmailMessage, InvoiceDetectionResult } from '../types';

/**
 * 简单的内存缓存服务
 */
export class CacheService {
  private cache: Map<string, {
    data: any;
    expireTime: number;
  }>;
  private defaultTTL: number; // 默认过期时间（毫秒）

  constructor(defaultTTL: number = 5 * 60 * 1000) { // 默认5分钟
    this.cache = new Map();
    this.defaultTTL = defaultTTL;
    
    // 定期清理过期缓存
    setInterval(() => {
      this.cleanup();
    }, 60 * 1000); // 每分钟清理一次
  }

  /**
   * 设置缓存
   */
  public set<T>(key: string, data: T, ttl?: number): void {
    const expireTime = Date.now() + (ttl || this.defaultTTL);
    this.cache.set(key, { data, expireTime });
    
    logger.debug('缓存已设置', { key, ttl: ttl || this.defaultTTL });
  }

  /**
   * 获取缓存
   */
  public get<T>(key: string): T | null {
    const item = this.cache.get(key);
    
    if (!item) {
      return null;
    }

    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      logger.debug('缓存已过期', { key });
      return null;
    }

    logger.debug('缓存命中', { key });
    return item.data as T;
  }

  /**
   * 删除缓存
   */
  public delete(key: string): boolean {
    const result = this.cache.delete(key);
    if (result) {
      logger.debug('缓存已删除', { key });
    }
    return result;
  }

  /**
   * 清空所有缓存
   */
  public clear(): void {
    this.cache.clear();
    logger.info('所有缓存已清空');
  }

  /**
   * 检查缓存是否存在
   */
  public has(key: string): boolean {
    const item = this.cache.get(key);
    
    if (!item) {
      return false;
    }

    if (Date.now() > item.expireTime) {
      this.cache.delete(key);
      return false;
    }

    return true;
  }

  /**
   * 获取缓存统计信息
   */
  public getStats(): {
    totalKeys: number;
    expiredKeys: number;
    memoryUsage: string;
  } {
    let expiredKeys = 0;
    const now = Date.now();

    for (const [, item] of this.cache.entries()) {
      if (now > item.expireTime) {
        expiredKeys++;
      }
    }

    return {
      totalKeys: this.cache.size,
      expiredKeys,
      memoryUsage: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`
    };
  }

  /**
   * 清理过期缓存
   */
  private cleanup(): void {
    const now = Date.now();
    let cleanedCount = 0;

    for (const [key, item] of this.cache.entries()) {
      if (now > item.expireTime) {
        this.cache.delete(key);
        cleanedCount++;
      }
    }

    if (cleanedCount > 0) {
      logger.debug('清理过期缓存', { cleanedCount });
    }
  }

  /**
   * 生成邮件连接测试的缓存键
   */
  public static getConnectionTestKey(email: string, server: string, port: number): string {
    return `connection_test:${email}:${server}:${port}`;
  }

  /**
   * 生成邮件获取的缓存键
   */
  public static getEmailFetchKey(email: string, mailbox: string, limit: number, from?: string, since?: string): string {
    const params = [email, mailbox, limit.toString()];
    if (from) params.push(`from:${from}`);
    if (since) params.push(`since:${since}`);
    return `email_fetch:${params.join(':')}`;
  }

  /**
   * 生成发票检测的缓存键
   */
  public static getInvoiceDetectionKey(emailId: string): string {
    return `invoice_detection:${emailId}`;
  }

  /**
   * 生成发票关键词的缓存键
   */
  public static getInvoiceKeywordsKey(): string {
    return 'invoice_keywords';
  }
}

// 创建全局缓存实例
export const cacheService = new CacheService();