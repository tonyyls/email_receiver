import request from 'supertest';
import { EmailService } from '../services/EmailService';
import { InvoiceService } from '../services/InvoiceService';
// import logger from '../utils/logger';
import { createApp } from '../app';

// Mock services
jest.mock('../services/EmailService');
jest.mock('../services/InvoiceService');
jest.mock('../utils/logger');

const MockedEmailService = EmailService as jest.MockedClass<typeof EmailService>;
const MockedInvoiceService = InvoiceService as jest.MockedClass<typeof InvoiceService>;

describe('API Tests', () => {
  let app: any;
  let emailService: jest.Mocked<EmailService>;
  let invoiceService: jest.Mocked<InvoiceService>;

  beforeEach(() => {
    app = createApp();
    emailService = new MockedEmailService() as jest.Mocked<EmailService>;
    invoiceService = new MockedInvoiceService() as jest.Mocked<InvoiceService>;
    jest.clearAllMocks();
  });

  describe('GET /', () => {
    it('should return health status', async () => {
      const response = await request(app)
        .get('/')
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: 'Coze邮箱插件服务运行正常',
        data: {
          status: 'healthy',
          timestamp: expect.any(String),
          version: '1.0.0'
        }
      });
    });
  });

  describe('POST /api/test-connection', () => {
    it('should test email connection successfully', async () => {
      const mockResult = {
        success: true,
        message: '连接成功',
        server: 'imap.qq.com',
        port: 993,
        ssl: true
      };

      emailService.testConnection = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/test-connection')
        .send({
          email_address: 'test@qq.com',
          password: 'password123',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult,
        message: '连接测试成功'
      });
    });

    it('should handle connection failure', async () => {
      const mockResult = {
        success: false,
        message: '连接失败',
        server: 'imap.qq.com',
        port: 993,
        ssl: true
      };

      emailService.testConnection = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/test-connection')
        .send({
          email_address: 'test@qq.com',
          password: 'wrongpassword',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true
        })
        .expect(400);

      expect(response.body).toEqual({
        success: false,
        message: '连接失败',
        error: '连接失败'
      });
    });

    it('should validate required fields', async () => {
      const response = await request(app)
        .post('/api/test-connection')
        .send({
          email_address: 'invalid-email'
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('参数验证失败');
    });
  });

  describe('POST /api/fetch-emails', () => {
    it('should fetch emails successfully', async () => {
      const mockEmails = [
        {
          id: '1',
          messageId: 'msg-1',
          subject: '测试邮件',
          from: 'sender@example.com',
          to: 'test@qq.com',
          date: new Date('2024-01-01T00:00:00Z'),
          body: '邮件内容',
          hasAttachments: false,
          attachments: [],
          createdAt: new Date()
        }
      ];

      const mockResult = {
        success: true,
        emails: mockEmails,
        total: 1,
        message: '获取成功'
      };

      emailService.fetchEmails = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/fetch-emails')
        .send({
          email_address: 'test@qq.com',
          password: 'password123',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true,
          limit: 10
        })
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        data: mockResult,
        message: '邮件获取成功'
      });
    });

    it('should handle fetch failure', async () => {
      const mockResult = {
        success: false,
        emails: [],
        total: 0,
        message: '获取失败'
      };

      emailService.fetchEmails = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/fetch-emails')
        .send({
          email_address: 'test@qq.com',
          password: 'password123',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true
        })
        .expect(400);

      expect(response.body.success).toBe(false);
    });
  });

  describe('POST /api/detect-invoices', () => {
    it('should detect invoices successfully', async () => {
      const mockEmails = [
        {
          id: '1',
          messageId: 'msg-1',
          subject: '发票通知',
          from: 'finance@company.com',
          to: 'test@qq.com',
          date: new Date('2024-01-01T00:00:00Z'),
          body: '发票内容',
          hasAttachments: false,
          attachments: [],
          createdAt: new Date()
        }
      ];

      const mockResult = {
        emailId: '1',
        isInvoice: true,
        confidence: 0.85,
        scores: {
          subject: 0.8,
          sender: 0.9,
          content: 0.7,
          attachment: 0.0
        },
        invoiceInfo: {
          emailId: '1',
          confidenceScore: 0.85,
          createdAt: new Date()
        },
        detectedAt: new Date().toISOString()
      };

      invoiceService.detectSingleInvoice = jest.fn().mockResolvedValue(mockResult);

      const response = await request(app)
        .post('/api/detect-invoices')
        .send({
          emails: mockEmails
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
    });

    it('should validate email data', async () => {
      const response = await request(app)
        .post('/api/detect-invoices')
        .send({
          emails: []
        })
        .expect(400);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('参数验证失败');
    });
  });

  describe('POST /api/fetch-and-detect', () => {
    it('should fetch emails and detect invoices', async () => {
      const mockEmails = [
        {
          id: '1',
          messageId: 'msg-1',
          subject: '发票通知',
          from: 'finance@company.com',
          to: 'test@qq.com',
          date: new Date('2024-01-01T00:00:00Z'),
          body: '发票内容',
          hasAttachments: false,
          attachments: [],
          createdAt: new Date()
        }
      ];

      const mockFetchResult = {
        success: true,
        emails: mockEmails,
        total: 1,
        message: '获取成功'
      };

      const mockDetectionResult = {
        emailId: '1',
        isInvoice: true,
        confidence: 0.85,
        scores: {
          subject: 0.8,
          sender: 0.9,
          content: 0.7,
          attachment: 0.0
        },
        invoiceInfo: {
          emailId: '1',
          confidenceScore: 0.85,
          createdAt: new Date()
        },
        detectedAt: new Date().toISOString()
      };

      emailService.fetchEmails = jest.fn().mockResolvedValue(mockFetchResult);
      invoiceService.detectSingleInvoice = jest.fn().mockResolvedValue(mockDetectionResult);

      const response = await request(app)
        .post('/api/fetch-and-detect')
        .send({
          email_address: 'test@qq.com',
          password: 'password123',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true,
          limit: 10
        })
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.data).toBeDefined();
      expect(response.body.data.results).toBeDefined();
    });
  });

  describe('GET /api/invoice-keywords', () => {
    it('should get invoice keywords', async () => {
      const mockKeywords = {
        chinese: {
          subjects: ['发票', '电子发票'],
          senders: ['财务', '会计'],
          amounts: ['金额', '总计'],
          companies: ['有限公司', '集团']
        },
        english: {
          subjects: ['invoice', 'bill'],
          senders: ['finance', 'accounting'],
          amounts: ['amount', 'total'],
          companies: ['Ltd.', 'Inc.']
        }
      };

      invoiceService.getInvoiceKeywords = jest.fn().mockResolvedValue(mockKeywords);

      const response = await request(app)
        .get('/api/invoice-keywords')
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.message).toBe('获取发票关键词配置成功');
    });
  });

  describe('PUT /api/invoice-keywords', () => {
    it('should update invoice keywords', async () => {
      const newKeywords = {
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

      invoiceService.updateInvoiceKeywords = jest.fn().mockResolvedValue(undefined);

      const response = await request(app)
        .put('/api/invoice-keywords')
        .send(newKeywords)
        .expect(200);

      expect(response.body).toEqual({
        success: true,
        message: '更新发票关键词配置成功',
        data: null
      });

      // expect(invoiceService.updateInvoiceKeywords).toHaveBeenCalledWith(newKeywords);
    });
  });

  describe('Error Handling', () => {
    it('should handle 404 for unknown routes', async () => {
      const response = await request(app)
        .get('/api/unknown-route')
        .expect(404);

      expect(response.body).toEqual({
        success: false,
        message: '接口 GET /api/unknown-route 不存在',
        data: null
      });
    });

    it('should handle internal server errors', async () => {
      emailService.testConnection = jest.fn().mockRejectedValue(new Error('Internal error'));

      const response = await request(app)
        .post('/api/test-connection')
        .send({
          email_address: 'test@qq.com',
          password: 'password123',
          imap_server: 'imap.qq.com',
          port: 993,
          use_ssl: true
        })
        .expect(500);

      expect(response.body.success).toBe(false);
      expect(response.body.message).toContain('邮箱连接测试失败');
    });
  });
});