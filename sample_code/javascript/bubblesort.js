//Simple bubble sort in Javascript
function bubbleSort(arr) {
    let n = arr.length;
    for (let i = 0; i < n; i++) {
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                // Swap if the element found is greater than the next element
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
            }
        }
    }
    return arr;
}

let numbers = [64, 34, 25, 12, 22, 11, 90];
console.log("Before sorting:", numbers)
console.log("After sorting:", numbers)
