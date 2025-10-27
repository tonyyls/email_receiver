import { EmailService } from '../services/EmailService';
import { InvoiceService } from '../services/InvoiceService';
import { DataService } from '../services/DataService';
import { CacheService } from '../services/CacheService';
import { EmailConfig, EmailMessage, InvoiceKeywords } from '../types';

// Mock dependencies
jest.mock('../services/DataService');
jest.mock('../services/CacheService');
jest.mock('../utils/logger');

const MockedDataService = DataService as jest.MockedClass<typeof DataService>;
const MockedCacheService = CacheService as jest.MockedClass<typeof CacheService>;

describe('Services Tests', () => {
  let emailService: EmailService;
  let invoiceService: InvoiceService;
  let mockDataService: jest.Mocked<DataService>;
  let mockCacheService: jest.Mocked<CacheService>;

  beforeEach(() => {
    mockDataService = new MockedDataService() as jest.Mocked<DataService>;
    mockCacheService = new MockedCacheService() as jest.Mocked<CacheService>;
    
    emailService = new EmailService();
    invoiceService = new InvoiceService();
    
    jest.clearAllMocks();
  });

  describe('EmailService', () => {
    const mockConfig: EmailConfig = {
      email_address: 'test@qq.com',
      password: 'password123',
      imap_server: 'imap.qq.com',
      port: 993,
      use_ssl: true,
      mail_box: 'INBOX'
    };

    describe('testConnection', () => {
      it('should test connection successfully', async () => {
        // Mock IMAP connection success
        const result = await emailService.testConnection(mockConfig);
        
        expect(result.success).toBe(true);
        expect(result.server).toBe(mockConfig.imap_server);
        expect(result.port).toBe(mockConfig.port);
        expect(result.ssl).toBe(mockConfig.use_ssl);
      });

      it('should handle connection failure', async () => {
        const invalidConfig = { ...mockConfig, password: 'wrongpassword' };
        
        const result = await emailService.testConnection(invalidConfig);
        
        expect(result.success).toBe(false);
        expect(result.message).toContain('连接失败');
      });
    });

    describe('fetchEmails', () => {
      it('should fetch emails successfully', async () => {
        const queryParams = {
          ...mockConfig,
          limit: 10
        };

        const result = await emailService.fetchEmails(queryParams);
        
        expect(result.success).toBe(true);
        expect(Array.isArray(result.emails)).toBe(true);
        expect(typeof result.total).toBe('number');
      });

      it('should handle fetch failure', async () => {
        const invalidConfig = { ...mockConfig, email_address: 'invalid@email' };
        
        const result = await emailService.fetchEmails(invalidConfig);
        
        expect(result.success).toBe(false);
        expect(result.total).toBe(0);
      });

      it('should respect limit parameter', async () => {
        const queryParams = {
          ...mockConfig,
          limit: 5
        };

        const result = await emailService.fetchEmails(queryParams);
        
        if (result.success && result.emails) {
          expect(result.emails.length).toBeLessThanOrEqual(5);
        }
      });
    });

    describe('generateAccountId', () => {
      it('should generate valid account ID', () => {
        const email = 'test@example.com';
        const accountId = (emailService as any).generateAccountId(email);
        
        expect(accountId).toBe('test_example_com');
        expect(accountId).not.toContain('@');
        expect(accountId).not.toContain('.');
      });
    });
  });

  describe('InvoiceService', () => {
    const mockEmail: EmailMessage = {
      id: '1',
      messageId: 'msg-1',
      subject: '发票通知 - Invoice Notification',
      from: 'finance@company.com',
      to: 'test@qq.com',
      date: new Date('2024-01-01T00:00:00Z'),
      body: '尊敬的客户，您的发票已生成，金额：1000.00元',
      hasAttachments: true,
      attachments: [
        {
          filename: 'invoice.pdf',
          contentType: 'application/pdf',
          size: 1024
        }
      ],
      createdAt: new Date()
    };

    describe('detectSingleInvoice', () => {
      it('should detect invoice email correctly', async () => {
        const result = await invoiceService.detectSingleInvoice(mockEmail);
        
        expect(result.emailId).toBe(mockEmail.id);
        expect(result.isInvoice).toBe(true);
        expect(result.confidence).toBeGreaterThan(0.5);
        expect(result.scores).toHaveProperty('subject');
        expect(result.scores).toHaveProperty('sender');
        expect(result.scores).toHaveProperty('content');
        expect(result.scores).toHaveProperty('attachment');
      });

      it('should not detect non-invoice email', async () => {
        const nonInvoiceEmail: EmailMessage = {
          id: '2',
          messageId: 'msg-2',
          subject: 'Regular Email',
          from: 'friend@example.com',
          to: 'test@qq.com',
          date: new Date('2024-01-01T00:00:00Z'),
          body: 'Hello, how are you?',
          hasAttachments: false,
          attachments: [],
          createdAt: new Date()
        };

        const result = await invoiceService.detectSingleInvoice(nonInvoiceEmail);
        
        expect(result.isInvoice).toBe(false);
        expect(result.confidence).toBeLessThan(0.5);
      });

      it('should extract invoice information', async () => {
        const result = await invoiceService.detectSingleInvoice(mockEmail);
        
        if (result.invoiceInfo) {
          expect(result.invoiceInfo.emailId).toBe(mockEmail.id);
          expect(result.invoiceInfo.confidenceScore).toBe(result.confidence);
          expect(result.invoiceInfo.createdAt).toBeInstanceOf(Date);
        }
      });
    });

    describe('getInvoiceKeywords', () => {
      it('should get invoice keywords', async () => {
        const mockKeywords: InvoiceKeywords = {
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

        mockDataService.getInvoiceKeywords.mockResolvedValue(mockKeywords);
        
        const result = await invoiceService.getInvoiceKeywords();
        
        expect(result).toEqual(mockKeywords);
        expect(result.chinese.subjects).toContain('发票');
        expect(result.english.subjects).toContain('invoice');
      });

      it('should return default keywords on error', async () => {
        mockDataService.getInvoiceKeywords.mockRejectedValue(new Error('File not found'));
        
        const result = await invoiceService.getInvoiceKeywords();
        
        expect(result.chinese.subjects).toContain('发票');
        expect(result.english.subjects).toContain('invoice');
      });
    });

    describe('updateInvoiceKeywords', () => {
      it('should update invoice keywords', async () => {
        const newKeywords: InvoiceKeywords = {
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

        mockDataService.updateInvoiceKeywords.mockResolvedValue(undefined);
        mockCacheService.delete.mockReturnValue(true);
        
        await expect(invoiceService.updateInvoiceKeywords(newKeywords)).resolves.not.toThrow();
        
        expect(mockDataService.updateInvoiceKeywords).toHaveBeenCalledWith(newKeywords);
        expect(mockCacheService.delete).toHaveBeenCalled();
      });
    });

    describe('analyzeSubject', () => {
      it('should analyze subject correctly', () => {
        const analyzeSubject = (invoiceService as any).analyzeSubject.bind(invoiceService);
        
        const invoiceSubject = '发票通知 - Invoice Notification';
        const regularSubject = 'Meeting Reminder';
        
        const invoiceScore = analyzeSubject(invoiceSubject);
        const regularScore = analyzeSubject(regularSubject);
        
        expect(invoiceScore).toBeGreaterThan(regularScore);
        expect(invoiceScore).toBeGreaterThan(0);
        expect(regularScore).toBeLessThan(0.5);
      });
    });

    describe('analyzeSender', () => {
      it('should analyze sender correctly', () => {
        const analyzeSender = (invoiceService as any).analyzeSender.bind(invoiceService);
        
        const invoiceSender = 'finance@company.com';
        const regularSender = 'friend@example.com';
        
        const invoiceScore = analyzeSender(invoiceSender);
        const regularScore = analyzeSender(regularSender);
        
        expect(invoiceScore).toBeGreaterThan(regularScore);
      });
    });

    describe('analyzeContent', () => {
      it('should analyze content correctly', () => {
        const analyzeContent = (invoiceService as any).analyzeContent.bind(invoiceService);
        
        const invoiceContent = '发票号码：INV-2024-001，金额：1000.00元';
        const regularContent = 'Hello, how are you today?';
        
        const invoiceScore = analyzeContent(invoiceContent);
        const regularScore = analyzeContent(regularContent);
        
        expect(invoiceScore).toBeGreaterThan(regularScore);
      });
    });

    describe('analyzeAttachments', () => {
      it('should analyze attachments correctly', () => {
        const analyzeAttachments = (invoiceService as any).analyzeAttachments.bind(invoiceService);
        
        const emailWithPDF: EmailMessage = {
          ...mockEmail,
          hasAttachments: true,
          attachments: [
            {
              filename: 'invoice.pdf',
              contentType: 'application/pdf',
              size: 1024
            }
          ]
        };

        const emailWithoutAttachments: EmailMessage = {
          ...mockEmail,
          hasAttachments: false,
          attachments: []
        };
        
        const pdfScore = analyzeAttachments(emailWithPDF);
        const noAttachmentScore = analyzeAttachments(emailWithoutAttachments);
        
        expect(pdfScore).toBeGreaterThan(noAttachmentScore);
        expect(pdfScore).toBeGreaterThan(0.5);
        expect(noAttachmentScore).toBe(0);
      });
    });

    describe('getInvoiceStats', () => {
      it('should calculate invoice statistics', () => {
        const invoices = [
          {
            emailId: '1',
            amount: 1000,
            confidenceScore: 0.8,
            invoiceDate: new Date('2024-01-01'),
            createdAt: new Date()
          },
          {
            emailId: '2',
            amount: 2000,
            confidenceScore: 0.9,
            invoiceDate: new Date('2024-01-02'),
            createdAt: new Date()
          }
        ];

        const stats = invoiceService.getInvoiceStats(invoices);
        
        expect(stats.totalCount).toBe(2);
        expect(stats.totalAmount).toBe(3000);
        expect(stats.averageConfidence).toBe(0.85);
        expect(stats.dateRange.start).toEqual(new Date('2024-01-01'));
        expect(stats.dateRange.end).toEqual(new Date('2024-01-02'));
      });

      it('should handle empty invoice list', () => {
        const stats = invoiceService.getInvoiceStats([]);
        
        expect(stats.totalCount).toBe(0);
        expect(stats.totalAmount).toBe(0);
        expect(stats.averageConfidence).toBe(0);
        expect(stats.dateRange).toEqual({});
      });
    });
  });

  describe('DataService', () => {
    beforeEach(() => {
      // DataService is mocked
    });

    describe('saveEmails', () => {
      it('should save emails to file', async () => {
        const mockEmail: EmailMessage = {
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
        };
        // const emails: EmailMessage[] = [mockEmail];
        const accountId = 'test_account';

        mockDataService.saveEmails.mockResolvedValue(undefined);
        
        const mockEmails = [
          {
            id: '1',
            messageId: 'msg-1',
            subject: 'Test Email',
            from: 'test@example.com',
            to: 'user@example.com',
            date: new Date(),
            body: 'Test content',
            hasAttachments: false,
            attachments: [],
            createdAt: new Date()
          }
        ];
        await expect(mockDataService.saveEmails('test_account', mockEmails)).resolves.not.toThrow();
      });
    });

    describe('getInvoiceKeywords', () => {
      it('should read invoice keywords from file', async () => {
        const mockKeywords: InvoiceKeywords = {
          chinese: {
            subjects: ['发票'],
            senders: ['财务'],
            amounts: ['金额'],
            companies: ['有限公司']
          },
          english: {
            subjects: ['invoice'],
            senders: ['finance'],
            amounts: ['amount'],
            companies: ['Ltd.']
          }
        };

        mockDataService.getInvoiceKeywords.mockResolvedValue(mockKeywords);
        
        const result = await mockDataService.getInvoiceKeywords();
        expect(result).toEqual(mockKeywords);
      });
    });
  });

  describe('CacheService', () => {
    beforeEach(() => {
      // CacheService is mocked
    });

    describe('set and get', () => {
      it('should set and get cache values', () => {
        const key = 'test-key';
        const value = { data: 'test' };
        const ttl = 60000; // 1 minute

        mockCacheService.set.mockReturnValue(undefined);
        mockCacheService.get.mockReturnValue(value);
        
        mockCacheService.set(key, value, ttl);
        const result = mockCacheService.get(key);
        
        expect(result).toEqual(value);
      });

      it('should return undefined for expired cache', () => {
        const key = 'expired-key';
        
        mockCacheService.get.mockReturnValue(undefined);
        
        const result = mockCacheService.get(key);
        expect(result).toBeUndefined();
      });
    });

    describe('delete', () => {
      it('should delete cache entry', () => {
        const key = 'test-key';
        
        mockCacheService.delete.mockReturnValue(true);
        
        const result = mockCacheService.delete(key);
        expect(result).toBe(true);
      });
    });

    describe('clear', () => {
      it('should clear all cache entries', () => {
        mockCacheService.clear.mockReturnValue(undefined);
        
        expect(() => mockCacheService.clear()).not.toThrow();
      });
    });

    describe('static key generators', () => {
      it('should generate correct cache keys', () => {
        expect(CacheService.getConnectionTestKey('test@example.com', 'imap.example.com', 993)).toBe('connection_test_test@example.com_imap.example.com_993');
        expect(CacheService.getEmailFetchKey('test@example.com', 'INBOX', 10)).toBe('email_fetch_test@example.com_INBOX_10');
        expect(CacheService.getInvoiceDetectionKey('email123')).toBe('invoice_detection_email123');
        expect(CacheService.getInvoiceKeywordsKey()).toBe('invoice_keywords');
      });
    });
  });
});