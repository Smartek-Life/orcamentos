/** @type {import('tailwindcss').Config} */
export default {
  content: ['./client/index.html', './client/src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        slateink: '#10243A',
        tide: '#185FA5',
        pine: '#0F6E56',
        sand: '#F5E6C8',
        cloud: '#F7FAFC'
      },
      boxShadow: {
        soft: '0 24px 60px rgba(16, 36, 58, 0.14)'
      },
      backgroundImage: {
        shell: 'radial-gradient(circle at top left, rgba(24,95,165,0.18), transparent 30%), radial-gradient(circle at bottom right, rgba(15,110,86,0.18), transparent 28%), linear-gradient(135deg, #f8fafc 0%, #eef5fb 52%, #f6efe1 100%)'
      },
      fontFamily: {
        sans: ['"Segoe UI"', 'Tahoma', 'Geneva', 'Verdana', 'sans-serif']
      }
    }
  },
  plugins: []
};
