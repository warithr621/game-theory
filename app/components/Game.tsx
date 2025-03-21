'use client';

import { useState, useEffect } from 'react';
import io, { Socket } from 'socket.io-client';
import styles from '../styles/Game.module.css';

interface Card {
	suit: string;
	rank: string;
}

interface Player {
	id: string;
	name: string;
	cards: Card[];
}

interface Lobby {
	players: Player[];
	gameStarted: boolean;
	countdown: number;
	currentRound: number;
	lastPlacedCard: Card | null;
	gameOver: boolean;
	error: boolean;
	errorMessage: string;
	allDistributedCards: Card[];
}

const getServerUrl = () => {
	if (process.env.NODE_ENV === 'production') {
		// Use the SOCKET_SERVER_URL environment variable in production
		return process.env.SOCKET_SERVER_URL || window.location.origin;
	}
	// In development, use localhost:3001
	return 'http://localhost:3001';
};

export default function Game() {
	const [socket, setSocket] = useState<Socket | null>(null);
	const [playerName, setPlayerName] = useState('');
	const [gameState, setGameState] = useState<'lobby' | 'waiting' | 'playing'>('lobby');
	const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [showRules, setShowRules] = useState(false);

	useEffect(() => {
		const newSocket = io(getServerUrl(), {
			reconnection: true,
			reconnectionAttempts: 5,
			reconnectionDelay: 1000,
			transports: ['websocket', 'polling']
		});

		setSocket(newSocket);

		return () => {
			newSocket.close();
		};
	}, []);

	useEffect(() => {
		if (!socket) return;

		socket.on('connect', () => {
			console.log('Connected to server');
			setIsConnected(true);
			if (playerName && currentLobby) {
				socket.emit('joinLobby', playerName);
			}
		});

		socket.on('disconnect', () => {
			console.log('Disconnected from server');
			setIsConnected(false);
			setError('Disconnected from server. Reconnecting...');
			setTimeout(() => setError(null), 3000);
		});

		socket.on('lobbyUpdate', (lobby: Lobby) => {
			setCurrentLobby(lobby);
			setGameState('waiting');
			updateCurrentPlayer(lobby);
		});

		socket.on('gameStarting', (lobby: Lobby) => {
			setCurrentLobby(lobby);
			setGameState('waiting');
			updateCurrentPlayer(lobby);
		});

		socket.on('countdownUpdate', (countdown: number) => {
			if (currentLobby) {
				setCurrentLobby({ ...currentLobby, countdown });
			}
		});

		socket.on('gameStart', (lobby: Lobby) => {
			setCurrentLobby(lobby);
			setGameState('playing');
			updateCurrentPlayer(lobby);
		});

		socket.on('cardPlaced', ({ player, card, lobby }: { player: string; card: Card; lobby: Lobby }) => {
			setCurrentLobby(lobby);
			const updatedPlayer = lobby.players.find(p => p.id === socket?.id);
			setCurrentPlayer(updatedPlayer || null);
		});

		socket.on('gameError', ({ message, lobby }: { message: string; lobby: Lobby }) => {
			console.log('Game error event received:', { message, lobby });
			setCurrentLobby(lobby);
			const updatedPlayer = lobby.players.find(p => p.id === socket?.id);
			setCurrentPlayer(updatedPlayer || null);
		});

		socket.on('roundComplete', ({ message, lobby }: { message: string; lobby: Lobby }) => {
			setCurrentLobby(lobby);
			updateCurrentPlayer(lobby);
		});

		socket.on('error', (message: string) => {
			setError(message);
			setTimeout(() => setError(null), 1000);
		});

		return () => {
			socket.off('connect');
			socket.off('disconnect');
			socket.off('lobbyUpdate');
			socket.off('gameStarting');
			socket.off('countdownUpdate');
			socket.off('gameStart');
			socket.off('cardPlaced');
			socket.off('gameError');
			socket.off('roundComplete');
			socket.off('error');
		};
	}, [socket, currentLobby, playerName]);

	const updateCurrentPlayer = (lobby: Lobby) => {
		if (!socket) return;
		const player = lobby.players.find(p => p.id === socket.id);
		setCurrentPlayer(player || null);
	};

	const joinLobby = () => {
		if (!socket) {
			console.error('No socket connection available');
			setError('No connection to game server');
			return;
		}
		if (!playerName.trim()) {
			setError('Please enter your name');
			setTimeout(() => setError(null), 1000);
			return;
		}

		console.log('Attempting to join lobby with name:', playerName);
		socket.emit('joinLobby', playerName);
	};

	const startGame = () => {
		if (!socket) return;
		if (!currentLobby) {
			setError('Not in a lobby');
			setTimeout(() => setError(null), 1000);
			return;
		}
		if (currentLobby.players.length < 2) {
			setError('Need at least 2 players to start');
			setTimeout(() => setError(null), 1000);
			return;
		}
		socket.emit('startGame');
	};

	const placeCard = (card: Card) => {
		if (!socket) return;
		socket.emit('placeCard', card);
	};

	const continueGame = () => {
		if (!socket) return;
		socket.emit('continueGame');
	};

	const resetGame = () => {
		if (!socket) return;
		socket.emit('retryRound');
	};

	const handleKeyPress = (e: React.KeyboardEvent) => {
		if (e.key === 'Enter' && playerName.trim()) {
			joinLobby();
		}
	};

	const formatCard = (card: Card) => {
		const suitSymbols: { [key: string]: string } = {
			hearts: '♥',
			diamonds: '♦',
			spades: '♠',
			clubs: '♣'
		};
		const suitColors: { [key: string]: string } = {
			hearts: 'red',
			diamonds: 'red',
			spades: 'black',
			clubs: 'black'
		};
		return (
			<div 
				className={styles.card}
				data-rank={card.rank}
				data-suit={suitSymbols[card.suit]}
				style={{ color: suitColors[card.suit] }}
			>
				<div className={styles.cardCorner}>
					{card.rank}
				</div>
				<div className={styles.cardCenter}>
					{suitSymbols[card.suit]}
				</div>
				<div className={styles.cardCornerBottom}>
					{card.rank}
				</div>
			</div>
		);
	};

	const getCardsPerPlayer = (round: number, playerCount: number) => {
		return round + (playerCount >= 5 ? 0 : 1);
		// if at least 5 players, start with 1 card instead of 2
	};

	return (
		<div className={styles.container}>
			{error && <div className={styles.error}>{error}</div>}
			
			<div className={styles.rulesToggle}>
				<button onClick={() => setShowRules(!showRules)} className={styles.rulesButton}>
					Card Order ▼
				</button>
				{showRules && (
					<div className={styles.rulesDropdown}>
						<h3>Card Order</h3>
						<br></br>
						<div className={styles.rulesSection}>
							<h4>Suit Order (Low to High):</h4>
							<br></br>
							<ol>
								<li>♥️ Hearts</li>
								<li>♦️ Diamonds</li>
								<li>♠️ Spades</li>
								<li>♣️ Clubs</li>
							</ol>
						</div>
						<div className={styles.rulesSection}>
							<h4>Rank Order (Low to High):</h4>
							<br></br>
							<p>A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K</p>
						</div>
					</div>
				)}
			</div>

			{gameState === 'lobby' && (
				<div className={styles.lobby}>
					<h1>Welcome to Game Theory!</h1>
					<div className={styles.joinForm}>
						<input
							type="text"
							value={playerName}
							onChange={(e) => setPlayerName(e.target.value)}
							onKeyPress={handleKeyPress}
							placeholder="Enter your name"
							className={styles.nameInput}
						/>
						<button onClick={joinLobby} className={styles.joinButton}>
							Join Game
						</button>
					</div>
				</div>
			)}

			{gameState !== 'lobby' && currentLobby && (
				<div className={styles.game}>
					<div className={styles.gameInfo}>
						<h2>{getCardsPerPlayer(currentLobby.currentRound, currentLobby.players.length)}-Card Round</h2>
						{currentLobby.gameStarted && currentLobby.countdown > 0 && (
							<div className={styles.countdown}>Starting in: {currentLobby.countdown}</div>
						)}
					</div>

					<div className={styles.players}>
						{currentLobby.players.map((player) => (
							<div key={player.id} className={styles.player}>
								<div className={styles.playerName}>
									{player.name} {player.id === socket?.id && '(You)'}
								</div>
								<div className={styles.cards}>
									{player.id === socket?.id
										? player.cards.map((card, index) => (
												<div
													key={index}
													onClick={() => currentLobby.countdown === 0 ? placeCard(card) : null}
													style={{ cursor: currentLobby.countdown === 0 ? 'pointer' : 'not-allowed' }}
												>
													{formatCard(card)}
												</div>
											))
										: player.cards.map((_, index) => (
												<div key={index} className={styles.hiddenCard} />
											))}
								</div>
							</div>
						))}
					</div>

					{currentLobby.lastPlacedCard && (
						<div className={styles.lastCard}>
							<h3>Last Placed Card</h3>
							{formatCard(currentLobby.lastPlacedCard)}
						</div>
					)}

					{currentLobby.gameOver && (
						<div className={styles.gameOver}>
							<h2>{currentLobby.error ? 'Round Failed!' : 'Round Complete!'}</h2>
							<br></br>
							{currentLobby.error ? (
								<>
									<p className={styles.errorMessage}>{currentLobby.errorMessage}</p>
									<br></br>
									<button onClick={resetGame} className={styles.button}>
										Retry Round
									</button>
								</>
							) : (
								<>
									<p>{currentLobby.errorMessage}</p>
									<br></br>
									<button onClick={continueGame} className={styles.button}>
										Continue to Next Round
									</button>
								</>
							)}
						</div>
					)}

					{!currentLobby.gameStarted && currentLobby.players.length >= 2 && (
						<button onClick={startGame} className={styles.startButton}>
							Start Game
						</button>
					)}
				</div>
			)}
		</div>
	);
} 