import type { Metadata, Viewport } from 'next';
import './styles/globals.css';

export const metadata: Metadata = {
	title: 'Game Theory',
	description: 'An online card game'
};

export const viewport: Viewport = {
	width: 'device-width',
	initialScale: 1,
	maximumScale: 1,
	userScalable: false
}

export default function RootLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<html lang="en">
			<body suppressHydrationWarning={true}>{children}</body>
		</html>
	);
} 