import { defineConfig } from 'tsup';

export default defineConfig(({ watch }) => ({
  entry: ['src/index.ts', 'src/ai.ts'],
  format: ['esm', 'cjs'],
  // tsup 8 sets baseUrl internally; keep the TS 6 compatibility setting
  // scoped to declaration bundling until tsup removes that deprecated option.
  // The release build postprocesses the CommonJS declaration.
  dts: watch ? false : { compilerOptions: { ignoreDeprecations: '6.0' } },
  sourcemap: true,
  clean: true,
  external: ['react', '@nearstack-dev/core', '@nearstack-dev/ai'],
}));
