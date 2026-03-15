module.exports = {
  printWidth: 100,
  tabWidth: 2,
  useTabs: false,
  semi: true,
  singleQuote: false,
  quoteProps: "as-needed",
  trailingComma: "all",
  jsxSingleQuote: false,
  bracketSpacing: true,
  bracketSameLine: false,
  singleAttributePerLine: false,
  arrowParens: "always",
  endOfLine: "lf",
  insertPragma: false,
  requirePragma: false,
  proseWrap: "always",
  htmlWhitespaceSensitivity: "css",
  embeddedLanguageFormatting: "auto",
  plugins: ["prettier-plugin-tailwindcss"],
  overrides: [
    {
      files: ["**/*.json", "**/*.jsonc"],
      options: {
        tabWidth: 2,
        useTabs: false,
      },
    },
    {
      files: ["**/*.md", "**/*.mdx"],
      options: {
        proseWrap: "always",
        printWidth: 80,
      },
    },
    {
      files: ["**/*.yml", "**/*.yaml"],
      options: {
        tabWidth: 2,
        singleQuote: false,
      },
    },
  ],
};
