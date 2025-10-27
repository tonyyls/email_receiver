import moment from 'moment';
import { v4 as uuidv4 } from 'uuid';
import config from '../config';
import { EmailMessage, InvoiceInfo, InvoiceKeywords, InvoiceDetectionResult } from '../types';
import logger from '../utils/logger';
import { DataService } from './DataService';
import { CacheService } from './CacheService';

const cacheService = new CacheService();

export class InvoiceService {
  private keywords: InvoiceKeywords;
  private patterns: {
    invoiceNumber: RegExp;
    amount: RegExp;
    taxNumber: RegExp;
    date: RegExp;
    company: RegExp;
  };
  private scoreWeights: {
    subject: number;
    sender: number;
    content: number;
    attachment: number;
  };
  private confidenceThreshold: number;
  private dataService: DataService;

  constructor() {
    // 降低置信度阈值，提高识别率
    this.confidenceThreshold = 0.3; // 从0.5降低到0.3
    this.dataService = new DataService();
    
    // 调整权重配置，提高标题和附件的权重
    this.scoreWeights = {
      subject: 0.5,    // 提高标题权重
      sender: 0.2,     // 降低发件人权重
      content: 0.1,    // 降低内容权重
      attachment: 0.2  // 保持附件权重
    };
    
    this.patterns = {
      invoiceNumber: /(?:发票号码?[:：]?\s*([A-Z0-9]+))|(?:Invoice\s*(?:No\.?|Number)[:：]?\s*([A-Z0-9]+))/i,
      amount: /(?:金额|总计|合计|Amount|Total)[:：]?\s*[￥$¥]?([0-9,]+\.?\d*)/i,
      taxNumber: /(?:税号|Tax\s*ID)[:：]?\s*([0-9A-Z]+)/i,
      date: /(?:开票日期|Invoice\s*Date)[:：]?\s*(\d{4}[-/年]\d{1,2}[-/月]\d{1,2}日?)/i,
      company: /(?:开票方|发票抬头|Issuer)[:：]?\s*([^，,。.\n]+(?:有限公司|股份有限公司|集团|Ltd\.?|Inc\.?|Corp\.?))/i
    };
    this.keywords = this.getDefaultKeywords();
    
    logger.info('发票识别服务初始化', { 
      confidenceThreshold: this.confidenceThreshold,
      scoreWeights: this.scoreWeights 
    });
  }

  /**
   * 初始化正则表达式模式
   */


