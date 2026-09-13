/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                dark: {
                    bg: '#1a1a1a',
                    layer: '#282828',
                    border: '#3e3e3e',
                    text: '#eff1f6',
                    muted: '#8a8a8a'
                },
                brand: {
                    primary: '#ffa116', // LeetCode-style orange
                    success: '#2cbb5d',
                    error: '#ef4743'
                }
            }
        },
    },
    plugins: [],
}