/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        bg: {
          base: '#000000',
          card: '#0B0B0C',
          elevated: '#121214',
        },
        border: '#1C1C1E',
        accent: {
          blue: '#2563EB',
          uv: '#8B5CF6',
          white: '#F3F4F6',
          red: '#EF4444',
          cyan: '#06B6D4',
        },
        text: {
          primary: '#FFFFFF',
          secondary: '#8E8E93',
          muted: '#5C5C5E',
        },
        status: {
          success: '#10B981',
          warning: '#F59E0B',
          error: '#EF4444',
        }
      },
      fontFamily: {
        display: ['Space Grotesk', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      }
    },
  },
  plugins: [],
}

