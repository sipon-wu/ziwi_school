/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          DEFAULT: '#1A3A6B',
          hover: '#2B5DA8',
          dark: '#1E3A5F',
          light: 'rgba(26,58,107,0.08)',
        },
        sidebar: '#212529',
        page: '#F0F2F5',
        border: '#E4E7ED',
      },
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', '"PingFang SC"', '"Microsoft YaHei"', 'sans-serif'],
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
}
