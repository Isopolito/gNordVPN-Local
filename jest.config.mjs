export default {
  testEnvironment: 'node',
  transform: {},
  moduleNameMapper: {
    '^gi://(.*)$': '<rootDir>/__mocks__/gi/$1.js'
  }
};