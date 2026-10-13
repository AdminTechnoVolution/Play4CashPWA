import { defineConfig } from "cypress";

export default defineConfig({
  e2e: {
    // Matches vite.config.ts's dev server port. Run `npm run dev` (or `npm run preview`
    // against a production build) before `npm run cypress:run` / `cypress:open`.
    baseUrl: "http://localhost:3000",
    setupNodeEvents(on, config) {
      return config;
    },
  },

  component: {
    devServer: {
      framework: "react",
      bundler: "vite",
    },
  },
});
