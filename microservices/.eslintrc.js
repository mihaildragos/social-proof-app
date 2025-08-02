module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended'
  ],
  parserOptions: {
    ecmaVersion: 2020,
    sourceType: 'module'
  },
  env: {
    node: true,
    es2020: true,
    jest: true,
  },
  rules: {
    // Basic rules for code quality
    'no-unused-vars': 'off', // Turn off base rule to use TypeScript version
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_' }],
    'no-console': 'off', // Allow console.log for logging
    'prefer-const': 'warn',
    'no-var': 'error',
    'no-undef': 'off', // TypeScript handles this
    // Relaxed TypeScript rules  
    '@typescript-eslint/no-explicit-any': 'off', // Allow any for rapid development
    '@typescript-eslint/no-empty-function': 'warn',
  },
  ignorePatterns: [
    'node_modules/',
    'dist/',
    'build/',
    'coverage/',
    '*.js.map',
    '*.d.ts.map',
    'generated/',
    'logs/',
    'prisma/migrations/',
    'db/',
    '__tests__/',
    '*.test.ts',
    '*.spec.ts',
    'shared/**/*.js',  // Ignore generated JS files in shared
    'shared/**/*.d.ts' // Ignore generated declaration files
  ],
  // Override for TypeScript files
  overrides: [
    {
      files: ['*.ts', '*.tsx'],
      rules: {
        '@typescript-eslint/no-explicit-any': 'off' // Keep it off for TypeScript files too
      }
    }
  ]
};