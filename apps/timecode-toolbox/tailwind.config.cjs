/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/components/frontend/**/*.{ts,tsx,css}'],
  corePlugins: {
    preflight: false,
  },
};