module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/__tests__/**/*.test.ts'],
  transform: {
    '^.+\\.ts$': [
      'ts-jest',
      {
        tsconfig: {
          target: 'es2022',
          module: 'CommonJS',
          moduleDetection: 'legacy',
          strict: true,
          esModuleInterop: true,
          types: ['jest', 'node'],
        },
      },
    ],
  },
  moduleNameMapper: {
    '^@arcanewizards/smpte$': '<rootDir>/../smpte/src/index.ts',
  },
};
