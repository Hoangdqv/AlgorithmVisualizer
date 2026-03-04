# Number Guessing Game
# This interactive game will familiarize you with the concept of
# random numbers and user input loops.
#
# A random number is generated each game and for each guess,
# you will be provided with a hint — whether the answer is
# higher or lower than your guess.
#
# The game ends when you get it right. Good luck!

import random

# Generate random number between 1 and 100
secret_number = random.randint(1, 100)

attempts = 0
guess = None

print("Welcome to the Number Guessing Game!")
print("I'm thinking of a number between 1 and 100.")

while guess != secret_number:
    try:
        guess = int(input("Enter your guess: "))
    except ValueError:
        print("Please enter a valid number.")
        continue

    attempts += 1

    if guess > secret_number:
        print("Too high! Try again.")
    elif guess < secret_number:
        print("Too low! Try again.")
    else:
        print(f"Correct! You guessed it in {attempts} attempts.")
