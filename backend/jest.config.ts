import type { Config } from 'jest';

const config: Config = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.spec.ts', '**/*.test.ts', '**/*.spec.ts'],
  testPathIgnorePatterns: ['/node_modules/', '/__tests__/setup/', '/__tests__/helpers/'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }],
  },
  setupFiles: ['<rootDir>/src/__tests__/setup/env.ts'],
  globalSetup: '<rootDir>/src/__tests__/setup/globalSetup.ts',
  globalTeardown: '<rootDir>/src/__tests__/setup/globalTeardown.ts',
  collectCoverageFrom: ['src/**/*.ts', '!src/**/*.d.ts', '!src/server.ts'],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov'],
  testTimeout: 15000,
};

export default config;