  /**
   * 检测单封邮件是否为发票
   */
  async detectSingleInvoice(email: EmailMessage): Promise<{
    emailId: string;
    email: EmailMessage;
    isInvoice: boolean;
    confidence: number;
    scores: {
      subject: number;
      sender: number;
      content: number;
      attachment: number;
    };
    invoiceInfo?: InvoiceInfo | null;
    detectedAt: string;
    error?: string;
  }> {
    const cacheKey = CacheService.getInvoiceDetectionKey(email.id);
    
    // 检查缓存
    const cachedResult = cacheService.get<any>(cacheKey);
    if (cachedResult) {
      logger.debug('使用缓存的发票检测结果', { emailId: email.id });
      return cachedResult;
    }

    try {
        // 计算各项得分
        const subjectScore = this.analyzeSubject(email.subject);
        const senderScore = this.analyzeSender(email.from);
        const contentScore = this.analyzeContent(email.body);
        const attachmentScore = this.analyzeAttachments(email);

      // 计算总分
      const totalScore = 
        subjectScore * this.scoreWeights.subject +
        senderScore * this.scoreWeights.sender +
        contentScore * this.scoreWeights.content +
        attachmentScore * this.scoreWeights.attachment;

      const isInvoice = totalScore >= this.confidenceThreshold;

      logger.info('发票检测详细结果', {
        emailId: email.id,
        subject: email.subject,
        from: email.from,
        scores: {
          subject: subjectScore,
          sender: senderScore,
          content: contentScore,
          attachment: attachmentScore
        },
        weights: this.scoreWeights,
        totalScore,
        confidenceThreshold: this.confidenceThreshold,
        isInvoice
      });

      // 提取发票信息
      let invoiceInfo: InvoiceInfo | null = null;
      if (isInvoice) {
        invoiceInfo = this.extractInvoiceInfo(email, totalScore);

        // 保存发票信息到存储
        if (invoiceInfo) {
          await this.dataService.saveInvoiceInfo(invoiceInfo, email.id);
        }
      }

      const result = {
        emailId: email.id,
        email: email,
        isInvoice,
        confidence: totalScore,
        scores: {
          subject: subjectScore,
          sender: senderScore,
          content: contentScore,
          attachment: attachmentScore
        },
        invoiceInfo,
        detectedAt: new Date().toISOString()
      };

      // 缓存检测结果（30分钟）
      cacheService.set(cacheKey, result, 30 * 60 * 1000);

      logger.info('发票检测完成', { 
        emailId: email.id,
        isInvoice,
        confidence: totalScore 
      });

      return result;

    } catch (error) {
      logger.error('发票检测失败', { 
        emailId: email.id,
        error: error instanceof Error ? error.message : error 
      });

      const result = {
        emailId: email.id,
        email: email,
        isInvoice: false,
        confidence: 0,
        scores: {
          subject: 0,
          sender: 0,
          content: 0,
          attachment: 0
        },
        invoiceInfo: null,
        detectedAt: new Date().toISOString(),
        error: error instanceof Error ? error.message : '检测失败'
      };

      // 缓存失败结果（5分钟）
      cacheService.set(cacheKey, result, 5 * 60 * 1000);

      return result;
    }
  }

  /**
   * 检测发票邮件
   */
  async detectInvoices(emails: EmailMessage[]): Promise<InvoiceDetectionResult> {
    try {
      const invoiceEmails: EmailMessage[] = [];

      for (const email of emails) {
        const detection = await this.analyzeEmail(email);
        
        if (detection.isInvoice && detection.confidenceScore >= config.invoice.confidenceThreshold) {
          // 标记为发票邮件
          email.isInvoice = true;
          invoiceEmails.push(email);
          
          logger.info('检测到发票邮件', {
            emailId: email.id,
            subject: email.subject,
            confidence: detection.confidenceScore
          });
        }
      }

      const details = invoiceEmails.map(email => ({
        emailId: email.id,
        isInvoice: true,
        subject: email.subject,
        confidence: 0.8
      }));

      return {
        invoices: invoiceEmails,
        count: invoiceEmails.length,
        details: details
      };

    } catch (error) {
      const err = error as Error;
      logger.error('发票检测失败', { error: err.message });
      
      return {
        invoices: [],
        count: 0,
        details: []
      };
    }
  }

  /**
   * 分析单封邮件
   */
  private async analyzeEmail(email: EmailMessage): Promise<{
    isInvoice: boolean;
    confidenceScore: number;
    invoiceInfo: InvoiceInfo;
  }> {
    // 计算各项得分
    const subjectScore = this.analyzeSubject(email.subject);
    const senderScore = this.analyzeSender(email.from);
    const contentScore = this.analyzeContent(email.body);
    const attachmentScore = this.analyzeAttachments(email);

    // 计算总体置信度
    const confidenceScore = 
      subjectScore * this.scoreWeights.subject +
      senderScore * this.scoreWeights.sender +
      contentScore * this.scoreWeights.content +
      attachmentScore * this.scoreWeights.attachment;

    // 提取发票信息
    const invoiceInfo = this.extractInvoiceInfo(email, confidenceScore);

    return {
      isInvoice: confidenceScore >= config.invoice.confidenceThreshold,
      confidenceScore,
      invoiceInfo
    };
  }

