/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        autofillBg: '#ffffff', // Set autofill background color
      },
    },
  },
  plugins: [
    require('tailwind-scrollbar-hide')
  ],
};
