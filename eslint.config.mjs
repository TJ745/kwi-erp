import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import nextCoreWebVitals from "eslint-config-next/core-web-vitals";
import tseslint from "typescript-eslint";

const __dirname = dirname(fileURLToPath(import.meta.url));

export default tseslint.config(
  {
    ignores: [
      "node_modules/**",
      ".next/**",
      "src/generated/**",
      "prisma/migrations/**",
      "coverage/**",
      "playwright-report/**",
      "test-results/**",
      "next-env.d.ts",
    ],
  },

  ...nextCoreWebVitals,
  ...tseslint.configs.recommendedTypeChecked,

  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: __dirname,
      },
    },
    rules: {
      // --- Type safety: these are the §47 quality bar, not suggestions. ---
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      // --- Un-awaited promises corrupt data inside transactions. ---
      "@typescript-eslint/no-floating-promises": "error",
      "@typescript-eslint/no-misused-promises": "error",
      "@typescript-eslint/require-await": "error",
      "@typescript-eslint/await-thenable": "error",
    },
  },

  // --- Layering rules from docs/ARCHITECTURE.md §4. ---
  {
    files: ["src/app/**/*.{ts,tsx}", "src/components/**/*.{ts,tsx}", "src/lib/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@prisma/client", "**/generated/prisma/**", "@/server/db/*"],
              message:
                "UI and lib layers must not touch Prisma directly. Call a service (Server Component) or an action (Client Component). See docs/ARCHITECTURE.md §4.",
            },
            {
              group: ["@/server/crypto/*"],
              message:
                "Vault crypto is confined to src/server/services/vault. See docs/SECURITY.md §5.",
            },
          ],
        },
      ],
    },
  },

  // Vault crypto may only be imported by the vault service.
  {
    files: ["src/server/**/*.ts"],
    ignores: ["src/server/services/vault/**", "src/server/crypto/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["@/server/crypto/*", "../crypto/*", "./crypto/*"],
              message:
                "Only src/server/services/vault may import vault crypto. See docs/SECURITY.md §5.",
            },
          ],
        },
      ],
    },
  },

  // Server code must use the structured logger, which applies redaction.
  {
    files: ["src/server/**/*.ts"],
    rules: {
      "no-console": ["error", { allow: ["warn", "error"] }],
    },
  },

  // UploadThing requires throwing its own UploadThingError from route hooks
  // for error handling to work. It extends Effect's Micro.Error rather than
  // the native Error, so only-throw-error flags it — a false positive here.
  {
    files: ["src/app/api/uploadthing/**/*.ts"],
    rules: {
      "@typescript-eslint/only-throw-error": [
        "error",
        { allow: [{ from: "package", package: "@uploadthing/shared", name: "UploadThingError" }] },
      ],
    },
  },

  // Scripts and seeds are CLI tools: console output is the point.
  {
    files: ["prisma/**/*.ts", "scripts/**/*.ts", "*.config.{ts,mjs}"],
    rules: {
      "no-console": "off",
      "@typescript-eslint/no-floating-promises": "off",
    },
  },

  // Config files sit outside the TS project graph.
  {
    files: ["**/*.mjs", "**/*.js"],
    ...tseslint.configs.disableTypeChecked,
  },
);
