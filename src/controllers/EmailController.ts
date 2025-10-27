import { Request, Response } from 'express';
import { EmailService } from '../services/EmailService';
import { InvoiceService } from '../services/InvoiceService';
// import { DataService } from '../services/DataService';
import logger from '../utils/logger';
import { EmailMessage, ApiResponse } from '../types';
import { validateEmailConfig, validateEmailQuery, validateInvoiceDetection } from '../utils/validation';

export class EmailController {
  private emailService: EmailService;
  private invoiceService: InvoiceService;

  constructor() {
    this.emailService = new EmailService();
    this.invoiceService = new InvoiceService();
  }

  /**
   * 测试邮箱连接
   */
  public testConnection = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('开始测试邮箱连接', { body: req.body });

      const { error, value } = validateEmailConfig(req.body);
      if (error) {
        const response: ApiResponse<null> = {
          success: false,
          message: `参数验证失败: ${error}`,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.emailService.testConnection(value!);
      
      const response: ApiResponse<typeof result> = {
        success: result.success,
        message: result.message,
        data: result
      };

      res.status(result.success ? 200 : 400).json(response);
      
      logger.info('邮箱连接测试完成', { 
        success: result.success, 
        email: value!.email_address 
      });

    } catch (error) {
      logger.error('邮箱连接测试失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '邮箱连接测试失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 获取邮件列表
   */
  public fetchEmails = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('开始获取邮件列表', { body: req.body });

      const { error, value } = validateEmailQuery(req.body);
      if (error) {
        const response: ApiResponse<null> = {
          success: false,
          message: `参数验证失败: ${error}`,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      const result = await this.emailService.fetchEmails(value!);
      
      const response: ApiResponse<typeof result> = {
        success: result.success,
        message: result.message,
        data: result
      };

      res.status(result.success ? 200 : 400).json(response);
      
      logger.info('邮件列表获取完成', { 
        success: result.success, 
        count: result.success ? result.emails?.length : 0,
        email: value!.email_address 
      });

    } catch (error) {
      logger.error('获取邮件列表失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '获取邮件列表失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 发票邮件检测
   */
  public detectInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('开始发票邮件检测', { emailCount: req.body.emails?.length });

      const { error, value } = validateInvoiceDetection(req.body);
      if (error) {
        const response: ApiResponse<null> = {
          success: false,
          message: `参数验证失败: ${error}`,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      const emails: EmailMessage[] = value!.emails;
      const results: any[] = [];

      for (const email of emails) {
        const detectionResult = await this.invoiceService.detectSingleInvoice(email);
        results.push(detectionResult);
      }

      const invoiceEmails = results.filter(result => result.isInvoice).map(result => result.email);
      
      const response: ApiResponse<{
        total: number;
        invoiceCount: number;
        results: any[];
      }> = {
        success: true,
        message: `发票检测完成，共检测到 ${invoiceEmails.length} 封发票邮件`,
        data: {
          total: results.length,
          invoiceCount: invoiceEmails.length,
          results
        }
      };

      res.status(200).json(response);
      
      logger.info('发票邮件检测完成', { 
        total: results.length,
        invoiceCount: invoiceEmails.length
      });

    } catch (error) {
      logger.error('发票邮件检测失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '发票邮件检测失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 获取邮件并检测发票（组合接口）
   */
  public fetchAndDetectInvoices = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('开始获取邮件并检测发票', { body: req.body });

      const { error, value } = validateEmailQuery(req.body);
      if (error) {
        const response: ApiResponse<null> = {
          success: false,
          message: `参数验证失败: ${error}`,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      // 1. 获取邮件
      const emailResult = await this.emailService.fetchEmails(value!);
      if (!emailResult.success || !emailResult.emails) {
        const response: ApiResponse<null> = {
          success: false,
          message: emailResult.message,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      // 2. 检测发票
      const results: any[] = [];
      for (const email of emailResult.emails) {
        const detectionResult = await this.invoiceService.detectSingleInvoice(email);
        results.push(detectionResult);
      }

      const invoiceEmails = results.filter(result => result.isInvoice).map(result => result.email);
      
      const response: ApiResponse<{
        total: number;
        invoiceCount: number;
        results: any[];
        fetchInfo: {
          totalFetched: number;
          fetchMessage: string;
        };
      }> = {
        success: true,
        message: `操作完成，共获取 ${emailResult.emails.length} 封邮件，检测到 ${invoiceEmails.length} 封发票邮件`,
        data: {
          total: results.length,
          invoiceCount: invoiceEmails.length,
          results,
          fetchInfo: {
            totalFetched: emailResult.emails.length,
            fetchMessage: emailResult.message
          }
        }
      };

      res.status(200).json(response);
      
      logger.info('获取邮件并检测发票完成', { 
        totalFetched: emailResult.emails.length,
        invoiceCount: invoiceEmails.length,
        email: value!.email_address
      });

    } catch (error) {
      logger.error('获取邮件并检测发票失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '获取邮件并检测发票失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 获取发票邮件（只返回检测到的发票邮件）
   */
  public fetchInvoiceEmails = async (req: Request, res: Response): Promise<void> => {
    try {
      logger.info('开始获取发票邮件', { body: req.body });

      const { error, value } = validateEmailQuery(req.body);
      if (error) {
        const response: ApiResponse<null> = {
          success: false,
          message: `参数验证失败: ${error}`,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      // 1. 获取邮件
      const emailResult = await this.emailService.fetchEmails(value!);
      if (!emailResult.success || !emailResult.emails) {
        const response: ApiResponse<null> = {
          success: false,
          message: emailResult.message,
          data: null
        };
        res.status(400).json(response);
        return;
      }

      // 2. 检测发票并只保留发票邮件
      const invoiceEmails: any[] = [];
      for (const email of emailResult.emails) {
        const detectionResult = await this.invoiceService.detectSingleInvoice(email);
        if (detectionResult.isInvoice) {
          invoiceEmails.push(detectionResult);
        }
      }

      const response: ApiResponse<{
        total: number;
        invoiceCount: number;
        invoiceEmails: any[];
        fetchInfo: {
          totalFetched: number;
          fetchMessage: string;
        };
      }> = {
        success: true,
        message: `操作完成，共获取 ${emailResult.emails.length} 封邮件，检测到 ${invoiceEmails.length} 封发票邮件`,
        data: {
          total: emailResult.emails.length,
          invoiceCount: invoiceEmails.length,
          invoiceEmails,
          fetchInfo: {
            totalFetched: emailResult.emails.length,
            fetchMessage: emailResult.message
          }
        }
      };

      res.status(200).json(response);
      
      logger.info('获取发票邮件完成', { 
        totalFetched: emailResult.emails.length,
        invoiceCount: invoiceEmails.length,
        email: value!.email_address
      });

    } catch (error) {
      logger.error('获取发票邮件失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '获取发票邮件失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 获取发票关键词配置
   */
  public getInvoiceKeywords = async (_req: Request, res: Response): Promise<void> => {
    try {
      const keywords = await this.invoiceService.getInvoiceKeywords();
      
      const response: ApiResponse<typeof keywords> = {
        success: true,
        message: '获取发票关键词配置成功',
        data: keywords
      };

      res.status(200).json(response);
      
    } catch (error) {
      logger.error('获取发票关键词配置失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '获取发票关键词配置失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 更新发票关键词配置
   */
  public updateInvoiceKeywords = async (req: Request, res: Response): Promise<void> => {
    try {
      const keywords = req.body;
      await this.invoiceService.updateInvoiceKeywords(keywords);
      
      const response: ApiResponse<null> = {
        success: true,
        message: '更新发票关键词配置成功',
        data: null
      };

      res.status(200).json(response);
      
      logger.info('发票关键词配置已更新');
      
    } catch (error) {
      logger.error('更新发票关键词配置失败', { error: error instanceof Error ? error.message : error });
      
      const response: ApiResponse<null> = {
        success: false,
        message: '更新发票关键词配置失败',
        data: null
      };
      
      res.status(500).json(response);
    }
  };

  /**
   * 健康检查
   */
  public healthCheck = async (_req: Request, res: Response): Promise<void> => {
    const response: ApiResponse<{
      status: string;
      timestamp: string;
      version: string;
    }> = {
      success: true,
      message: '服务运行正常',
      data: {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    };

    res.status(200).json(response);
  };
}