import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createDeck, shuffleDeck, distributeCards, Card, ranks, suits } from './gameLogic';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
	origin: process.env.NODE_ENV === 'production'
		? true  // Allow all origins in production
		: 'http://localhost:3000',
	methods: ['GET', 'POST', 'OPTIONS'],
	credentials: true,
	allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
}));

const server = createServer(app);
const io = new Server(server, {
	cors: {
		origin: process.env.NODE_ENV === 'production'
			? true  // Allow all origins in production
			: 'http://localhost:3000',
		methods: ['GET', 'POST'],
		credentials: true,
		allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'Accept']
	},
	transports: ['websocket', 'polling'],
	pingTimeout: 60000,
	pingInterval: 25000,
	path: '/socket.io/',
	allowEIO3: true
});

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
	expectedCardIndex: number;
}

const lobby: Lobby = {
	players: [],
	gameStarted: false,
	countdown: 0,
	currentRound: 1,
	lastPlacedCard: null,
	gameOver: false,
	error: false,
	errorMessage: '',
	allDistributedCards: [],
	expectedCardIndex: 0
};

const getCardsPerPlayer = (round: number, playerCount: number) => {
	return round + (playerCount >= 5 ? 0 : 1);
};

io.on('connection', (socket) => {
	console.log('\nUser connected:', socket.id);
	console.log('Environment:', process.env.NODE_ENV);
	console.log('Origin:', socket.handshake.headers.origin);

	socket.on('error', (error) => {
		console.error('Socket error:', error);
	});

	socket.on('connect_error', (error) => {
		console.error('Connection error:', error);
	});

	socket.on('joinLobby', (playerName: string) => {
		if (!playerName.trim()) {
			socket.emit('error', 'Please enter your name');
			return;
		}

		const player: Player = {
			id: socket.id,
			name: playerName,
			cards: []
		};

		// Check if player already exists
		const existingPlayerIndex = lobby.players.findIndex(p => p.id === socket.id);
		if (existingPlayerIndex !== -1) {
			lobby.players[existingPlayerIndex].name = playerName;
		} else {
			lobby.players.push(player);
		}

		// Reset game state but preserve round number
		const currentRound = lobby.currentRound;
		lobby.gameStarted = false;
		lobby.countdown = 3;
		lobby.lastPlacedCard = null;
		lobby.gameOver = false;
		lobby.error = false;
		lobby.errorMessage = '';
		lobby.allDistributedCards = [];
		lobby.currentRound = currentRound;
		lobby.expectedCardIndex = 0;

		lobby.players.forEach(p => p.cards = []);
		socket.join('lobby');
		console.log(`Player ${playerName} joined the lobby`);
		
		io.to('lobby').emit('lobbyUpdate', lobby);
	});

	socket.on('startGame', () => {
		if (lobby.players.length < 2) {
			socket.emit('error', 'Need at least 2 players to start');
			return;
		}

		if (lobby.gameStarted) {
			socket.emit('error', 'Game already started');
			return;
		}

		// Reset game state
		lobby.gameStarted = true;
		lobby.countdown = 3;
		lobby.currentRound = 1;
		lobby.lastPlacedCard = null;
		lobby.gameOver = false;
		lobby.error = false;
		lobby.errorMessage = '';
		lobby.allDistributedCards = [];
		lobby.expectedCardIndex = 0;

		// Deal initial cards (number depends on player count)
		const deck = shuffleDeck(createDeck());
		const cardsPerPlayer = getCardsPerPlayer(lobby.currentRound, lobby.players.length);
		const distributedCards = distributeCards(deck, lobby.players.length, cardsPerPlayer);
		
		// Store all distributed cards in sorted order
		lobby.allDistributedCards = distributedCards.flat().sort((a, b) => {
			const suitDiff = suits.indexOf(a.suit) - suits.indexOf(b.suit);
			if (suitDiff !== 0) return suitDiff;
			return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
		});
		
		lobby.players.forEach((player, index) => {
			player.cards = distributedCards[index];
		});

		io.to('lobby').emit('gameStarting', lobby);

		const countdownInterval = setInterval(() => {
			lobby.countdown--;
			io.to('lobby').emit('countdownUpdate', lobby.countdown);

			if (lobby.countdown <= 0) {
				clearInterval(countdownInterval);
				io.to('lobby').emit('gameStart', lobby);
			}
		}, 1000);
	});

	socket.on('placeCard', (card: Card) => {
		if (!lobby.gameStarted || lobby.gameOver) return;
		if (lobby.countdown > 0) return; // Add extra protection on server side

		const player = lobby.players.find(p => p.id === socket.id);
		if (!player) return;

		const cardIndex = player.cards.findIndex(c => c.suit === card.suit && c.rank === card.rank);
		if (cardIndex === -1) return;
		const [placedCard] = player.cards.splice(cardIndex, 1);

		// Check if this card is the next expected card
		const currentCardIndex = lobby.allDistributedCards.findIndex(
			c => c.suit === placedCard.suit && c.rank === placedCard.rank
		);

		if (currentCardIndex === lobby.expectedCardIndex) {
			// Card is correct
			lobby.lastPlacedCard = placedCard;
			lobby.expectedCardIndex = currentCardIndex + 1;
			io.to('lobby').emit('cardPlaced', { player: player.name, card: placedCard, lobby });

			// Check if round is complete
			if (lobby.players.every(p => p.cards.length === 0)) {
				lobby.gameOver = true;
				io.to('lobby').emit('roundComplete', {
					message: 'Round completed successfully!',
					lobby
				});
			}
		} else {
			// Card is incorrect - but still update the last placed card and game state
			const expectedCard = lobby.allDistributedCards[lobby.expectedCardIndex];
			lobby.lastPlacedCard = placedCard;
			lobby.gameOver = true;
			lobby.error = true;
			lobby.errorMessage = `${player.name} played the ${placedCard.rank} of ${placedCard.suit}, but the next card should have been the ${expectedCard.rank} of ${expectedCard.suit}!`;
			io.to('lobby').emit('cardPlaced', { player: player.name, card: placedCard, lobby });
			io.to('lobby').emit('gameError', { message: lobby.errorMessage, lobby });
		}
	});

	socket.on('retryRound', () => {
		if (!lobby.gameOver) return;

		// Reset game state but keep current round number
		lobby.gameStarted = true;
		lobby.countdown = 3;
		lobby.lastPlacedCard = null;
		lobby.gameOver = false;
		lobby.error = false;
		lobby.errorMessage = '';
		lobby.allDistributedCards = [];
		lobby.expectedCardIndex = 0;

		// Deal cards
		const deck = shuffleDeck(createDeck());
		const cardsPerPlayer = getCardsPerPlayer(lobby.currentRound, lobby.players.length);
		const distributedCards = distributeCards(deck, lobby.players.length, cardsPerPlayer);
		
		// Store all the distributed cards in the expected order
		lobby.allDistributedCards = distributedCards.flat().sort((a, b) => {
			const suitDiff = suits.indexOf(a.suit) - suits.indexOf(b.suit);
			if (suitDiff !== 0) return suitDiff;
			return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
		});
		
		lobby.players.forEach((player, index) => {
			player.cards = distributedCards[index];
		});

		io.to('lobby').emit('gameStarting', lobby);

		const countdownInterval = setInterval(() => {
			lobby.countdown--;
			io.to('lobby').emit('countdownUpdate', lobby.countdown);

			if (lobby.countdown <= 0) {
				clearInterval(countdownInterval);
				io.to('lobby').emit('gameStart', lobby);
			}
		}, 1000);
	});

	socket.on('continueGame', () => {
		if (!lobby.gameOver || lobby.error) return;

		const nextRound = lobby.currentRound + 1;
		const cardsPerPlayer = getCardsPerPlayer(nextRound, lobby.players.length);
		const totalCardsNeeded = cardsPerPlayer * lobby.players.length;

		// If we need more cards than the deck size, we're done
		if (totalCardsNeeded > 52) {
			lobby.gameOver = true;
			lobby.error = false;
			lobby.errorMessage = 'Congratulations! You\'ve successfully played through the entire deck!';
			io.to('lobby').emit('roundComplete', { 
				message: lobby.errorMessage,
				lobby 
			});
			return;
		}

		// Increment round and reset game state
		lobby.currentRound = nextRound;
		lobby.gameStarted = true;
		lobby.countdown = 3;
		lobby.lastPlacedCard = null;
		lobby.gameOver = false;
		lobby.error = false;
		lobby.errorMessage = '';
		lobby.allDistributedCards = [];
		lobby.expectedCardIndex = 0;

		const deck = shuffleDeck(createDeck());
		const distributedCards = distributeCards(deck, lobby.players.length, cardsPerPlayer);
		
		lobby.allDistributedCards = distributedCards.flat().sort((a, b) => {
			const suitDiff = suits.indexOf(a.suit) - suits.indexOf(b.suit);
			if (suitDiff !== 0) return suitDiff;
			return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
		});
		
		lobby.players.forEach((player, index) => {
			player.cards = distributedCards[index];
		});

		io.to('lobby').emit('gameStarting', lobby);

		const countdownInterval = setInterval(() => {
			lobby.countdown--;
			io.to('lobby').emit('countdownUpdate', lobby.countdown);

			if (lobby.countdown <= 0) {
				clearInterval(countdownInterval);
				io.to('lobby').emit('gameStart', lobby);
			}
		}, 1000);
	});

	socket.on('disconnect', () => {
		console.log('\nUser disconnected:', socket.id);
		
		// Remove player from lobby
		lobby.players = lobby.players.filter(p => p.id !== socket.id);
		console.log('Player removed from lobby');
		
		io.to('lobby').emit('lobbyUpdate', lobby);
	});
});

server.listen(PORT, () => {
	console.log(`Socket.IO server running on port ${PORT}`);
	console.log('Environment:', process.env.NODE_ENV);
	console.log('Waiting for connections...');
});