  /**
   * 分析邮件主题
   */
  private analyzeSubject(subject: string): number {
    if (!subject) {
      logger.debug('标题为空，返回0分', { subject });
      return 0;
    }

    const subjectLower = subject.toLowerCase();
    let score = 0;
    const foundKeywords: string[] = [];

    logger.debug('开始分析标题', { subject, subjectLower });

    // 检查中文关键词
    for (const keyword of this.keywords.chinese.subjects) {
      if (subject.includes(keyword)) {
        score += 0.5; // 提高中文关键词权重
        foundKeywords.push(`中文:${keyword}`);
        logger.debug('发现中文发票关键词', { keyword, subject });
      }
    }

    // 检查英文关键词
    for (const keyword of this.keywords.english.subjects) {
      if (subjectLower.includes(keyword.toLowerCase())) {
        score += 0.4; // 提高英文关键词权重
        foundKeywords.push(`英文:${keyword}`);
        logger.debug('发现英文发票关键词', { keyword, subject });
      }
    }

    // 额外检查常见发票关键词（防止配置文件缺失）
    const commonInvoiceKeywords = ['发票', '电子发票', '增值税发票', 'invoice', 'bill', 'receipt'];
    for (const keyword of commonInvoiceKeywords) {
      if (subject.includes(keyword) || subjectLower.includes(keyword.toLowerCase())) {
        score += 0.6; // 高权重
        foundKeywords.push(`常见:${keyword}`);
        logger.debug('发现常见发票关键词', { keyword, subject });
        break; // 避免重复计分
      }
    }

    const finalScore = Math.min(score, 1.0);
    logger.info('标题分析结果', { 
      subject, 
      score: finalScore, 
      foundKeywords,
      chineseKeywords: this.keywords.chinese.subjects,
      englishKeywords: this.keywords.english.subjects
    });
    return finalScore;
  }

  /**
   * 分析发件人
   */
  private analyzeSender(sender: string): number {
    if (!sender) {
      logger.debug('发件人为空，返回0分', { sender });
      return 0;
    }

    const senderLower = sender.toLowerCase();
    let score = 0;
    const foundKeywords: string[] = [];

    logger.debug('开始分析发件人', { sender, senderLower });

    // 检查发件人关键词
    const allSenderKeywords = [...this.keywords.chinese.senders, ...this.keywords.english.senders];
    for (const keyword of allSenderKeywords) {
      if (senderLower.includes(keyword.toLowerCase())) {
        score += 0.4;
        foundKeywords.push(keyword);
        logger.debug('发现发件人关键词', { keyword, sender });
      }
    }

    // 检查常见发票发送域名
    const invoiceDomains = [
      'tax.gov.cn', 'chinatax.gov.cn', 'taobao.com', 'tmall.com', 
      'jd.com', 'invoice', 'billing', 'finance'
    ];

    for (const domain of invoiceDomains) {
      if (senderLower.includes(domain)) {
        score += 0.6;
        foundKeywords.push(`域名:${domain}`);
        logger.debug('发现发票域名', { domain, sender });
        break;
      }
    }

    const finalScore = Math.min(score, 1.0);
    logger.info('发件人分析结果', { 
      sender, 
      score: finalScore, 
      foundKeywords,
      senderKeywords: allSenderKeywords
    });
    return finalScore;
  }

