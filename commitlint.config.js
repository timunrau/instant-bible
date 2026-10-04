export default {
	extends: ['@commitlint/config-conventional'],
	rules: {
		// Release notes can contain long prose; enforce the header, not body wrapping.
		'body-max-line-length': [0],
		'footer-max-line-length': [0],
	},
}
