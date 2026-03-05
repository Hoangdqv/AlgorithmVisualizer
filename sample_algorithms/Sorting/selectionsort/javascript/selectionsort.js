import Tracer from './tracers/tracer.js';
import { swap } from './helpers.js';  // Helper function: swaps arr[i] and arr[j] in-place

// [ALGORITHM]
function selectionSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 0; i < n - 1; i++) {
        // Show the position where we'll place the minimum (blue highlight)
        tracer.addState([...arr], { selected: [i], indexVars: ['i'], variables: { i } });
        
        let minIndex = i;
        
        // Find the minimum element in the unsorted portion
        for (let j = i + 1; j < n; j++) {
            tracer.addState([...arr], { comparing: [minIndex, j], selected: [i], indexVars: ['i', 'j', 'minIndex'], variables: { i, j, minIndex } });  // Keep selected position visible
            if (arr[j] < arr[minIndex]) {
                minIndex = j;
            }
        }
        
        // If minIndex changed, update the selected position
        tracer.addState([...arr], { selected: [i, minIndex], indexVars: ['i', 'minIndex'], variables: { i, minIndex } });
        // Swap the minimum element with the first element of unsorted portion
        if (minIndex !== i) {
            swap(arr, i, minIndex);
            tracer.addState([...arr], { swapped: [i, minIndex], selected: [i], indexVars: ['i', 'minIndex'], variables: { i, minIndex } });
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
const [sortedArr] = selectionSort([...originalArr], tracer);

console.log('Original array:', originalArr);
console.log('Sorted array:', sortedArr);

// Output tracer data for visualization
tracer.finalize();
