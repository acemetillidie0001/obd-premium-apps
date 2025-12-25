import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default [
  {
    ignores: [
      "scripts/**",
      "docs/**",
      "prisma/migrations/**",
      "**/*.md",
      ".next/**",
      "out/**",
      "build/**",
      "dist/**",
      "next-env.d.ts",
    ],
  },
  ...nextVitals,
  ...nextTs,
];
