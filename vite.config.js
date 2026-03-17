import { defineConfig } from 'vite';
import fs from 'fs';

export default defineConfig({
  base: '/commandmissiles/',  // Set base path for production
  server: {
    https: {
      key: fs.readFileSync('.cert/key.pem'),
      cert: fs.readFileSync('.cert/cert.pem'),
    },
    host: true, // Listen on all addresses
    port: 5173,
  },
});
