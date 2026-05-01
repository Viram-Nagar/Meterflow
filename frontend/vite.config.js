import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      // EXACT fix: use regex to match /api/ with trailing slash
      // This matches: /api/v1/auth, /api/v1/apis etc
      // But NOT: /apis (React route)
      "^/api/": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
      // Gateway proxy
      "^/gateway/": {
        target: "http://localhost:5000",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});

// import { defineConfig } from "vite";
// import react from "@vitejs/plugin-react";

// export default defineConfig({
//   plugins: [react()],
//   server: {
//     port: 5173,
//     proxy: {
//       "/api": { target: "http://localhost:5000", changeOrigin: true },
//       "/gateway": { target: "http://localhost:5000", changeOrigin: true },
//     },
//   },
// });
////////////////////////////////////////////////////////////////////////////////////////////////////////////////////////
