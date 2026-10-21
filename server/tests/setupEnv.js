process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'error';

/*
 * Tests must not depend on whatever a developer has in server/.env.
 * dotenv never overrides variables that already exist, so blanking the optional
 * integrations here keeps them "not configured" unless a test opts in.
 */
process.env.CLIST_USERNAME = '';
process.env.CLIST_API_KEY = '';
process.env.SMTP_HOST = '';
process.env.SMTP_USER = '';
process.env.SMTP_PASS = '';
process.env.GOOGLE_CLIENT_ID = '';
process.env.GOOGLE_CLIENT_SECRET = '';
process.env.GOOGLE_REDIRECT_URI = '';
process.env.ENABLE_CRON = 'false';
