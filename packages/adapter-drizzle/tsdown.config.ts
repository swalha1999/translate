import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: ['src/index.ts', 'src/schema.ts'],
  format: ['cjs', 'esm'],
  dts: true,
  clean: true,
  sourcemap: true,
})
