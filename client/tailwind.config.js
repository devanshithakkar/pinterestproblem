/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: "#171412",
        ember: "#c9342a",
        blush: "#fff2f0",
        moss: "#326658",
        marigold: "#e0a72f",
        skyglass: "#dff2ff",
      },
      boxShadow: {
        soft: "0 18px 60px rgba(23, 20, 18, 0.12)",
        lift: "0 22px 70px rgba(201, 52, 42, 0.18)",
      },
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
    },
  },
  plugins: [],
};
