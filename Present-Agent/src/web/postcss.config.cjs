const path = require('path');
module.exports = {
  plugins: {
    tailwindcss: { config: path.join(process.cwd(), 'tailwind.config.cjs') },
    autoprefixer: {},
  },
};
