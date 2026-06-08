// Simple Insertion Sort in JavaScript
import Tracer from './runtime/tracer.js';

function insertionSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 1; i < n; i++) {
        const key = arr[i];
        let j = i - 1;
        
        tracer.add_state([...arr], {   
            comparing: [j, j+1],
            indexVars: ['i', 'j', 'key'],
            variables: { i: i, j: j, key: key } 
        });
        arr[i] = null;
        
        // Shift elements greater than key one position to the right
        while (j >= 0 && arr[j] > key) {
            // Comparing (yellow)
            tracer.add_state([...arr], {
                comparing: [j, j + 1],
                indexVars: ['i', 'j', 'key'],
                variables: { i: i, j: j, key: key } 
            });
            arr[j + 1] = arr[j];
            arr[j] = null;
            
            // Shifted (green)
            tracer.add_state([...arr], { 
                swapped: [j, j + 1],
                indexVars: ['i', 'j', 'key'],
                variables: { i: i, j: j, key: key } 
            });
            j--;
        }
        
        arr[j + 1] = key;
    }
    
    tracer.add_state([...arr]);
    return [arr, tracer];
}

// [PARAMS]
const originalArr = [92, 14, 461, 1122, 235, 9, 127];
// [/PARAMS]
const tracer = new Tracer('sorting');

const [sortedArr] = insertionSort([...originalArr], tracer);

console.log(`Original array: [${originalArr.join(", ")}]`);
console.log(`Sorted array: [${sortedArr.join(", ")}]`);

// Output tracer data for visualization
tracer.finalize();
