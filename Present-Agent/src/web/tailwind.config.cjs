/** @type {import('tailwindcss').Config} */
function safePlugin(name) {
  try { return require(name); } catch { return function noop() {}; }
}

module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
    "./lib/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {},
  },
  plugins: [safePlugin('tailwindcss-animate'), safePlugin('@tailwindcss/line-clamp')],
};
