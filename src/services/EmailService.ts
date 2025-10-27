import Imap from 'imap';
import POP3Client from 'poplib';
import { simpleParser, ParsedMail } from 'mailparser';
import { v4 as uuidv4 } from 'uuid';
import moment from 'moment';
import logger from '../utils/logger';
import { config } from '../config';
import { DataService } from './DataService';
import { CacheService, cacheService } from './CacheService';
import {
  EmailConfig,
  EmailQueryParams,
  EmailMessage,
  EmailAttachment,
  ConnectionTestResult,
  EmailFetchResult,
  ConnectionStatus,
  EmailProtocol,
  POP3Config
} from '../types';

export class EmailService {
  private imap: Imap | null = null;
  private pop3: any = null;
  private dataService: DataService;
  private currentProtocol: EmailProtocol = 'IMAP';

  constructor() {
    this.dataService = new DataService();
  }
  private connectionStatus: ConnectionStatus = ConnectionStatus.DISCONNECTED;

  /**
   * 测试邮箱连接
   */
  public async testConnection(emailConfig: EmailConfig): Promise<ConnectionTestResult> {
    const protocol = emailConfig.protocol || 'IMAP';
    const cacheKey = CacheService.getConnectionTestKey(
      emailConfig.email_address, 
      emailConfig.imap_server, 
      emailConfig.port
    );

    // 检查缓存
    const cachedResult = cacheService.get<ConnectionTestResult>(cacheKey);
    if (cachedResult) {
      logger.info('使用缓存的连接测试结果', { email: emailConfig.email_address, protocol });
      return cachedResult;
    }

    try {
      logger.info('开始测试邮箱连接', { email: emailConfig.email_address, protocol });

      if (protocol === 'POP3') {
        await this.connectPOP3(emailConfig);
        await this.disconnectPOP3();
      } else {
        await this.connectIMAP(emailConfig);
        await this.disconnectIMAP();
      }

      logger.info('邮箱连接测试成功', { email: emailConfig.email_address, protocol });
      
      const result: ConnectionTestResult = {
        success: true,
        message: `${protocol}邮箱连接测试成功`,
        server: emailConfig.imap_server,
        port: emailConfig.port,
        ssl: emailConfig.use_ssl
      };

      // 缓存成功结果（5分钟）
      cacheService.set(cacheKey, result, 5 * 60 * 1000);
      
      return result;
    } catch (error) {
      logger.error('邮箱连接测试失败', { 
        email: emailConfig.email_address,
        protocol,
        error: error instanceof Error ? error.message : error 
      });
      
      const result: ConnectionTestResult = {
        success: false,
        message: `${protocol}邮箱连接测试失败: ${error instanceof Error ? error.message : '未知错误'}`,
        server: emailConfig.imap_server,
        port: emailConfig.port,
        ssl: emailConfig.use_ssl
      };

      // 缓存失败结果（1分钟）
      cacheService.set(cacheKey, result, 1 * 60 * 1000);
      
      return result;
    }
  }

