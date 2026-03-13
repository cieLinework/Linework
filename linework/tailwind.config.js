/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        bg:       '#0d0e12',
        surface:  '#13151c',
        surface2: '#1a1d27',
        surface3: '#22263a',
        border:   '#2a2f45',
        accent:   '#4f8eff',
        accent2:  '#7c5cfc',
        green:    '#2dce89',
        yellow:   '#ffb800',
        red:      '#ff4757',
        orange:   '#ff7730',
        text1:    '#f0f2ff',
        text2:    '#c8d0ee',
        text3:    '#9aa5cc',
      },
      fontFamily: {
        syne: ['Syne', 'sans-serif'],
        mono: ['DM Mono', 'monospace'],
      },
    },
  },
  plugins: [],
}
