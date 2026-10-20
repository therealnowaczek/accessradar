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
      // Radrly layout standard R-0.3 / R-2.2: no @atlaskit/css (cssMap breaks in Vite without the
      // Compiled plugin) and no deprecated @atlaskit/side-navigation.
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: '@atlaskit/css', message: 'Use xcss from @atlaskit/primitives.' },
            {
              name: '@atlaskit/side-navigation',
              message: 'Use @atlaskit/navigation-system + @atlaskit/side-nav-items.',
            },
          ],
          patterns: [
            {
              group: ['@atlaskit/side-navigation/*'],
              message: 'Use @atlaskit/navigation-system + @atlaskit/side-nav-items.',
            },
          ],
        },
      ],
      ...reactHooks.configs.recommended.rules,
      'react-hooks/set-state-in-effect': 'off',
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    // Atlassian Design System everywhere in the Custom UI: ADS components instead of native
    // controls, design tokens instead of literal colours/spacing/typography.
    files: ['static/app/src/**/*.{ts,tsx}'],
    // SpikePanel is development-only and replaced by an empty stub in deployed builds.
    ignores: ['static/app/src/**/*.test.{ts,tsx}', 'static/app/src/views/SpikePanel.tsx'],
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
      // Blocks deprecated ADS packages, e.g. @atlaskit/side-navigation (the sidebar is built on
      // @atlaskit/navigation-system + @atlaskit/side-nav-items, Radrly layout standard R-2.2).
      '@atlaskit/design-system/no-deprecated-imports': 'error',
      '@atlaskit/design-system/no-deprecated-design-token-usage': 'error',
      '@atlaskit/design-system/use-visually-hidden': 'error',
      '@atlaskit/design-system/use-heading': 'error',
      '@atlaskit/design-system/icon-label': 'error',
      '@atlaskit/design-system/prefer-primitives': 'error',
      // Radrly layout standard 12.2 (v1.1): the remaining rules of the shared list of 14.
      '@atlaskit/design-system/no-deprecated-apis': 'error',
      '@atlaskit/design-system/no-empty-icon-button-label': 'error',
      '@atlaskit/design-system/use-drawer-label': 'error',
      '@atlaskit/design-system/use-modal-title': 'error',
    },
  },
  prettier,
);