  /**
   * 分析邮件内容
   */
  private analyzeContent(content: string): number {
    if (!content) {
      logger.debug('邮件内容为空，返回0分', { content });
      return 0;
    }

    let score = 0;
    const contentLower = content.toLowerCase();
    const foundPatterns: string[] = [];

    logger.debug('开始分析邮件内容', { contentLength: content.length });

    // 检查发票号码
    if (this.patterns.invoiceNumber.test(content)) {
      score += 0.4;
      foundPatterns.push('发票号码');
      logger.debug('发现发票号码模式', { pattern: this.patterns.invoiceNumber.source });
    }

    // 检查金额信息
    if (this.patterns.amount.test(content)) {
      score += 0.3;
      foundPatterns.push('金额信息');
      logger.debug('发现金额模式', { pattern: this.patterns.amount.source });
    }

    // 检查税号
    if (this.patterns.taxNumber.test(content)) {
      score += 0.2;
      foundPatterns.push('税号');
      logger.debug('发现税号模式', { pattern: this.patterns.taxNumber.source });
    }

    // 检查日期
    if (this.patterns.date.test(content)) {
      score += 0.2;
      foundPatterns.push('日期');
      logger.debug('发现日期模式', { pattern: this.patterns.date.source });
    }

    // 检查公司名称
    if (this.patterns.company.test(content)) {
      score += 0.1;
      foundPatterns.push('公司名称');
      logger.debug('发现公司名称模式', { pattern: this.patterns.company.source });
    }

    // 检查金额关键词
    const allAmountKeywords = [...this.keywords.chinese.amounts, ...this.keywords.english.amounts];
    for (const keyword of allAmountKeywords) {
      if (content.includes(keyword) || contentLower.includes(keyword.toLowerCase())) {
        score += 0.1;
        foundPatterns.push(`金额关键词:${keyword}`);
        logger.debug('发现金额关键词', { keyword });
        break;
      }
    }

    const finalScore = Math.min(score, 1.0);
    logger.info('内容分析结果', { 
      contentLength: content.length,
      score: finalScore, 
      foundPatterns,
      amountKeywords: allAmountKeywords
    });
    return finalScore;
  }

  /**
   * 分析邮件附件
   */
  private analyzeAttachments(email: EmailMessage): number {
    if (!email.hasAttachments || !email.attachments || email.attachments.length === 0) {
      logger.debug('没有附件，返回0分', { hasAttachments: email.hasAttachments, attachmentCount: email.attachments?.length || 0 });
      return 0;
    }

    let score = 0;
    const foundAttachments: string[] = [];

    logger.debug('开始分析附件', { attachmentCount: email.attachments.length });

    for (const attachment of email.attachments) {
      const filename = attachment.filename?.toLowerCase() || '';
      const contentType = attachment.contentType?.toLowerCase() || '';
      
      logger.debug('分析单个附件', { filename, contentType });

      // 检查PDF文件
      if (contentType.includes('pdf') || filename.endsWith('.pdf')) {
        score += 0.8;
        foundAttachments.push(`PDF:${attachment.filename}`);
        logger.debug('发现PDF附件', { filename: attachment.filename });
      }
      
      // 检查发票相关文件名
      const invoiceFilenames = ['invoice', 'bill', 'receipt', '发票', '账单', '收据'];
      for (const keyword of invoiceFilenames) {
        if (filename.includes(keyword.toLowerCase())) {
          score += 0.6;
          foundAttachments.push(`发票文件名:${attachment.filename}`);
          logger.debug('发现发票相关文件名', { keyword, filename: attachment.filename });
          break;
        }
      }
      
      // 检查其他文档类型
      if (contentType.includes('word') || contentType.includes('excel') || 
          filename.endsWith('.doc') || filename.endsWith('.docx') || 
          filename.endsWith('.xls') || filename.endsWith('.xlsx')) {
        score += 0.3;
        foundAttachments.push(`文档:${attachment.filename}`);
        logger.debug('发现文档附件', { filename: attachment.filename, contentType });
      }
    }

    const finalScore = Math.min(score, 1.0);
    logger.info('附件分析结果', { 
      attachmentCount: email.attachments.length,
      score: finalScore, 
      foundAttachments
    });
    return finalScore;
  }