  /**
   * 连接到邮箱 (IMAP)
   */
  private async connectIMAP(emailConfig: EmailConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionStatus = ConnectionStatus.CONNECTING;
      this.currentProtocol = 'IMAP';
      
      this.imap = new Imap({
        user: emailConfig.email_address,
        password: emailConfig.password,
        host: emailConfig.imap_server,
        port: emailConfig.port,
        tls: emailConfig.use_ssl,
        tlsOptions: { rejectUnauthorized: false },
        connTimeout: config.imap.connectionTimeout,
        authTimeout: config.imap.authTimeout,
        keepalive: config.imap.keepalive,
      });

      this.imap.once('ready', () => {
        this.connectionStatus = ConnectionStatus.AUTHENTICATED;
        logger.info('IMAP连接已建立', { email: emailConfig.email_address });
        resolve();
      });

      this.imap.once('error', (err: Error) => {
        this.connectionStatus = ConnectionStatus.ERROR;
        logger.error('IMAP连接错误', { 
          email: emailConfig.email_address, 
          error: err.message 
        });
        reject(err);
      });

      this.imap.once('end', () => {
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        logger.info('IMAP连接已断开', { email: emailConfig.email_address });
      });

      try {
        this.imap.connect();
        this.connectionStatus = ConnectionStatus.CONNECTED;
      } catch (error) {
        this.connectionStatus = ConnectionStatus.ERROR;
        reject(error);
      }
    });
  }

  /**
   * 连接到邮箱 (POP3)
   */
  private async connectPOP3(emailConfig: EmailConfig): Promise<void> {
    return new Promise((resolve, reject) => {
      this.connectionStatus = ConnectionStatus.CONNECTING;
      this.currentProtocol = 'POP3';

      const pop3Config: POP3Config = {
        host: emailConfig.imap_server,
        port: emailConfig.port,
        username: emailConfig.email_address,
        password: emailConfig.password,
        enabletls: emailConfig.use_ssl,
        debug: false
      };

      this.pop3 = new POP3Client(pop3Config.port, pop3Config.host, {
        enabletls: pop3Config.enabletls,
        debug: pop3Config.debug
      });

      this.pop3.on('connect', () => {
        this.connectionStatus = ConnectionStatus.CONNECTED;
        logger.info('POP3连接已建立', { email: emailConfig.email_address });
        
        this.pop3.login(pop3Config.username, pop3Config.password);
      });

      this.pop3.on('login', (status: boolean, data: string) => {
        if (status) {
          this.connectionStatus = ConnectionStatus.AUTHENTICATED;
          logger.info('POP3认证成功', { email: emailConfig.email_address });
          resolve();
        } else {
          this.connectionStatus = ConnectionStatus.ERROR;
          logger.error('POP3认证失败', { email: emailConfig.email_address, data });
          reject(new Error(`POP3认证失败: ${data}`));
        }
      });

      this.pop3.on('error', (err: Error) => {
        this.connectionStatus = ConnectionStatus.ERROR;
        logger.error('POP3连接错误', { 
          email: emailConfig.email_address, 
          error: err.message 
        });
        reject(err);
      });

      this.pop3.on('quit', () => {
        this.connectionStatus = ConnectionStatus.DISCONNECTED;
        logger.info('POP3连接已断开', { email: emailConfig.email_address });
      });

      // POP3Client 构造函数会自动连接，不需要调用 connect() 方法
    });
  }

  /**
   * 断开IMAP连接
   */
  private disconnectIMAP(): void {
    if (this.imap) {
      this.imap.end();
      this.imap = null;
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
    }
  }

  /**
   * 断开POP3连接
   */
  private disconnectPOP3(): void {
    if (this.pop3) {
      this.pop3.quit();
      this.pop3 = null;
      this.connectionStatus = ConnectionStatus.DISCONNECTED;
    }
  }

  /**
   * 断开连接（通用方法）
   */
  private disconnect(): void {
    if (this.currentProtocol === 'POP3') {
      this.disconnectPOP3();
    } else {
      this.disconnectIMAP();
    }
  }

  /**
   * 获取邮件列表
   */
  public async fetchEmails(queryParams: EmailQueryParams): Promise<EmailFetchResult> {
    const protocol = queryParams.protocol || 'IMAP';
    const cacheKey = CacheService.getEmailFetchKey(
      queryParams.email_address,
      queryParams.mail_box || 'INBOX',
      queryParams.limit || 10,
      queryParams.from,
      queryParams.since
    );

    // 暂时禁用缓存以便调试
    // const cachedResult = cacheService.get(cacheKey) as EmailFetchResult | null;
    // if (cachedResult) {
    //   logger.info('使用缓存的邮件数据', { 
    //     email: queryParams.email_address,
    //     protocol,
    //     count: cachedResult.emails?.length || 0
    //   });
    //   return cachedResult;
    // }

    try {
      logger.info('开始获取邮件', { 
        email: queryParams.email_address,
        protocol,
        mailbox: queryParams.mail_box,
        limit: queryParams.limit 
      });

      if (protocol === 'POP3') {
        return await this.fetchEmailsPOP3(queryParams, cacheKey);
      } else {
        return await this.fetchEmailsIMAP(queryParams, cacheKey);
      }

    } catch (error) {
      await this.disconnect();
      
      logger.error('获取邮件失败', { 
        email: queryParams.email_address,
        protocol,
        error: error instanceof Error ? error.message : error 
      });
      
      const result: EmailFetchResult = {
        success: false,
        message: `获取邮件失败: ${error instanceof Error ? error.message : '未知错误'}`,
        emails: [],
        total: 0
      };

      // 不缓存失败结果，直接返回
      return result;
    }
  }

  /**
   * 使用IMAP获取邮件
   */
  private async fetchEmailsIMAP(queryParams: EmailQueryParams, cacheKey: string): Promise<EmailFetchResult> {
    await this.connectIMAP(queryParams);
    await this.openBox(queryParams.mail_box || 'INBOX');

    const searchCriteria = this.buildSearchCriteria(queryParams);
    const messageIds = await this.searchEmails(searchCriteria);

    if (messageIds.length === 0) {
      await this.disconnect();
      const result: EmailFetchResult = {
        success: true,
        message: '没有找到符合条件的邮件',
        emails: [],
        total: 0
      };
      
      // 缓存空结果（2分钟）
      cacheService.set(cacheKey, result, 2 * 60 * 1000);
      return result;
    }

    const limitedIds = messageIds.slice(0, queryParams.limit || 10);
    let emails = await this.fetchEmailDetails(limitedIds);

    // 如果有 since 参数，进行二次时间过滤
    if (queryParams.since) {
      const sinceTime = moment(queryParams.since, 'YYYY/MM/DD HH:mm');
      emails = emails.filter(email => {
        const emailTime = moment(email.date);
        return emailTime.isSameOrAfter(sinceTime);
      });
    }

    await this.disconnect();

    // 条件性保存邮件数据到存储
    if (config.storage.enableLocalStorage) {
      const accountId = this.generateAccountId(queryParams.email_address);
      await this.dataService.saveEmails(emails, accountId);
      logger.info('邮件已保存到本地存储', { 
        email: queryParams.email_address,
        count: emails.length 
      });
    } else {
      logger.info('本地存储已禁用，邮件仅保存在内存缓存中', { 
        email: queryParams.email_address,
        count: emails.length 
      });
    }

    logger.info('IMAP邮件获取完成', { 
      email: queryParams.email_address,
      count: emails.length,
      total: messageIds.length 
    });

    const result: EmailFetchResult = {
      success: true,
      message: `成功获取 ${emails.length} 封邮件`,
      emails,
      total: emails.length  // 修复：使用过滤后的实际邮件数量
    };

    // 缓存结果（3分钟）
    cacheService.set(cacheKey, result, 3 * 60 * 1000);

    return result;
  }

  /**
   * 使用POP3获取邮件
   */
  private async fetchEmailsPOP3(queryParams: EmailQueryParams, cacheKey: string): Promise<EmailFetchResult> {
    logger.info('fetchEmailsPOP3 开始', { queryParams });
    
    await this.connectPOP3(queryParams);

    return new Promise((resolve, reject) => {
      if (!this.pop3) {
        logger.error('POP3连接未建立');
        reject(new Error('POP3连接未建立'));
        return;
      }

      logger.info('POP3连接已建立，准备获取邮件列表');

      // 清除所有现有的 list 事件监听器，避免重复监听
      this.pop3.removeAllListeners('list');
      
      // 获取邮件列表
      logger.info('Calling pop3.list()');
      
      // 添加错误监听器来捕获可能的错误
      this.pop3.on('error', (error: Error) => {
        logger.error('POP3 error during list operation', { 
          error: error.message, 
          stack: error.stack 
        });
        reject(error);
      });
      
      this.pop3.list();

      // 根据 poplib 源码，list 事件的参数顺序是: (resp, msgcount, msgnumber, returnValue, data)
      this.pop3.on('list', async (resp: boolean, msgcount: number, msgnumber: number | undefined, returnValue: any, data: any) => {
        // 确保 data 是字符串类型，避免后续的字符串操作出错
        const dataStr = typeof data === 'string' ? data : String(data || '');
        
        logger.info('POP3 list event triggered', { 
          resp, 
          msgcount, 
          msgnumber,
          returnValueType: typeof returnValue,
          returnValueLength: returnValue ? Object.keys(returnValue).length : 0,
          returnValuePreview: returnValue ? JSON.stringify(returnValue).substring(0, 100) : 'null',
          dataType: typeof data,
          dataLength: dataStr.length,
          dataPreview: dataStr.substring(0, 100)
        });

        if (!resp) {
          await this.disconnect();
          reject(new Error(`获取邮件列表失败: ${dataStr}`));
          return;
        }

        try {
          // 根据POP3协议，list命令的响应格式是：
          // +OK 邮件数量 总大小
          // 1 1024
          // 2 2048
          // .
          
          // returnValue 包含解析后的邮件列表对象，data 是原始字符串
          // 我们可以直接使用 returnValue 或者解析 data
          let emailList: Array<{msgNumber: number, size: number}> = [];
          
          if (returnValue && Array.isArray(returnValue)) {
            // returnValue 是数组格式，索引对应邮件编号，值是邮件大小
            emailList = returnValue
              .map((size, index) => {
                // 跳过空项（索引0通常为空）
                if (index === 0 || !size) return null;
                return {
                  msgNumber: index,
                  size: parseInt(size) || 0
                };
              })
              .filter(item => item !== null) as Array<{msgNumber: number, size: number}>;
          } else if (returnValue && typeof returnValue === 'object' && !Array.isArray(returnValue)) {
            // 使用 returnValue（对象格式）
            emailList = Object.keys(returnValue).map(msgNum => ({
              msgNumber: parseInt(msgNum),
              size: parseInt(returnValue[msgNum])
            }));
          } else {
            // 回退到解析原始 data
            logger.info('Fallback to parsePOP3List', { dataType: typeof data, data });
            try {
              // 确保 data 是字符串类型再传递给 parsePOP3List
              const dataStr = typeof data === 'string' ? data : String(data || '');
              emailList = this.parsePOP3List(dataStr);
            } catch (error) {
              logger.error('parsePOP3List failed', { 
                error: (error as Error).message, 
                stack: (error as Error).stack,
                data,
                dataType: typeof data
              });
              emailList = [];
            }
          }
          
          if (emailList.length === 0) {
            await this.disconnect();
            const result: EmailFetchResult = {
              success: true,
              message: '没有找到符合条件的邮件',
              emails: [],
              total: 0
            };
            
            // 缓存空结果（2分钟）
            cacheService.set(cacheKey, result, 2 * 60 * 1000);
            resolve(result);
            return;
          }

          // 限制获取的邮件数量，从最新的开始
          const limit = queryParams.limit || 10;
          const limitedList = emailList.slice(-limit).reverse(); // 最新的邮件在前

          // 获取邮件详情
          const emails = await this.fetchPOP3EmailDetails(limitedList);

          // 客户端时间过滤
          let filteredEmails = emails;
          if (queryParams.since) {
            const sinceTime = moment(queryParams.since, 'YYYY/MM/DD HH:mm');
            
            // 检查日期是否有效
            if (!sinceTime.isValid()) {
              logger.warn('无效的since日期格式', { since: queryParams.since });
            } else {
              logger.info('时间过滤参数', { 
                since: queryParams.since,
                sinceTime: sinceTime.format(),
                currentTime: moment().format()
              });
              
              filteredEmails = emails.filter(email => {
                const emailTime = moment(email.date);
                const isAfterSince = emailTime.isSameOrAfter(sinceTime);
                logger.debug('邮件时间过滤', {
                  emailDate: emailTime.format(),
                  sinceDate: sinceTime.format(),
                  isAfterSince,
                  subject: email.subject
                });
                return isAfterSince;
              });
              
              logger.info('时间过滤结果', {
                originalCount: emails.length,
                filteredCount: filteredEmails.length,
                since: queryParams.since
              });
            }
          } else {
            // 默认获取今天的邮件
            const today = moment().startOf('day');
            filteredEmails = emails.filter(email => {
              const emailTime = moment(email.date);
              return emailTime.isSameOrAfter(today);
            });
            
            logger.info('默认时间过滤（今天）', {
              originalCount: emails.length,
              filteredCount: filteredEmails.length,
              todayStart: today.format()
            });
          }

          // 发件人过滤
          if (queryParams.from) {
            filteredEmails = filteredEmails.filter(email => 
              email.from.toLowerCase().includes(queryParams.from!.toLowerCase())
            );
          }

          // 收件人过滤
          if (queryParams.to) {
            filteredEmails = filteredEmails.filter(email => 
              email.to.toLowerCase().includes(queryParams.to!.toLowerCase())
            );
          }

          await this.disconnect();

          // 条件性保存邮件数据到存储
          if (config.storage.enableLocalStorage) {
            const accountId = this.generateAccountId(queryParams.email_address);
            await this.dataService.saveEmails(filteredEmails, accountId);
            logger.info('邮件已保存到本地存储', { 
              email: queryParams.email_address,
              count: filteredEmails.length 
            });
          } else {
            logger.info('本地存储已禁用，邮件仅保存在内存缓存中', { 
              email: queryParams.email_address,
              count: filteredEmails.length 
            });
          }

          logger.info('POP3邮件获取完成', { 
            email: queryParams.email_address,
            count: filteredEmails.length,
            total: emailList.length 
          });

          const result: EmailFetchResult = {
            success: true,
            message: `成功获取 ${filteredEmails.length} 封邮件`,
            emails: filteredEmails,
            total: filteredEmails.length  // 使用过滤后的实际邮件数量
          };

          // 缓存结果（3分钟）
          cacheService.set(cacheKey, result, 3 * 60 * 1000);

          resolve(result);

        } catch (error) {
          logger.error('POP3 list event error', { error: (error as Error).message, stack: (error as Error).stack });
          await this.disconnect();
          reject(error);
        }
      });

      this.pop3.on('error', async (err: Error) => {
        logger.error('POP3 error event', { error: err.message, stack: err.stack });
        await this.disconnect();
        reject(err);
      });
    });
  }

  /**
   * 解析POP3邮件列表
   */
  private parsePOP3List(rawData: any): Array<{msgNumber: number, size: number}> {
    try {
      let dataStr: string;
      
      // 更强健的类型检查和转换
      if (typeof rawData === 'string') {
        dataStr = rawData;
      } else if (Buffer.isBuffer(rawData)) {
        dataStr = rawData.toString('utf8');
      } else if (rawData && typeof rawData === 'object' && rawData.toString) {
        dataStr = rawData.toString();
      } else {
        dataStr = String(rawData || '');
      }
      
      logger.info('parsePOP3List input', { 
        type: typeof rawData, 
        isBuffer: Buffer.isBuffer(rawData),
        content: dataStr.substring(0, 200) 
      });
      
      if (!dataStr || typeof dataStr !== 'string') {
        logger.warn('parsePOP3List: invalid dataStr', { dataStr, type: typeof dataStr });
        return [];
      }
      
      // 确保 dataStr 是字符串类型再调用 split
      const lines = dataStr.split('\r\n');
      const emailList: Array<{msgNumber: number, size: number}> = [];

      for (const line of lines) {
        const match = line.match(/^(\d+)\s+(\d+)$/);
        if (match) {
          emailList.push({
            msgNumber: parseInt(match[1] || '0'),
            size: parseInt(match[2] || '0')
          });
        }
      }

      logger.info('parsePOP3List result', { 
        totalLines: lines.length,
        emailCount: emailList.length,
        emailList: emailList.slice(0, 3) // 只记录前3个
      });

      return emailList;
    } catch (error) {
      logger.error('parsePOP3List error', { error: (error as Error).message, rawData });
      return [];
    }
  }

  /**
   * 获取POP3邮件详情
   */
  private async fetchPOP3EmailDetails(emailList: Array<{msgNumber: number, size: number}>): Promise<EmailMessage[]> {
    const emails: EmailMessage[] = [];

    for (const emailInfo of emailList) {
      try {
        const emailContent = await this.retrievePOP3Email(emailInfo.msgNumber);
        const parsed = await simpleParser(emailContent);
        const emailMessage = this.parseEmailMessage(parsed, emailInfo.msgNumber);
        emails.push(emailMessage);
      } catch (error) {
        logger.error('POP3邮件解析失败', { 
          msgNumber: emailInfo.msgNumber, 
          error: (error as Error).message 
        });
      }
    }

    // 按日期倒序排列
    emails.sort((a, b) => b.date.getTime() - a.date.getTime());
    return emails;
  }

  /**
   * 获取单个POP3邮件内容
   */
  private async retrievePOP3Email(msgNumber: number): Promise<string> {
    return new Promise((resolve, reject) => {
      if (!this.pop3) {
        reject(new Error('POP3连接未建立'));
        return;
      }

      this.pop3.retr(msgNumber);

      this.pop3.on('retr', (status: boolean, _msgNumber: number, returnValue: any, rawData: any) => {
        if (status) {
          // 根据 poplib 源码，retr 事件的参数顺序是: (status, msgnumber, returnValue, rawData)
          // returnValue 是邮件内容，rawData 是完整的服务器响应
          let emailContent: string;
          if (typeof returnValue === 'string') {
            emailContent = returnValue;
          } else if (Buffer.isBuffer(returnValue)) {
            emailContent = returnValue.toString('utf8');
          } else if (returnValue && typeof returnValue === 'object' && returnValue.toString) {
            emailContent = returnValue.toString();
          } else {
            emailContent = String(returnValue || '');
          }
          resolve(emailContent);
        } else {
          // 使用 rawData 来获取错误信息，确保是字符串类型
          const errorMsg = typeof rawData === 'string' ? rawData : String(rawData || '');
          reject(new Error(`获取邮件内容失败: ${errorMsg}`));
        }
      });
    });
  }

  /**
   * 打开邮箱文件夹
   */
  private openBox(mailbox: string): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP连接未建立'));
        return;
      }

      this.imap.openBox(mailbox, true, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 构建搜索条件
   */
  private buildSearchCriteria(params: EmailQueryParams): any[] {
    const criteria: any[] = ['ALL'];

    // 发件人筛选
    if (params.from) {
      criteria.push(['FROM', params.from]);
    }

    // 收件人筛选
    if (params.to) {
      criteria.push(['TO', params.to]);
    }

    // 日期筛选
    if (params.since) {
      // 解析自定义格式的日期字符串 "YYYY/MM/DD HH:mm"
      // 由于 IMAP SINCE 只支持日期（忽略时间），我们使用该日期的开始时间
      // 然后在获取邮件后进行二次过滤
      const sinceDate = moment(params.since, 'YYYY/MM/DD HH:mm').startOf('day').toDate();
      criteria.push(['SINCE', sinceDate]);
    } else {
      // 默认获取今天的邮件
      const today = moment().startOf('day').toDate();
      criteria.push(['SINCE', today]);
    }

    return criteria.length > 1 ? criteria.slice(1) : criteria;
  }

  /**
   * 搜索邮件
   */
  private searchEmails(criteria: any[]): Promise<number[]> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP连接未建立'));
        return;
      }

      this.imap.search(criteria, (err, uids) => {
        if (err) {
          reject(err);
        } else {
          // 按时间倒序排列（最新的在前）
          resolve(uids.reverse());
        }
      });
    });
  }

  /**
   * 获取邮件详情
   */
  private async fetchEmailDetails(uids: number[]): Promise<EmailMessage[]> {
    return new Promise((resolve, reject) => {
      if (!this.imap) {
        reject(new Error('IMAP连接未建立'));
        return;
      }

      const emails: EmailMessage[] = [];
      const fetch = this.imap.fetch(uids, {
        bodies: '',
        struct: true,
      });

      fetch.on('message', (msg, seqno) => {
        let buffer = '';
        
        msg.on('body', (stream) => {
          stream.on('data', (chunk) => {
            buffer += chunk.toString('utf8');
          });
        });

        msg.once('end', async () => {
          try {
            const parsed = await simpleParser(buffer);
            const emailMessage = this.parseEmailMessage(parsed, seqno);
            emails.push(emailMessage);
          } catch (error) {
            logger.error('邮件解析失败', { seqno, error: (error as Error).message });
          }
        });
      });

      fetch.once('error', (err) => {
        reject(err);
      });

      fetch.once('end', () => {
        // 按日期倒序排列
        emails.sort((a, b) => b.date.getTime() - a.date.getTime());
        resolve(emails);
      });
    });
  }

  /**
   * 解析邮件消息
   */
  private parseEmailMessage(parsed: ParsedMail, seqno: number): EmailMessage {
    const attachments: EmailAttachment[] = [];
    
    if (parsed.attachments && parsed.attachments.length > 0) {
      for (const attachment of parsed.attachments) {
        if (attachment.size <= config.email.attachmentSizeLimit) {
          attachments.push({
            filename: attachment.filename || 'unknown',
            contentType: attachment.contentType,
            size: attachment.size,
            content: attachment.content,
          });
        }
      }
    }

    const subject = parsed.subject || '';
    const body = parsed.text || parsed.html || '';
    const from = this.extractEmailAddress(parsed.from);
    const to = this.extractEmailAddress(parsed.to);
    const date = parsed.date || new Date();
    const messageId = parsed.messageId || `seq-${seqno}`;

    return {
      id: uuidv4(),
      messageId,
      from,
      to,
      subject,
      title: subject, // 添加title字段，与subject保持一致
      body,
      content: body, // 添加content字段，与body保持一致
      date,
      hasAttachments: attachments.length > 0,
      attachments,
      createdAt: new Date(),
    };
  }

  /**
   * 提取邮箱地址
   */
  private extractEmailAddress(addressInfo: any): string {
    if (!addressInfo) return '';
    
    if (Array.isArray(addressInfo)) {
      return addressInfo.map(addr => addr.address || addr.text || '').join(', ');
    }
    
    if (typeof addressInfo === 'object') {
      return addressInfo.address || addressInfo.text || '';
    }
    
    return String(addressInfo);
  }

  /**
   * 生成账户ID
   */
  private generateAccountId(email: string): string {
    // 确保 email 是字符串类型
    const emailStr = typeof email === 'string' ? email : String(email || '');
    return emailStr.replace(/[@.]/g, '_');
  }

  /**
   * 获取连接状态
   */
  getConnectionStatus(): ConnectionStatus {
    return this.connectionStatus;
  }

  /**
   * 获取当前协议
   */
  getCurrentProtocol(): EmailProtocol {
    return this.currentProtocol;
  }
}