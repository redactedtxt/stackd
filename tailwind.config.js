/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Brand palette — vivid lime + deep ink, built for a GenZ aesthetic.
        brand: {
          50: '#f3ffe5',
          100: '#e3ffc2',
          200: '#c8ff8a',
          300: '#a8f74e',
          400: '#8ceb1f',
          500: '#6dd400',
          600: '#54a800',
          700: '#3f7f02',
          800: '#346408',
          900: '#2c540c',
        },
        ink: {
          50: '#f5f6fa',
          100: '#eaecf3',
          200: '#d0d4e4',
          300: '#a7afcb',
          400: '#7783ae',
          500: '#566494',
          600: '#434e7b',
          700: '#373f64',
          800: '#242945',
          900: '#15182b',
          950: '#0b0d1a',
        },
        loss: '#ff5c7a',
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-up': 'fadeUp 0.35s ease-out both',
        'pulse-soft': 'pulseSoft 2.4s ease-in-out infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
    },
  },
  plugins: [],
};
