module.exports = {
  content: ['./source/**/*.{ts,tsx}'],
  theme: {
    colors: {
      white: '#FFFFFF',
      black: '#263238',
      blue: {
        900: '#002978',
        800: '#0D40A1',
        700: '#155CC0',
        600: '#196DD2',
        500: '#1E7EE5',
        400: '#429CF5',
        300: '#6CB6FF',
        200: '#99CCFF',
        100: '#B7DBFF',
      },
      grey: {
        900: '#2C3E5A',
        800: '#374E72',
        700: '#42608B',
        600: '#4C6C9F',
        500: '#7F97BD',
        400: '#BCC8DC',
        300: '#D5DDEC',
        200: '#F0F3FA',
        100: '#FBFCFD',
      },
      alert: {
        600: '#641919',
        500: '#F44336',
        400: '#E57373',
        300: '#FFF2F4',
      },
      positive: {
        600: '#143906',
        500: '#689F38',
        400: '#9CCC65',
        300: '#EFF8E4',
        200: '#F1FAF1',
      },
      neutral: {
        600: '#5B2D0A',
        500: '#FFA000',
        400: '#FFCA28',
        300: '#FFF9E8',
      },
    },
    fontFamily: {
      sans: ['Montserrat'],
      mono: ['Noto Sans Mono']
    },
    fontSize: {
      disclaimer: '12pt',
      body: '14pt',
      title: '20pt',
      large: '24pt',
    },
    boxShadow: {
      shadow: [
        '0px 0px 1px rgba(0, 41, 120, 0.05),',
        '0px 2px 4px rgba(30, 126, 229, 0.1);',
      ].join(' '),
      sm: [
        '0px 0px 1px rgba(0, 41, 120, 0.05),',
        '0px 0.5px 2px rgba(30, 126, 229, 0.1);',
      ].join(' '),
      md: [
        '0px 0px 2px rgba(0, 41, 120, 0.05),',
        '0px 4px 8px rgba(30, 126, 229, 0.1);',
      ].join(' '),
      lg: [
        '0px 2px 4px rgba(0, 41, 120, 0.05),',
        '0px 8px 16px rgba(30, 126, 229, 0.1)',
      ].join(' '),
      xl: '0px 10px 30px rgba(30, 126, 229, 0.1)',
      '2xl': [
        '0px 2px 8px rgba(0, 41, 120, 0.05),',
        '0px 20px 32px rgba(30, 126, 229, 0.1)',
      ].join(' '),
    },
  },
  extend: {
    spacing: {
      line: '1px',
      tiny: '3px',
      small: '6px',
      base: '12px',
      medium: '18px',
      large: '24px',
      wide: '48px',
    },
  },
  plugins: [],
};
