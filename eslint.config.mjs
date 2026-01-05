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
  {
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [
            {
              name: "next-auth",
              importNames: ["getServerSession"],
              message:
                "NextAuth v5: do not use getServerSession(). Use auth() from @/lib/auth or requireUserSession().",
            },
          ],
        },
      ],
    },
  },
  ...nextVitals,
  ...nextTs,
];
