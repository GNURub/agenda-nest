import { resolve } from 'node:path';
import swc from 'unplugin-swc';
import { configDefaults, defineConfig } from 'vitest/config';

const sharedProjectTest = {
  globals: true,
  environment: 'node' as const,
  setupFiles: ['./vitest.setup.ts'],
  clearMocks: true,
  restoreMocks: true,
  sequence: {
    hooks: 'list' as const,
  },
};

export default defineConfig({
  plugins: [
    swc.vite({
      jsc: {
        parser: {
          syntax: 'typescript',
          decorators: true,
        },
        target: 'es2020',
        transform: {
          decoratorMetadata: true,
          legacyDecorator: true,
        },
      },
      module: {
        type: 'es6',
      },
    }),
  ],
  resolve: {
    alias: {
      'agenda-nest': resolve(__dirname, 'lib/index.ts'),
    },
  },
  test: {
    exclude: [
      ...configDefaults.exclude,
      '**/dist/**',
      '**/.{idea,cache,output,temp}/**',
      '**/{karma,rollup,webpack,vite,vitest,jest,ava,babel,nyc,cypress,tsup,build,eslint,prettier}.config.*',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      include: ['lib/**/*.ts'],
      exclude: [
        'lib/**/*.spec.ts',
        'lib/index.ts',
        'lib/interfaces/**/*.ts',
        'lib/enums/**/*.ts',
      ],
    },
    projects: [
      {
        test: {
          ...sharedProjectTest,
          name: 'unit',
          include: ['lib/**/*.spec.ts'],
        },
      },
      {
        test: {
          ...sharedProjectTest,
          name: 'e2e',
          include: ['e2e/**/*.e2e-spec.ts'],
          maxWorkers: 1,
          testTimeout: 10_000,
        },
      },
      {
        test: {
          ...sharedProjectTest,
          name: 'example-smoke',
          include: ['examples/multiple-queues/test/**/*.e2e-spec.ts'],
          maxWorkers: 1,
          testTimeout: 10_000,
        },
      },
    ],
  },
});
