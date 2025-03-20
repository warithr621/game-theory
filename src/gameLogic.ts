// Define card suits and ranks
export const suits = ['hearts', 'diamonds', 'spades', 'clubs'];
export const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];

// Card interface
export type Card = {
	suit: string;
	rank: string;
};

// Function to create a deck of cards
export function createDeck(): Card[] {
	const deck: Card[] = [];
	for (const suit of suits) {
		for (const rank of ranks) {
			deck.push({ suit, rank });
		}
	}
	return deck;
}

// Use Fisher-Yates algorithm to shuffle the deck
export function shuffleDeck(deck: Card[]): Card[] {
	const shuffledDeck = [...deck];
	for (let i = shuffledDeck.length - 1; i > 0; i--) {
		const j = Math.floor(Math.random() * (i + 1));
		[shuffledDeck[i], shuffledDeck[j]] = [shuffledDeck[j], shuffledDeck[i]];
	}
	return shuffledDeck;
}

// Function to distribute cards to players
export function distributeCards(deck: Card[], numPlayers: number, cardsPerPlayer: number): Card[][] {
	const players: Card[][] = Array.from({ length: numPlayers }, () => []);
	for (let i = 0; i < cardsPerPlayer; i++) {
		for (let j = 0; j < numPlayers; j++) {
			players[j].push(deck.pop()!);
		}
	}
	for (let j = 0; j < numPlayers; j++) {
		players[j] = sortCards(players[j]);
	}
	return players;
}

// Function to sort cards in a player's hand
export function sortCards(hand: Card[]): Card[] {
	return hand.sort((a, b) => {
		const suitOrder = suits.indexOf(a.suit) - suits.indexOf(b.suit);
		if (suitOrder !== 0) return suitOrder;
		return ranks.indexOf(a.rank) - ranks.indexOf(b.rank);
	});
} 