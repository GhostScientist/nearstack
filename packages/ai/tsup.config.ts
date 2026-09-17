import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  dts: false,
  splitting: false,
  sourcemap: true,
  clean: true,
  treeshake: true,
  minify: false,
  external: ['@mlc-ai/web-llm'],
  esbuildOptions(options) {
    options.banner = {
      js: '// @nearstack-dev/ai - Browser-native local AI inference',
    };
  },
});
