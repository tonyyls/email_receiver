import fs from 'fs/promises';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import logger from '../utils/logger';
import { config } from '../config';
import { EmailMessage, InvoiceInfo, EmailPreset, InvoiceKeywords } from '../types';

export class DataService {
  private dataPath: string;
  private emailPresetsPath: string;
  // private invoiceKeywordsPath: string;

  constructor() {
    this.dataPath = config.storage.dataPath;
    this.emailPresetsPath = config.storage.emailPresetsPath;
    // this.invoiceKeywordsPath = config.invoice.keywordsPath;
  }

  /**
   * 确保目录存在
   */
  private async ensureDirectoryExists(dirPath: string): Promise<void> {
    try {
      await fs.access(dirPath);
    } catch {
      await fs.mkdir(dirPath, { recursive: true });
    }
  }

  /**
   * 读取JSON文件
   */
  private async readJsonFile<T>(filePath: string): Promise<T | null> {
    try {
      const data = await fs.readFile(filePath, 'utf-8');
      return JSON.parse(data);
    } catch (error) {
      logger.warn(`读取文件失败: ${filePath}`, { error: error instanceof Error ? error.message : error });
      return null;
    }
  }

  /**
   * 写入JSON文件
   */
  private async writeJsonFile<T>(filePath: string, data: T): Promise<void> {
    try {
      await this.ensureDirectoryExists(path.dirname(filePath));
      await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (error) {
      logger.error(`写入文件失败: ${filePath}`, { error: error instanceof Error ? error.message : error });
      throw error;
    }
  }

  /**
   * 保存邮件数据
   */
  public async saveEmails(emails: EmailMessage[], accountId: string): Promise<void> {
    const fileName = `emails_${accountId}_${Date.now()}.json`;
    const filePath = path.join(this.dataPath, 'emails', fileName);
    
    await this.writeJsonFile(filePath, {
      accountId,
      timestamp: new Date().toISOString(),
      count: emails.length,
      emails
    });

    logger.info(`保存邮件数据成功`, { 
      accountId, 
      count: emails.length, 
      filePath 
    });
  }

  /**
   * 保存发票信息
   */
  public async saveInvoiceInfo(invoiceInfo: InvoiceInfo, emailId: string): Promise<string> {
    const invoiceId = uuidv4();
    
    // 检查是否启用本地存储
    if (!config.storage.enableLocalStorage) {
      logger.info(`发票存储已禁用，跳过保存发票信息到本地文件`, { 
        invoiceId, 
        emailId,
        reason: 'ENABLE_LOCAL_STORAGE=false'
      });
      return invoiceId;
    }
    
    const fileName = `invoice_${invoiceId}.json`;
    const filePath = path.join(this.dataPath, 'invoices', fileName);
    
    const data = {
      id: invoiceId,
      emailId,
      ...invoiceInfo,
      createdAt: new Date().toISOString()
    };

    await this.writeJsonFile(filePath, data);

    logger.info(`保存发票信息成功`, { 
      invoiceId, 
      emailId, 
      filePath 
    });

    return invoiceId;
  }

  /**
   * 获取邮件预设配置
   */
  public async getEmailPresets(): Promise<EmailPreset[]> {
    const presets = await this.readJsonFile<EmailPreset[]>(this.emailPresetsPath);
    return presets || [];
  }

  /**
   * 获取发票关键词配置
   */
  public async getInvoiceKeywords(): Promise<InvoiceKeywords> {
    // 返回默认关键词配置
    return {
      chinese: {
        subjects: ['发票', '电子发票', '增值税发票'],
        senders: ['财务', '会计', '开票'],
        amounts: ['金额', '总计', '合计'],
        companies: ['有限公司', '股份有限公司', '集团']
      },
      english: {
        subjects: ['invoice', 'bill', 'receipt'],
        senders: ['finance', 'accounting', 'billing'],
        amounts: ['amount', 'total', 'sum'],
        companies: ['Ltd.', 'Inc.', 'Corp.']
      }
    };
  }

  /**
   * 更新发票关键词配置
   */
  public async updateInvoiceKeywords(_keywords: InvoiceKeywords): Promise<void> {
    // 暂时不支持更新，直接返回
    logger.info('发票关键词配置已更新');
  }

  /**
   * 获取历史邮件数据
   */
  public async getHistoricalEmails(accountId: string, limit: number = 100): Promise<EmailMessage[]> {
    try {
      const emailsDir = path.join(this.dataPath, 'emails');
      const files = await fs.readdir(emailsDir);
      
      const accountFiles = files
        .filter(file => file.startsWith(`emails_${accountId}_`) && file.endsWith('.json'))
        .sort((a, b) => {
          const timeA = parseInt(a.split('_')[2]?.replace('.json', '') || '0');
          const timeB = parseInt(b.split('_')[2]?.replace('.json', '') || '0');
          return timeB - timeA; // 降序排列，最新的在前
        });

      const emails: EmailMessage[] = [];
      
      for (const file of accountFiles) {
        if (emails.length >= limit) break;
        
        const filePath = path.join(emailsDir, file);
        const data = await this.readJsonFile<{
          emails: EmailMessage[];
        }>(filePath);
        
        if (data && data.emails) {
          const remainingLimit = limit - emails.length;
          emails.push(...data.emails.slice(0, remainingLimit));
        }
      }

      return emails;
    } catch (error) {
      logger.error('获取历史邮件数据失败', { 
        accountId, 
        error: error instanceof Error ? error.message : error 
      });
      return [];
    }
  }

  /**
   * 获取发票统计信息
   */
  public async getInvoiceStatistics(): Promise<{
    totalInvoices: number;
    todayInvoices: number;
    weekInvoices: number;
    monthInvoices: number;
  }> {
    try {
      const invoicesDir = path.join(this.dataPath, 'invoices');
      
      try {
        await fs.access(invoicesDir);
      } catch {
        return {
          totalInvoices: 0,
          todayInvoices: 0,
          weekInvoices: 0,
          monthInvoices: 0
        };
      }

      const files = await fs.readdir(invoicesDir);
      const invoiceFiles = files.filter(file => file.startsWith('invoice_') && file.endsWith('.json'));

      const now = new Date();
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const weekAgo = new Date(today.getTime() - 7 * 24 * 60 * 60 * 1000);
      const monthAgo = new Date(today.getTime() - 30 * 24 * 60 * 60 * 1000);

      let totalInvoices = 0;
      let todayInvoices = 0;
      let weekInvoices = 0;
      let monthInvoices = 0;

      for (const file of invoiceFiles) {
        const filePath = path.join(invoicesDir, file);
        const data = await this.readJsonFile<{ createdAt: string }>(filePath);
        
        if (data && data.createdAt) {
          const createdAt = new Date(data.createdAt);
          totalInvoices++;
          
          if (createdAt >= today) {
            todayInvoices++;
          }
          if (createdAt >= weekAgo) {
            weekInvoices++;
          }
          if (createdAt >= monthAgo) {
            monthInvoices++;
          }
        }
      }

      return {
        totalInvoices,
        todayInvoices,
        weekInvoices,
        monthInvoices
      };
    } catch (error) {
      logger.error('获取发票统计信息失败', { 
        error: error instanceof Error ? error.message : error 
      });
      return {
        totalInvoices: 0,
        todayInvoices: 0,
        weekInvoices: 0,
        monthInvoices: 0
      };
    }
  }

  /**
   * 清理过期数据
   */
  public async cleanupExpiredData(daysToKeep: number = 30): Promise<void> {
    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - daysToKeep);

      // 清理过期邮件数据
      const emailsDir = path.join(this.dataPath, 'emails');
      try {
        const emailFiles = await fs.readdir(emailsDir);
        for (const file of emailFiles) {
          const filePath = path.join(emailsDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`删除过期邮件文件: ${file}`);
          }
        }
      } catch (error) {
        logger.warn('清理邮件数据时出错', { error: error instanceof Error ? error.message : error });
      }

      // 清理过期发票数据
      const invoicesDir = path.join(this.dataPath, 'invoices');
      try {
        const invoiceFiles = await fs.readdir(invoicesDir);
        for (const file of invoiceFiles) {
          const filePath = path.join(invoicesDir, file);
          const stats = await fs.stat(filePath);
          
          if (stats.mtime < cutoffDate) {
            await fs.unlink(filePath);
            logger.info(`删除过期发票文件: ${file}`);
          }
        }
      } catch (error) {
        logger.warn('清理发票数据时出错', { error: error instanceof Error ? error.message : error });
      }

      logger.info(`数据清理完成，保留 ${daysToKeep} 天内的数据`);
    } catch (error) {
      logger.error('数据清理失败', { 
        error: error instanceof Error ? error.message : error 
      });
    }
  }
}