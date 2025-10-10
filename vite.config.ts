import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
    base: '/time-bomb/',
    plugins: [react()],
    server: {
        host: true,
        port: 5174,
        watch: {
            usePolling: true,
        },
    },
});
