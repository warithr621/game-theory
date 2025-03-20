import React, { useState, useEffect } from 'react';
import { Card } from './gameLogic';
import { io } from 'socket.io-client';
import './App.css';

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

// Get the server URL based on the client's location
const getServerUrl = () => {
	// If we're accessing from localhost, use localhost
	if (window.location.hostname === 'localhost') {
		return 'http://localhost:3001';
	}
	// Otherwise, use the same hostname as the client but with port 3001
	return `http://${window.location.hostname}:3001`;
};

const socket = io(getServerUrl(), {
	reconnection: true,
	reconnectionAttempts: 5,
	reconnectionDelay: 1000
});

function App() {
	const [playerName, setPlayerName] = useState('');
	const [gameState, setGameState] = useState<'lobby' | 'waiting' | 'playing'>('lobby');
	const [currentLobby, setCurrentLobby] = useState<Lobby | null>(null);
	const [error, setError] = useState<string | null>(null);
	const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
	const [isConnected, setIsConnected] = useState(false);
	const [showRules, setShowRules] = useState(false);

	useEffect(() => {
		socket.on('connect', () => {
			console.log('Connected to server');
			setIsConnected(true);
			// If we were in a game, rejoin with the same name
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
			console.log('Lobby updated:', lobby);
			setCurrentLobby(lobby);
			setGameState('waiting');
			updateCurrentPlayer(lobby);
		});

		socket.on('gameStarting', (lobby: Lobby) => {
			console.log('Game starting:', lobby);
			setCurrentLobby(lobby);
			setGameState('waiting');
			updateCurrentPlayer(lobby);
		});

		socket.on('countdownUpdate', (countdown: number) => {
			console.log('Countdown:', countdown);
			if (currentLobby) {
				setCurrentLobby({ ...currentLobby, countdown });
			}
		});

		socket.on('gameStart', (lobby: Lobby) => {
			console.log('Game started');
			setCurrentLobby(lobby);
			setGameState('playing');
			updateCurrentPlayer(lobby);
		});

		socket.on('cardPlaced', ({ player, card, lobby }: { player: string; card: Card; lobby: Lobby }) => {
			console.log('Card placed:', { player, card });
			setCurrentLobby(lobby);
			updateCurrentPlayer(lobby);
		});

		socket.on('gameError', ({ message, lobby }: { message: string; lobby: Lobby }) => {
			console.error('Game error:', message);
			setCurrentLobby(lobby);
			updateCurrentPlayer(lobby);
		});

		socket.on('roundComplete', ({ message, lobby }: { message: string; lobby: Lobby }) => {
			console.log('Round complete:', message);
			setCurrentLobby(lobby);
			updateCurrentPlayer(lobby);
		});

		socket.on('error', (message: string) => {
			console.error('Error:', message);
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
	}, [currentLobby, playerName]);

	const updateCurrentPlayer = (lobby: Lobby) => {
		const player = lobby.players.find(p => p.id === socket.id);
		setCurrentPlayer(player || null);
	};

	const joinLobby = () => {
		if (!playerName.trim()) {
			setError('Please enter your name');
			setTimeout(() => setError(null), 1000);
			return;
		}
		if (!socket.id) {
			setError('Not connected to server');
			setTimeout(() => setError(null), 1000);
			return;
		}

		console.log('Joining lobby as:', playerName);
		socket.emit('joinLobby', playerName);
	};

	const startGame = () => {
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
		socket.emit('placeCard', card);
	};

	const continueGame = () => {
		if (socket) {
			socket.emit('continueGame');
		}
	};

	const resetGame = () => {
		if (socket) {
			socket.emit('retryRound');
		}
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
				className="card"
				data-rank={card.rank}
				data-suit={suitSymbols[card.suit]}
				style={{ color: suitColors[card.suit] }}
			>
				<div className="card-center">
					{card.rank}
				</div>
			</div>
		);
	};

	// Total cards that must be distirbuted
	const calculateTotalCards = () => {
		if (!currentLobby) return 0;
		const cardsPerPlayer = 2 + currentLobby.currentRound - 1;
		return cardsPerPlayer * currentLobby.players.length;
	};

	const hasExceededDeckSize = () => {
		return calculateTotalCards() > 52;
	};

	const playerCards = currentPlayer ? [...currentPlayer.cards] : [];

	return (
		<div className="App">
			<div className="rules-toggle">
				<button onClick={() => setShowRules(!showRules)} className="rules-button">
					Rules ▼
				</button>
				{showRules && (
					<div className="rules-dropdown">
						<h3>Card Order Rules</h3>
						<div className="rules-section">
							<h4>Suit Order (Low to High):</h4>
							<ol>
								<li>♥️ Hearts</li>
								<li>♦️ Diamonds</li>
								<li>♠️ Spades</li>
								<li>♣️ Clubs</li>
							</ol>
						</div>
						<div className="rules-section">
							<h4>Rank Order (Low to High):</h4>
							<p>A, 2, 3, 4, 5, 6, 7, 8, 9, 10, J, Q, K</p>
						</div>
						<p className="rules-note">The players must work together to place their cards in the above order, without directly revealing the cards in their hand.</p>
					</div>
				)}
			</div>
			{!isConnected && (
				<div className="connection-status">
					Connecting to server...
				</div>
			)}
			
			{gameState === 'lobby' && (
				<div className="join-form">
					<h2>Welcome to Game Theory!</h2>
					<input
						type="text"
						placeholder="Enter your name"
						value={playerName}
						onChange={(e) => setPlayerName(e.target.value)}
						onKeyPress={handleKeyPress}
						disabled={!isConnected}
					/>
					<button 
						onClick={joinLobby}
						disabled={!isConnected}
					>
						Join Lobby
					</button>
				</div>
			)}

			{gameState === 'waiting' && currentLobby && (
				<div className="lobby">
					<h2>Game Lobby</h2>
					<div className="players-list">
						<h3>Players ({currentLobby.players.length}):</h3>
						{currentLobby.players.map((player) => (
							<div key={player.id} className="player-item">
								{player.name}
							</div>
						))}
					</div>
					{currentLobby.gameStarted && currentLobby.countdown > 0 && (
						<div className="countdown">
							Game starting in {currentLobby.countdown}...
						</div>
					)}
					{currentLobby.players.length >= 2 && !currentLobby.gameStarted && (
						<button 
							className="start-button"
							onClick={startGame}
						>
							Start Game
						</button>
					)}
				</div>
			)}

			{gameState === 'playing' && currentLobby && currentPlayer && (
				<div className={`game ${currentLobby.gameOver ? 'round-complete' : ''}`}>
					<h2>Round {currentLobby.currentRound}</h2>
					{hasExceededDeckSize() && (
						<div className="game-over">
							<h2>Game Complete!</h2>
							<p>Congratulations! You've successfully played through the entire deck!</p>
						</div>
					)}
					<div className="game-info">
						<div className="last-placed-card">
							{currentLobby.lastPlacedCard ? (
								formatCard(currentLobby.lastPlacedCard)
							) : (
								<div className="card empty">No card placed yet</div>
							)}
						</div>
					</div>

					<div className="player-hand">
						{playerCards.map((card, index) => (
							<div key={`${card.suit}-${card.rank}-${index}`}>
								{formatCard(card)}
							</div>
						))}
					</div>

					<button 
						className="place-card-button"
						onClick={() => {
							if (playerCards.length > 0) {
								const lowestCard = playerCards.reduce((lowest, current) => {
									if (!lowest) return current;
									if (current.suit === lowest.suit) {
										return current.rank < lowest.rank ? current : lowest;
									}
									return ['hearts', 'diamonds', 'spades', 'clubs'].indexOf(current.suit) < 
												 ['hearts', 'diamonds', 'spades', 'clubs'].indexOf(lowest.suit) 
									? current : lowest;
								});
								placeCard(lowestCard);
							}
						}}
					>
						Place Card
					</button>
				</div>
			)}

			{gameState === 'playing' && currentLobby && currentPlayer && currentLobby.gameOver && (
				<div className="game-over">
					<h2>{currentLobby.error ? 'Game Over!' : 'Round Complete!'}</h2>
					{currentLobby.error ? (
						<>
							<p className="error-message">{currentLobby.errorMessage}</p>
							<button onClick={resetGame} className="reset-button">
								Reset Round
							</button>
						</>
					) : (
						<>
							<p>{currentLobby.errorMessage}</p>
							<button onClick={continueGame} className="continue-button">
								Continue to Next Round
							</button>
						</>
					)}
				</div>
			)}

			{error && (
				<div className="error-message">
					{error}
				</div>
			)}
		</div>
	);
}

export default App;
