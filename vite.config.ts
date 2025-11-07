import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import Icons from 'unplugin-icons/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [tailwindcss(), sveltekit(), Icons({ compiler: 'svelte' })],
	build: {
		// Set chunk size warning limit to accommodate lazy-loaded PDF.js
		// PDF.js is ~1.2MB but is only loaded when users import PDF files
		chunkSizeWarningLimit: 1500
	}
});
