// 邮箱协议类型
export type EmailProtocol = 'IMAP' | 'POP3';

// 邮箱配置接口
export interface EmailConfig {
  email_address: string;
  password: string;
  imap_server: string;
  port: number;
  use_ssl: boolean;
  mail_box?: string;
  protocol?: EmailProtocol; // 协议选择，默认为IMAP
}

// 邮件查询参数接口
export interface EmailQueryParams extends EmailConfig {
  limit?: number;
  from?: string;
  since?: string;
  to?: string;
}

// 邮件消息接口
export interface EmailMessage {
  id: string;
  messageId: string;
  from: string;
  to: string;
  subject: string;
  title: string; // 标题字段，与subject保持一致
  body: string;
  content: string; // 内容字段，与body保持一致
  text?: string;
  date: Date;
  hasAttachments: boolean;
  attachments?: EmailAttachment[];
  isInvoice?: boolean;
  createdAt: Date;
}

// 邮件附件接口
export interface EmailAttachment {
  filename: string;
  contentType: string;
  size: number;
  content?: Buffer;
}

// 发票信息接口
export interface InvoiceInfo {
  id?: string;
  emailId?: string;
  invoiceNumber?: string;
  amount?: number;
  currency?: string;
  invoiceDate?: Date;
  issuer?: string;
  recipient?: string;
  confidenceScore?: number;
  createdAt?: Date;
}

// 发票识别结果接口
export interface InvoiceDetectionResult {
  invoices: EmailMessage[];
  count: number;
  details: {
    emailId: string;
    isInvoice: boolean;
    subject: string;
    confidence: number;
  }[];
}

// API响应接口
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// 邮箱连接测试结果接口
export interface ConnectionTestResult {
  success: boolean;
  message: string;
  server: string;
  port: number;
  ssl: boolean;
}

// 邮件获取结果接口
export interface EmailFetchResult {
  success: boolean;
  emails?: EmailMessage[];
  total: number;
  message: string;
}

// 邮箱预设配置接口
export interface EmailPreset {
  name: string;
  imap_server: string;
  port: number;
  use_ssl: boolean;
  domain: string;
}

// 发票关键词配置接口
export interface InvoiceKeywords {
  chinese: {
    subjects: string[];
    senders: string[];
    amounts: string[];
    companies: string[];
  };
  english: {
    subjects: string[];
    senders: string[];
    amounts: string[];
    companies: string[];
  };
}

// 发票匹配模式接口
export interface InvoicePatterns {
  invoiceNumber: RegExp;
  amount: RegExp;
  taxNumber: RegExp;
  date: RegExp;
  company: RegExp;
}

// 发票评分权重接口
export interface InvoiceScoreWeights {
  subject: number;
  sender: number;
  content: number;
  attachment: number;
}

// 日志级别类型
export type LogLevel = 'error' | 'warn' | 'info' | 'debug';

// 邮箱类型枚举
export enum EmailProvider {
  QQ = 'qq',
  NETEASE_163 = '163',
  GMAIL = 'gmail',
  OUTLOOK = 'outlook',
  YAHOO = 'yahoo',
  OTHER = 'other'
}

// 邮件连接状态枚举
export enum ConnectionStatus {
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  CONNECTED = 'connected',
  AUTHENTICATED = 'authenticated',
  ERROR = 'error'
}

// POP3连接配置接口
export interface POP3Config {
  host: string;
  port: number;
  username: string;
  password: string;
  enabletls: boolean;
  debug?: boolean;
}