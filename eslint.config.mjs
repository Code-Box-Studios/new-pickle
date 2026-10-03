import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  globalIgnores([
    ".next/**",
    ".vercel/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "src/generated/**",
    "src/cms/payload-types.ts",
    "src/cms/migrations/**",
    "src/app/(payload)/cms/importMap.js",
  ]),
]);

export default eslintConfig;
