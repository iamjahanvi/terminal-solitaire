import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// @vitejs/plugin-react transforms .js/.jsx/.ts/.tsx by default, so the JSX
// living inside react-app.jsx is handled without extra configuration.
export default defineConfig({
  plugins: [react()],
});
