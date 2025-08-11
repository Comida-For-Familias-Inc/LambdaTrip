/** @type {import('tailwindcss').Config} */
module.exports = {
	prefix: 'tw-',
	important: false,
	content: [
		"./src/**/*.{html,js,jsx}",
		"./src/apps/**/*.{html,js,jsx}",
		"./src/apps/traveler/*.{html,js,jsx}",
		"./src/apps/traveler/**/*.{html,js,jsx}",
		"!.hoverpreview.temp.html"
	],
	darkMode: 'class',
	theme: {
		extend: {
			colors: {
				primary: '#f3c776',
				secondary: '#ed7a36'
			}
		},
	},
	plugins: [],
}

