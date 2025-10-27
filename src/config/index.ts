import dotenv from 'dotenv';
// import path from 'path';

// 加载环境变量
dotenv.config();

export const config = {
  // 服务器配置
  server: {
    port: parseInt(process.env['PORT'] || '3000', 10),
    host: process.env['HOST'] || '0.0.0.0',
    nodeEnv: process.env['NODE_ENV'] || 'development',
    apiPrefix: process.env['API_PREFIX'] || '/api',
    corsOrigin: process.env['CORS_ORIGIN'] || '*',
  },

  // 日志配置
  logging: {
    level: process.env['LOG_LEVEL'] || 'info',
    filePath: process.env['LOG_FILE_PATH'] || './logs/app.log',
  },

  // 数据存储配置
  storage: {
    dataPath: process.env['DATA_PATH'] || './data',
    emailPresetsPath: process.env['EMAIL_PRESETS_PATH'] || './data/email_presets.json',
    invoiceKeywordsPath: process.env['INVOICE_KEYWORDS_PATH'] || './data/invoice_keywords.json',
    enableLocalStorage: process.env['ENABLE_LOCAL_STORAGE'] === 'true',
  },

  // 发票识别配置
  invoice: {
    confidenceThreshold: parseFloat(process.env['INVOICE_CONFIDENCE_THRESHOLD'] || '0.5'),
    scoreWeights: {
      subject: 0.3,
      sender: 0.2,
      content: 0.3,
      attachment: 0.2,
    },
  },

  // IMAP连接配置
  imap: {
    connectionTimeout: 30000, // 30秒
    authTimeout: 15000, // 15秒
    keepalive: {
      interval: 10000, // 10秒
      idleInterval: 300000, // 5分钟
      forceNoop: true,
    },
  },

  // 邮件处理配置
  email: {
    defaultMailbox: 'INBOX',
    defaultLimit: 10,
    maxLimit: 100,
    attachmentSizeLimit: 10 * 1024 * 1024, // 10MB
  },
};

// 验证必要的配置
export function validateConfig(): void {
  // 这里可以添加配置验证逻辑
  // 例如检查必要的目录是否存在等
}

export default config;