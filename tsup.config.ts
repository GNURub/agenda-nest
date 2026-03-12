import { defineConfig } from 'tsup';

const sharedConfig = {
  bundle: true,
  clean: false,
  entry: {
    index: 'lib/index.ts',
  },
  minify: false,
  platform: 'node',
  shims: false,
  skipNodeModulesBundle: true,
  sourcemap: false,
  splitting: false,
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
    outExtension() {
      return {
        js: '.js',
      };
    },
    outDir: 'dist/esm',
    target: 'es2022',
  },
]);
