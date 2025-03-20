# Game Theory

## Credits

This project was bootstrapped with [Create React App](https://github.com/facebook/create-react-app).

## Run Instructions

In the project directory, you can run `npm start` to run in development mode. You can open `http://localhost:3000` to view it in the browser. The page will reload if you make edits. You will also see any lint errors in the console.

You can run `npm test` to launch the test runner in the interactive watch mode. See the section about [running tests](https://facebook.github.io/create-react-app/docs/running-tests) for more information. 

You can run `npm run build` to build the app for production to the `build` folder. The build is minified and the filenames include the hashes. Your app is ready to be deployed!

You can run `npm run eject` to remove the single build dependency from your project. Instead, it will copy all the configuration files and the transitive dependencies (webpack, Babel, ESLint, etc) right into your project so you have full control over them. All of the commands except `eject` will still work, but they will point to the copied scripts so you can tweak them. At this point you’re on your own. **Note: this is a one-way operation. Once you `eject`, you can’t go back!**

## Game Instructions

In Game Theory, your goal is to work with your friends to stack your cards in order. At the beginning, each player is dealt 2 cards (which can be changed to 3 or 4 if a small number are playing). Each player is able to see their cards, and in this online version the cards are already shown in the expected sorted order. That is:
- The suits appear in the order Hearts, Diamonds, Spades, Clubs
- Within each suit, the cards appear from Ace to King
- For example, the Ace of Hearts should be before the Jack of Hearts, which should be before the 9 of Diamonds
When the game starts, players will have the option to add their card on top of the pile. Players are free to talk amongst themselves, but cannot say anything that would give away what card they have next. Once all players place their cards in the right order, the round is marked as a success, and the next round begins with each player now having an additional card (so going from 2 to 3 or 3 to 4).

If a player places in the wrong order (say Player A places a King, when B has a Jack of the same suit), the round is marked unsuccessful, and the round restarts with the same number of cards.

## Further Notes

I made this out of curiosity during spring break of my freshman year of college, as I wanted to experiment with using TS and React. When deployed, it also makes it convenient to play the game with friends without having cards or actually being face-to-face.