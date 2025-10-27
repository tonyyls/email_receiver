import { Router } from 'express';
import { EmailController } from '../controllers/EmailController';

const router: Router = Router();
const emailController = new EmailController();

// 健康检查
router.get('/health', emailController.healthCheck);

// 邮箱连接测试
router.post('/test-connection', emailController.testConnection);

// 获取邮件列表
router.post('/fetch-emails', emailController.fetchEmails);

// 发票邮件检测
router.post('/detect-invoices', emailController.detectInvoices);

// 获取邮件并检测发票（组合接口）
router.post('/fetch-and-detect', emailController.fetchAndDetectInvoices);

// 获取发票邮件（只返回发票邮件）
router.post('/fetch-invoice-emails', emailController.fetchInvoiceEmails);

// 发票关键词管理
router.get('/invoice-keywords', emailController.getInvoiceKeywords);
router.put('/invoice-keywords', emailController.updateInvoiceKeywords);

export default router;