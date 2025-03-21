/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
	experimental: {
		serverActions: {
			allowedOrigins: ['localhost:3000', 'localhost:3001']
		}
	},
	env: {
		SOCKET_SERVER_URL: process.env.NODE_ENV === 'development' 
			? 'http://localhost:3001' 
			: process.env.SOCKET_SERVER_URL
	}
}

module.exports = nextConfig 