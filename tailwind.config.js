// tailwind.config.js
export const content = [
  "./index.html",
  "./src/**/*.{js,ts,jsx,tsx}", // include all JS/TS/React files inside src
];
export const theme = {
  extend: {
    animation: {
      'gradient-xy': 'gradient-xy 15s ease infinite',
    },
    keyframes: {
      'gradient-xy': {
        '0%, 100%': {
          'background-size': '400% 400%',
          'background-position': 'left center',
        },
        '50%': {
          'background-size': '200% 200%',
          'background-position': 'right center',
        },
      },
    },
  },
};
export const plugins = [];
