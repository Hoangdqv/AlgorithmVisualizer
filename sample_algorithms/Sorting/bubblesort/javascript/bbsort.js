import Tracer from './tracers/tracer.js';
import { swap } from './helpers.js';
// New edit from admin panel
// [ALGORITHM]
function bubbleSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 0; i < n; i++) {
        let swapped = false;  
        for (let j = 0; j < n - i - 1; j++) {
            tracer.addState([...arr], { 
                comparing: [j, j + 1],
                indexVars: ['i', 'j'],
                variables: { i, j } 
            });
            if (arr[j] > arr[j + 1]) {
                swap(arr, j, j + 1);
                tracer.addState([...arr], { 
                    swapped: [j, j + 1],
                    indexVars: ['i', 'j'],
                    variables: { i, j } 
                });
                swapped = true;
            }
        }
        
        if (!swapped) {
            break;
        }
    }
    tracer.addState([...arr]); // Complete state
    return [arr, tracer];
}

// [TEST]
// [PARAMS]
const originalArr = [64, 34, 25, 12, 22, 11, 90];
// [/PARAMS]
const tracer = new Tracer('sorting'); // Tracer instance
const [sortedArr] = bubbleSort([...originalArr], tracer);

console.log('Original array:', originalArr);
console.log('Sorted array:', sortedArr);

// Output tracer data for visualization
tracer.finalize();