// Jest setup file

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

// Mock environment variables
process.env['NODE_ENV'] = 'test';
process.env['PORT'] = '3000';
process.env['LOG_LEVEL'] = 'error';

// Mock external dependencies that might cause issues in tests
jest.mock('imap', () => ({
  __esModule: true,
  default: jest.fn().mockImplementation(() => ({
    connect: jest.fn(),
    end: jest.fn(),
    openBox: jest.fn(),
    search: jest.fn(),
    fetch: jest.fn(),
    once: jest.fn(),
    on: jest.fn()
  }))
}));

// Clean up after each test
afterEach(() => {
  jest.clearAllMocks();
});