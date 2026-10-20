import designSystem from '@atlaskit/eslint-plugin-design-system';
import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';
import globals from 'globals';

export default tseslint.config(
  { ignores: ['**/node_modules/**', '**/dist/**', '**/build/**', 'coverage/**', 'spikes'] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.node } },
    rules: { '@typescript-eslint/no-explicit-any': 'off', 'no-console': 'off' },
  },
  {
    files: ['static/app/src/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // Atlassian Design System everywhere in the Custom UI: ADS components instead of native
    // controls, design tokens instead of literal colours/spacing/typography.
    files: ['static/app/src/**/*.tsx'],
    // SpikePanel is development-only and replaced by an empty stub in deployed builds.
    ignores: ['static/app/src/views/SpikePanel.tsx'],
    plugins: { '@atlaskit/design-system': designSystem },
    rules: {
      ...designSystem.configs['recommended/flat'].rules,
      '@atlaskit/design-system/ensure-design-token-usage': 'error',
      '@atlaskit/design-system/no-unsafe-design-token-usage': 'error',
      '@atlaskit/design-system/use-tokens-space': 'error',
      '@atlaskit/design-system/use-tokens-shape': 'error',
      '@atlaskit/design-system/use-tokens-typography': 'error',
      '@atlaskit/design-system/no-html-button': 'error',
      '@atlaskit/design-system/no-html-anchor': 'error',
      '@atlaskit/design-system/no-html-checkbox': 'error',
      '@atlaskit/design-system/no-html-radio': 'error',
      '@atlaskit/design-system/no-html-select': 'error',
      '@atlaskit/design-system/no-html-text-input': 'error',
      '@atlaskit/design-system/no-html-textarea': 'error',
      '@atlaskit/design-system/no-html-code': 'error',
      '@atlaskit/design-system/no-html-heading': 'error',
      '@atlaskit/design-system/no-html-image': 'error',
      '@atlaskit/design-system/no-html-range': 'error',
      '@atlaskit/design-system/use-primitives-text': 'error',
      // @atlaskit/side-navigation is still an ADS package but flagged for the Nav 4 migration
      // (@atlaskit/navigation-system); keep it visible as a warning until that migration.
      '@atlaskit/design-system/no-deprecated-imports': 'warn',
    },
  },
  prettier,
);
