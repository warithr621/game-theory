import type { Metadata } from 'next';
import './styles/globals.css';

export const metadata: Metadata = {
	title: 'Game Theory',
	description: 'An online card game',
};

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