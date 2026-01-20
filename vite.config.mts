import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import electron from 'vite-plugin-electron'
import electronRenderer from 'vite-plugin-electron-renderer'

// https://vite.dev/config/
export default defineConfig({
  base: './',
  plugins: [
    react(),
    {
      name: 'inject-debug-script',
      transformIndexHtml(html) {
        return html.replace(
          '<head>',
          `<head>
            <script>
              window.onerror = function(msg, url, line, col, error) {
                const div = document.createElement('div');
                div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:white;color:red;padding:20px;font-family:monospace;white-space:pre-wrap;overflow:auto;border: 5px solid red;font-size: 16px;';
                div.textContent = 'RENDERER ERROR:\\n' + msg + '\\n' + url + ':' + line + ':' + col + '\\n' + (error ? error.stack : '');
                document.body.appendChild(div);
              };
              window.onunhandledrejection = function(e) {
                 const div = document.createElement('div');
                 div.style.cssText = 'position:fixed;top:0;left:0;right:0;bottom:0;z-index:99999;background:white;color:red;padding:20px;font-family:monospace;white-space:pre-wrap;overflow:auto;border: 5px solid orange;font-size: 16px;';
                 div.textContent = 'UNHANDLED REJECTION:\\n' + e.reason;
                 document.body.appendChild(div);
              };
              console.log('Debug scripts injected');
              document.addEventListener('DOMContentLoaded', () => {
                  const div = document.createElement('div');
                  div.style.cssText = 'position:fixed;bottom:0;right:0;background:yellow;color:black;padding:5px;z-index:99999;font-size:12px;';
                  div.textContent = 'Renderer Loaded';
                  document.body.appendChild(div);
              });
            </script>`
        )
      }
    },
    electron([
      {
        entry: 'electron/main.ts',
        onstart(options) {
          options.startup()
        },
        vite: {
          build: {
            rollupOptions: {
              external: ['@vitejs/plugin-react']
            }
          }
        }
      },
      {
        entry: 'electron/preload.js',
        onstart(options) {
          options.reload()
        },
      }
    ]),
    electronRenderer()
  ],
  server: {
    port: 3000,
  },
  resolve: {
    alias: {
      '@': '/src',
    },
  },
})
