import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import { createDeck, shuffleDeck, distributeCards, Card, ranks, suits } from './gameLogic';

const app = express();
app.use(cors());

const httpServer = createServer(app);
const io = new Server(httpServer, {
	cors: {
		origin: "*",
		methods: ['GET', 'POST']
	}
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

io.on('connection', (socket) => {
	console.log('\nUser connected:', socket.id);

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
		console.log('Current players:', lobby.players);
		
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

		// Deal initial cards (2 per player)
		const deck = shuffleDeck(createDeck());
		const cardsPerPlayer = 2 + lobby.currentRound - 1;
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

		const player = lobby.players.find(p => p.id === socket.id);
		if (!player) return;

		// Check if the card is in the player's hand
		const cardIndex = player.cards.findIndex(c => 
			c.suit === card.suit && c.rank === card.rank
		);
		if (cardIndex === -1) return;

		const expectedCard = lobby.allDistributedCards[lobby.expectedCardIndex];
		if (card.suit !== expectedCard.suit || card.rank !== expectedCard.rank) {
			// Put the card back in the player's hand
			player.cards.push(card);

			// Find which player has the expected card
			const playerWithExpectedCard = lobby.players.find(p => 
				p.cards.some(c => c.suit === expectedCard.suit && c.rank === expectedCard.rank)
			);

			lobby.error = true;
			lobby.gameOver = true;
			lobby.errorMessage = `Card placed out of order! ${playerWithExpectedCard?.name || 'Someone'} had the ${expectedCard.rank} of ${expectedCard.suit} that should have been played.`;
			io.to('lobby').emit('gameError', { message: lobby.errorMessage, lobby });
			return;
		}

		// Card is correct, remove it from player's hand
		player.cards.splice(cardIndex, 1);
		lobby.lastPlacedCard = card;
		lobby.expectedCardIndex++;

		io.to('lobby').emit('cardPlaced', { player: player.name, card, lobby });

		// Check if round is complete
		if (lobby.players.every(p => p.cards.length === 0)) {
			lobby.gameOver = true;
			io.to('lobby').emit('roundComplete', { 
				message: 'Round complete! All cards placed correctly!',
				lobby 
			});
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
		const cardsPerPlayer = 2 + lobby.currentRound - 1;
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
		const cardsPerPlayer = 2 + nextRound - 1;
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
		console.log('Current players:', lobby.players);
		
		io.to('lobby').emit('lobbyUpdate', lobby);
	});
});

const PORT = process.env.PORT || 3001;
httpServer.listen(PORT, () => {
	console.log(`\nServer running on port ${PORT}`);
	console.log('Waiting for connections...');
}); 