  /**
   * 提取发票信息
   */
  private extractInvoiceInfo(email: EmailMessage, confidenceScore: number): InvoiceInfo {
    const content = email.subject + ' ' + email.body;
    
    // 提取发票号码
    const invoiceNumberMatch = content.match(this.patterns.invoiceNumber);
    const invoiceNumber = invoiceNumberMatch ? invoiceNumberMatch[1] || invoiceNumberMatch[2] : undefined;

    // 提取金额
    const amountMatch = content.match(this.patterns.amount);
    const amount = amountMatch && amountMatch[1] ? parseFloat(amountMatch[1].replace(/,/g, '')) : undefined;

    // 提取日期
    const dateMatch = content.match(this.patterns.date);
    const invoiceDate = dateMatch ? moment(dateMatch[1], ['YYYY-MM-DD', 'YYYY/MM/DD', 'YYYY年MM月DD日']).toDate() : undefined;

    // 提取公司信息
    const companyMatches = content.match(this.patterns.company);
    const issuer = companyMatches ? companyMatches[0] : undefined;

    const invoiceInfo: InvoiceInfo = {
      emailId: email.id,
      confidenceScore,
      createdAt: new Date()
    };

    // 只有在有值时才添加可选属性
    if (uuidv4()) invoiceInfo.id = uuidv4();
    if (invoiceNumber) invoiceInfo.invoiceNumber = invoiceNumber;
    if (amount) {
      invoiceInfo.amount = amount;
      invoiceInfo.currency = 'CNY';
    }
    if (invoiceDate) invoiceInfo.invoiceDate = invoiceDate;
    if (issuer) invoiceInfo.issuer = issuer;

    return invoiceInfo;
  }

  /**
   * 更新发票关键词配置
   */
  public async updateInvoiceKeywords(keywords: InvoiceKeywords): Promise<void> {
    try {
      await this.dataService.updateInvoiceKeywords(keywords);
      
      // 清除缓存，强制重新加载
      const cacheKey = CacheService.getInvoiceKeywordsKey();
      cacheService.delete(cacheKey);
      
      logger.info('发票关键词配置已更新');
    } catch (error) {
      logger.error('更新发票关键词配置失败', { 
        error: error instanceof Error ? error.message : error 
      });
      throw error;
    }
  }

  /**
   * 获取当前关键词配置
   */
  getKeywords(): InvoiceKeywords {
    return this.keywords;
  }

  /**
   * 获取发票关键词配置
   */
  public async getInvoiceKeywords(): Promise<InvoiceKeywords> {
    const cacheKey = CacheService.getInvoiceKeywordsKey();
    
    // 检查缓存
    const cachedKeywords = cacheService.get<InvoiceKeywords>(cacheKey);
    if (cachedKeywords) {
      return cachedKeywords;
    }

    try {
      const keywords = await this.dataService.getInvoiceKeywords();
      
      // 缓存关键词配置（10分钟）
      cacheService.set(cacheKey, keywords, 10 * 60 * 1000);
      
      return keywords;
    } catch (error) {
      logger.warn('读取发票关键词配置失败，使用默认配置', { 
        error: error instanceof Error ? error.message : error 
      });
      
      const defaultKeywords = this.getDefaultKeywords();
      
      // 缓存默认配置（5分钟）
      cacheService.set(cacheKey, defaultKeywords, 5 * 60 * 1000);
      
      return defaultKeywords;
    }
  }

  /**
   * 获取默认关键词配置
   */
  private getDefaultKeywords(): InvoiceKeywords {
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
   * 获取发票统计信息
   */
  getInvoiceStats(invoices: InvoiceInfo[]): {
    totalCount: number;
    totalAmount: number;
    averageConfidence: number;
    dateRange: { start?: Date; end?: Date };
  } {
    if (invoices.length === 0) {
      return {
        totalCount: 0,
        totalAmount: 0,
        averageConfidence: 0,
        dateRange: {}
      };
    }

    const totalAmount = invoices.reduce((sum, invoice) => sum + (invoice.amount || 0), 0);
    const averageConfidence = invoices.reduce((sum, invoice) => sum + (invoice.confidenceScore || 0), 0) / invoices.length;
    
    const dates = invoices
      .map(invoice => invoice.invoiceDate)
      .filter((date): date is Date => date !== undefined)
      .sort((a, b) => a.getTime() - b.getTime());

    const result: {
      totalCount: number;
      totalAmount: number;
      averageConfidence: number;
      dateRange: { start?: Date; end?: Date };
    } = {
      totalCount: invoices.length,
      totalAmount,
      averageConfidence,
      dateRange: {}
    };

    if (dates.length > 0) {
      Object.assign(result.dateRange, {
        start: dates[0],
        end: dates[dates.length - 1]
      });
    }

    return result;
  }
}