// Number Guessing Game
// This interactive game will familiarize you with the concept of
// random numbers and user input loops.
//
// A random number is generated each game and for each guess,
// you will be provided with a hint — whether the answer is
// higher or lower than your guess.
//
// The game ends when you get it right. Good luck!

// Generate random number between 1 and 100
const readline = require('readline');
// output: null suppresses readline's ANSI terminal control sequences (cursor
// positioning, echo) that appear as artefacts when running inside a PTY container.
const rl = readline.createInterface({ input: process.stdin, output: null });

const secretNumber = Math.floor(Math.random() * 100) + 1;
let attempts = 0;

console.log("Welcome to the Number Guessing Game!");
console.log("I'm thinking of a number between 1 and 100.");

// readline is async/callback-based — use recursion instead of a while loop.
// Each call to askGuess() waits for one line of input, then calls itself again.
function askGuess() {
  process.stdout.write("Enter your guess: ");
  rl.once("line", (answer) => {
    const guess = Number(answer);
    attempts++;

    if (isNaN(guess) || answer.trim() === '') {
      console.log("Please enter a valid number.");
      askGuess();
    } else if (guess > secretNumber) {
      console.log("Too high! Try again.");
      askGuess();
    } else if (guess < secretNumber) {
      console.log("Too low! Try again.");
      askGuess();
    } else {
      console.log(`Correct! You guessed it in ${attempts} attempt${attempts === 1 ? '' : 's'}.`);
      rl.close();
    }
  });
}

askGuess();
