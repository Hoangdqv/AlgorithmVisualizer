// Simple Insertion Sort in JavaScript
import Tracer from './tracers/tracer.js';

// [ALGORITHM]
function insertionSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 1; i < n; i++) {
        const key = arr[i];
        let j = i - 1;
        
        tracer.addState([...arr], {   
            selected: [i],
            indexVars: ['i'],
            variables: { i: i } 
        });
        arr[i] = null;
        
        // Shift elements greater than key one position to the right
        while (j >= 0 && arr[j] > key) {
            // Comparing (yellow)
            tracer.addState([...arr], {
                comparing: [j, j + 1],
                indexVars: ['i', 'j'],
                variables: { i: i, j: j } 
            });
            arr[j + 1] = arr[j];
            arr[j] = null;
            
            // Shifted (green)
            tracer.addState([...arr], { 
                swapped: [j, j + 1],
                indexVars: ['i', 'j'],
                variables: { i: i, j: j } 
            });
            j--;
        }
        
        arr[j + 1] = key;
    }
    
    tracer.addState([...arr]);
    return { arr, tracer };
}

// [TEST]
// [PARAMS]
const originalArr = [92, 14, 461, 1122, 235, 9, 127];
// [/PARAMS]
const tracer = new Tracer('sorting');

const { arr: sortedArr, tracer: finalTracer } = insertionSort([...originalArr], tracer);

console.log(`Original array: [${originalArr}]`);
console.log(`Sorted array: [${sortedArr}]`);

// Output tracer data for visualization
finalTracer.finalize();
