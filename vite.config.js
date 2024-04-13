
export default {
  build: {
		assetsInlineLimit: 0,
    rollupOptions: {
      input: {
				background: 'src/background.js',
        content: '/src/content.js',
        injected: '/src/injected.js',
        jsoneditor: '/src/jsoneditor.js',
        popup: '/src/popup.js'
			},
      output: {
        dir: 'dist',
        format: 'esm',
				entryFileNames: '[name].js',
      },
    },
  },
};