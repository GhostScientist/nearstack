import { defineConfig } from 'tsup';

export default defineConfig(({ watch }) => ({
  entry: ['src/index.ts'],
  format: ['esm', 'cjs'],
  // tsup 8 sets baseUrl internally; keep the TS 6 compatibility setting
  // scoped to declaration bundling until tsup removes that deprecated option.
  dts: watch ? false : { compilerOptions: { ignoreDeprecations: '6.0' } },
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
}));
