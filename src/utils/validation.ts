import Joi from 'joi';
import { EmailConfig, EmailQueryParams } from '../types';

// 邮箱配置验证模式
export const emailConfigSchema = Joi.object<EmailConfig>({
  email_address: Joi.string().email().required().messages({
    'string.email': '邮箱地址格式不正确',
    'any.required': '邮箱地址不能为空'
  }),
  password: Joi.string().min(1).required().messages({
    'string.min': '密码不能为空',
    'any.required': '密码不能为空'
  }),
  imap_server: Joi.string().hostname().required().messages({
    'string.hostname': 'IMAP服务器地址格式不正确',
    'any.required': 'IMAP服务器地址不能为空'
  }),
  port: Joi.number().integer().min(1).max(65535).required().messages({
    'number.base': '端口号必须是数字',
    'number.integer': '端口号必须是整数',
    'number.min': '端口号必须大于0',
    'number.max': '端口号必须小于65536',
    'any.required': '端口号不能为空'
  }),
  use_ssl: Joi.boolean().required().messages({
    'boolean.base': 'SSL设置必须是布尔值',
    'any.required': 'SSL设置不能为空'
  }),
  mail_box: Joi.string().optional().default('INBOX'),
  protocol: Joi.string().valid('IMAP', 'POP3').optional().default('IMAP').messages({
    'any.only': '协议类型必须是IMAP或POP3'
  })
});

// 邮件查询参数验证模式
export const emailQuerySchema = Joi.object<EmailQueryParams>({
  email_address: Joi.string().email().required().messages({
    'string.email': '邮箱地址格式不正确',
    'any.required': '邮箱地址不能为空'
  }),
  password: Joi.string().min(1).required().messages({
    'string.min': '密码不能为空',
    'any.required': '密码不能为空'
  }),
  imap_server: Joi.string().hostname().required().messages({
    'string.hostname': 'IMAP服务器地址格式不正确',
    'any.required': 'IMAP服务器地址不能为空'
  }),
  port: Joi.number().integer().min(1).max(65535).required().messages({
    'number.base': '端口号必须是数字',
    'number.integer': '端口号必须是整数',
    'number.min': '端口号必须大于0',
    'number.max': '端口号必须小于65536',
    'any.required': '端口号不能为空'
  }),
  use_ssl: Joi.boolean().required().messages({
    'boolean.base': 'SSL设置必须是布尔值',
    'any.required': 'SSL设置不能为空'
  }),
  mail_box: Joi.string().optional().default('INBOX'),
  protocol: Joi.string().valid('IMAP', 'POP3').optional().default('IMAP').messages({
    'any.only': '协议类型必须是IMAP或POP3'
  }),
  limit: Joi.number().integer().min(1).max(100).optional().default(10).messages({
    'number.base': '邮件数量限制必须是数字',
    'number.integer': '邮件数量限制必须是整数',
    'number.min': '邮件数量限制至少为1',
    'number.max': '邮件数量限制最多为100'
  }),
  from: Joi.string().optional().messages({
    'string.base': '发件人筛选必须是字符串'
  }),
  since: Joi.string().pattern(/^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/).optional().messages({
    'string.pattern.base': '起始日期格式不正确，请使用格式：YYYY/MM/DD HH:mm（如：2025/06/08 22:03）'
  }),
  to: Joi.string().optional().messages({
    'string.base': '收件人筛选必须是字符串'
  })
});

// 发票检测验证模式
export const invoiceDetectionSchema = Joi.object({
  emails: Joi.array().items(
    Joi.object({
      id: Joi.string().required(),
      messageId: Joi.string().optional(),
      subject: Joi.string().required(),
      title: Joi.string().optional(),
      from: Joi.string().required(),
      to: Joi.string().required(),
      date: Joi.alternatives().try(
        Joi.string(),
        Joi.date()
      ).required(),
      body: Joi.string().required(),
      content: Joi.string().optional(),
      text: Joi.string().optional(),
      hasAttachments: Joi.boolean().optional(),
      attachments: Joi.array().items(
        Joi.object({
          filename: Joi.string().required(),
          contentType: Joi.string().required(),
          size: Joi.number().required()
        })
      ).optional(),
      createdAt: Joi.alternatives().try(
        Joi.string(),
        Joi.date()
      ).optional()
    })
  ).required().min(1).messages({
    'array.min': '至少需要提供一封邮件进行检测',
    'any.required': '邮件列表不能为空'
  })
});

/**
 * 验证邮箱配置
 */
export function validateEmailConfig(data: any): { error?: string; value?: EmailConfig } {
  const { error, value } = emailConfigSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join('; ');
    return { error: errorMessage };
  }
  
  return { value };
}

/**
 * 验证邮件查询参数
 */
export const validateEmailQuery = (data: any): { error?: string; value?: EmailQueryParams } => {
  const { error, value } = emailQuerySchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join(', ');
    return { error: errorMessage };
  }
  
  return { value };
};

/**
 * 验证发票检测参数
 */
export function validateInvoiceDetection(data: any): { error?: string; value?: any } {
  const { error, value } = invoiceDetectionSchema.validate(data, { abortEarly: false });
  
  if (error) {
    const errorMessage = error.details.map(detail => detail.message).join('; ');
    return { error: errorMessage };
  }
  
  return { value };
}