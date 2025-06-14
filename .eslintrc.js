module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  parserOptions: {
    ecmaVersion: 2021,
    sourceType: 'module',
    project: './tsconfig.json',
  },
  env: {
    browser: true,
    node: true,
    es6: true,
  },
  globals: {
    // External Libraries
    'DecafMUD': 'readonly',
    'jQuery': 'readonly',
    '$': 'readonly',
    'SparkMD5': 'readonly',
    // DecafMUD menu.js globals
    'MENU_HELP': 'readonly',
    'MI_SUBMENU': 'readonly',
    'MENU_OPTIONS': 'readonly',
    // MUME project globals (need to verify origin of fkeys_enabled, numpad_enabled)
    'fkeys_enabled': 'readonly',
    'numpad_enabled': 'readonly',
    'globalMap': 'readonly', // or 'writable' if it's reassigned, but usually globals from TS are for reading
    'globalMapWindow': 'writable', // Can be reassigned
    'globalSplit': 'readonly', // or 'writable'
    'canvasFitParent': 'readonly',
    // Add other DecafMUD globals that might be missing if more errors appear
    'dragObject': 'readonly', // From DRAGGER.js / decafmud.interface.panels.menu.js
    'get_fontsize': 'readonly', // From decafmud.display.standard.js potentially, or another UI script
    'set_fontsize': 'readonly',
    'fkeymacros': 'readonly', // From decafmud.interface.panels.menu.js (related to fkeys_enabled)
    'numpadwalking': 'readonly', // From decafmud.interface.panels.menu.js (related to numpad_enabled)
    'toggle_fkeys': 'readonly',
    'toggle_numpad': 'readonly',
    'progress_visible': 'readonly',
    'toggle_progressbars': 'readonly',
    'showmap': 'readonly',
    'toggle_map': 'readonly'
  },
  ignorePatterns: [
    "dist/",
    "node_modules/",
    "DecafMUD/",
    "resources/",
    "*.d.ts"
  ],
  rules: {
    "@typescript-eslint/no-unused-vars": [
      "warn",
      {
        "argsIgnorePattern": "^_",
        "varsIgnorePattern": "^_",
        "caughtErrorsIgnorePattern": "^_"
      }
    ]
  },
  overrides: [
    {
      files: ['*.js'],
      parserOptions: {
        project: null,
      },
      rules: {
        '@typescript-eslint/no-var-requires': 'off',
      }
    }
  ]
};
