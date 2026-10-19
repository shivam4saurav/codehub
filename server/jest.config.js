/**
 * Jest runs the server's native ES modules directly (no Babel step), which is
 * why `npm test` sets NODE_OPTIONS=--experimental-vm-modules.
 */
export default {
  testEnvironment: 'node',
  transform: {},
  setupFiles: ['<rootDir>/tests/setupEnv.js'],
  testMatch: ['<rootDir>/tests/**/*.test.js'],
  clearMocks: true,
  restoreMocks: true,
  verbose: false,
  collectCoverageFrom: [
    'services/**/*.js',
    'utils/**/*.js',
    'config/taxonomy.js',
    'controllers/**/*.js',
  ],
  testTimeout: 15_000,
};
