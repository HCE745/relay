import { FlatCompat } from "@eslint/eslintrc"

// eslint-config-next 15 ships legacy (.eslintrc-style) shareable configs, so we
// bridge them into ESLint 9's flat config via FlatCompat. (Relay is on
// eslint-config-next 16, which exports flat configs directly — different setup.)
const compat = new FlatCompat({ baseDirectory: import.meta.dirname })

const eslintConfig = [
  ...compat.config({
    extends: ["next/core-web-vitals", "next/typescript"],
  }),
  {
    ignores: [".next/**", "out/**", "build/**", "next-env.d.ts", "src/generated/**"],
  },
]

export default eslintConfig
