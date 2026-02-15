/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                // Catppuccin Mocha Palette
                crust: '#11111b',
                mantle: '#181825',
                base: '#1e1e2e',
                surface0: '#313244',
                surface1: '#45475a',
                surface2: '#585b70',

                overlay0: '#6c7086',
                overlay1: '#7f849c',
                overlay2: '#9399b2',

                subtext0: '#a6adc8',
                subtext1: '#bac2de',
                text: '#cdd6f4',

                lavender: '#b4befe',
                blue: '#89b4fa',
                sapphire: '#74c7ec',
                sky: '#89dceb',
                teal: '#94e2d5',
                green: '#a6e3a1',
                yellow: '#f9e2af',
                peach: '#fab387',
                maroon: '#eba0ac',
                red: '#f38ba8',
                mauve: '#cba6f7',
                pink: '#f5c2e7',
                flamingo: '#f2cdcd',
                rosewater: '#f5e0dc',
            },
            fontFamily: {
                mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
            },
            boxShadow: {
                'hard': '4px 4px 0px rgba(17, 17, 27, 1)',
                'hard-hover': '6px 6px 0px rgba(17, 17, 27, 1)',
                'hard-red': '4px 4px 0px rgba(243, 139, 168, 0.3)',
                'hard-green': '4px 4px 0px rgba(166, 227, 161, 0.3)',
                'hard-peach': '4px 4px 0px rgba(250, 179, 135, 0.3)',
            },
            animation: {
                'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
                'terminal-blink': 'blink 1s step-end infinite',
            },
            keyframes: {
                blink: {
                    '0%, 50%': { opacity: '1' },
                    '51%, 100%': { opacity: '0' },
                }
            }
        },
    },
    plugins: [],
}
