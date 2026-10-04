import js from '@eslint/js'
import ts from 'typescript-eslint'
import vue from 'eslint-plugin-vue'
import globals from 'globals'
export default ts.config(
	{
		ignores: [
			'dist/**',
			'node_modules/**',
			'test-results/**',
			'playwright-report/**',
			'public/**',
			'src/data/**',
		],
	},
	js.configs.recommended,
	...ts.configs.recommended,
	...vue.configs['flat/recommended'],
	{
		languageOptions: {
			globals: {
				...globals.browser,
				...globals.node,
				__APP_VERSION__: 'readonly',
				__BUILD_SHA__: 'readonly',
			},
		},
	},
	{
		files: ['**/*.vue'],
		languageOptions: { parserOptions: { parser: ts.parser } },
		rules: {
			'vue/multi-word-component-names': 'off',
			'vue/html-self-closing': 'off',
			'vue/max-attributes-per-line': 'off',
			'vue/singleline-html-element-content-newline': 'off',
			'vue/html-indent': 'off',
			'vue/html-closing-bracket-newline': 'off',
			'vue/first-attribute-linebreak': 'off',
		},
	},
)
