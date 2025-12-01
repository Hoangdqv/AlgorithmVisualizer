// Simple Fibonacci program using recursion
function fibonacci(n) {
    if (n <= 1) {
        return n;
    }
    return fibonacci(n - 1) + fibonacci(n - 2);
}
term = 6;
console.log(`Fibonacci number for term ${term} `, fibonacci(term)); // Number of terms, change as needed here
//Or we can print up until a specified number
function printFibonacci(n) {
    let a = 0, b = 1;
    for (let i = 0; i < n; i++) {
        console.log(a);
        let next = a + b;
        a = b;
        b = next;
    }
}
printFibonacci(term); // Change 'term' to any number to get the first 'n' Fibonacci numbers