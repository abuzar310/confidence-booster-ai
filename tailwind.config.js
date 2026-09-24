/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink: {
          deep: '#0a0a0f',
          base: '#050506',
          elevated: '#121218',
        },
        brand: {
          DEFAULT: '#ec4899',
          fg: '#ffffff',
          accent: '#5e6ad2',
        }
      },
      fontFamily: {
        display: ['Righteous', 'sans-serif'],
        sans: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        ui: ['Poppins', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        film: '16px',
      },
      transitionTimingFunction: {
        cinema: 'cubic-bezier(0.16, 1, 0.3, 1)',
      }
    },
  },
  plugins: [],
}
