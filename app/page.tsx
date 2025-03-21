'use client';

import { useEffect, useState } from 'react';
import io from 'socket.io-client';
import styles from './styles/page.module.css';

import GameComponent from '@/app/components/Game';

export default function Home() {
	return (
		<main className={styles.main}>
			<GameComponent />
		</main>
	);
} 