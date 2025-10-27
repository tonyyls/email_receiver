const axios = require('axios');

// 测试配置
const baseURL = 'http://localhost:3000';

// QQ邮箱POP3配置示例
const pop3Config = {
  email_address: 'your_qq_email@qq.com',
  password: 'your_authorization_code',
  imap_server: 'pop.qq.com',
  port: 995,
  use_ssl: true,
  protocol: 'POP3',
  limit: 5
};

// IMAP配置示例（用于对比测试）
const imapConfig = {
  email_address: 'your_qq_email@qq.com',
  password: 'your_authorization_code',
  imap_server: 'imap.qq.com',
  port: 993,
  use_ssl: true,
  protocol: 'IMAP',
  limit: 5
};

async function testConnection(config, protocolName) {
  try {
    console.log(`\n=== 测试${protocolName}连接 ===`);
    const response = await axios.post(`${baseURL}/api/test-connection`, config);
    console.log(`${protocolName}连接测试结果:`, response.data);
    return response.data.success;
  } catch (error) {
    console.error(`${protocolName}连接测试失败:`, error.response?.data || error.message);
    return false;
  }
}

async function testFetchEmails(config, protocolName) {
  try {
    console.log(`\n=== 测试${protocolName}获取邮件 ===`);
    const response = await axios.post(`${baseURL}/api/fetch-emails`, config);
    console.log(`${protocolName}获取邮件结果:`, {
      success: response.data.success,
      message: response.data.message,
      emailCount: response.data.data?.emails?.length || 0
    });
    
    if (response.data.data?.emails?.length > 0) {
      console.log('第一封邮件示例:', {
        subject: response.data.data.emails[0].subject,
        from: response.data.data.emails[0].from,
        date: response.data.data.emails[0].date
      });
    }
    
    return response.data.success;
  } catch (error) {
    console.error(`${protocolName}获取邮件失败:`, error.response?.data || error.message);
    return false;
  }
}

async function testInvoiceDetection(config, protocolName) {
  try {
    console.log(`\n=== 测试${protocolName}发票检测 ===`);
    const response = await axios.post(`${baseURL}/api/fetch-and-detect-invoices`, config);
    console.log(`${protocolName}发票检测结果:`, {
      success: response.data.success,
      message: response.data.message,
      totalEmails: response.data.data?.total || 0,
      invoiceCount: response.data.data?.invoiceCount || 0
    });
    
    return response.data.success;
  } catch (error) {
    console.error(`${protocolName}发票检测失败:`, error.response?.data || error.message);
    return false;
  }
}

async function runTests() {
  console.log('开始POP3协议功能测试...');
  console.log('注意：请先修改配置中的邮箱地址和授权码');
  
  // 测试POP3协议
  console.log('\n' + '='.repeat(50));
  console.log('POP3协议测试');
  console.log('='.repeat(50));
  
  const pop3ConnectionOk = await testConnection(pop3Config, 'POP3');
  if (pop3ConnectionOk) {
    await testFetchEmails(pop3Config, 'POP3');
    await testInvoiceDetection(pop3Config, 'POP3');
  }
  
  // 测试IMAP协议（对比）
  console.log('\n' + '='.repeat(50));
  console.log('IMAP协议测试（对比）');
  console.log('='.repeat(50));
  
  const imapConnectionOk = await testConnection(imapConfig, 'IMAP');
  if (imapConnectionOk) {
    await testFetchEmails(imapConfig, 'IMAP');
    await testInvoiceDetection(imapConfig, 'IMAP');
  }
  
  console.log('\n' + '='.repeat(50));
  console.log('测试完成');
  console.log('='.repeat(50));
}

// 运行测试
runTests().catch(console.error);