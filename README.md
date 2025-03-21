# Game Theory

## Run Instructions

Once cloned locally, run `npm install` and then `npm run dev` to start the server and client.

## Game Instructions

In Game Theory, your goal is to work with your friends to stack your cards in order. At the beginning, each player is dealt 2 cards (or 1 card if there are 5 or more players). Each player is able to see only their own cards, and in this online version the cards are already shown in the expected sorted order. That is:
- The suits appear in the order Hearts, Diamonds, Spades, Clubs
- Within each suit, the cards appear from Ace to King
- For example, the Ace of Hearts should be before the Jack of Hearts, which should be before the 9 of Diamonds
When the game starts, players can put a card at the top of the pile by clicking on it. Players are free to talk amongst themselves, but cannot say anything that would give away what card they have next. Once all players place their cards in the right order, the round is marked as a success, and the next round begins with each player now having an additional card (so going from 2 to 3 or 3 to 4).

If a player places in the wrong order (say Player A places a King, when B has a Jack of the same suit), the round is marked unsuccessful, and the round restarts with the same number of cards.

## Further Notes

I made this out of curiosity during spring break of my freshman year of college, as I wanted to experiment with using TS and JS. When deployed, it also makes it convenient to play the game with friends without having cards or actually being face-to-face.