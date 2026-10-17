/*** @type {import('tailwindcss').Config} */
export default {
  content: ['./src/renderer/src/**/*.{ts,tsx,html}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#09090b',
          900: '#111827',
          800: '#1c1c1e',
          700: '#26262a',
          600: '#3a3a40'
        },
        paper: '#F8FAFC',
        lime: '#C7F36B',
        azure: '#6EA8FE'
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        display: ['Space Grotesk', 'Inter', 'system-ui', 'sans-serif']
      }
    }
  },
  plugins: []
}
