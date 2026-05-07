import { defineConfig } from 'tsdown';

const sharedConfig = {
  clean: false,
  deps: {
    skipNodeModulesBundle: true,
  },
  entry: {
    index: 'lib/index.ts',
  },
  minify: false,
  outExtensions() {
    return {
      js: '.js',
    };
  },
  platform: 'node',
  shims: false,
  sourcemap: false,
  tsconfig: './tsconfig.json',
} as const;

export default defineConfig([
  {
    ...sharedConfig,
    dts: true,
    format: ['cjs'],
    outDir: 'dist/cjs',
    target: 'es2020',
  },
  {
    ...sharedConfig,
    dts: false,
    format: ['esm'],
    outDir: 'dist/esm',
    target: 'es2022',
  },
]);
