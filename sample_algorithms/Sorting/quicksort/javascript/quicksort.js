import Tracer from '../../tracers/tracer.js';
import { swap } from './helpers.js';  // Helper function: swaps arr[i] and arr[j] in-place

// [ALGORITHM]
function quickSort(arr, tracer, low = 0, high = arr.length - 1) {
  if (low < high) {
    // Partition and get the pivot index
    const pivotIndex = partition(arr, tracer, low, high);
    
    // Recursively sort left partition
    quickSort(arr, tracer, low, pivotIndex - 1);
    
    // Recursively sort right partition
    quickSort(arr, tracer, pivotIndex + 1, high);
  }
  
  if (low === 0 && high === arr.length - 1) {
    tracer.addState([...arr]); // Complete state
  }
  
  return [arr, tracer];
}

function partition(arr, tracer, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  
  tracer.addState(
    [...arr], 
    { pivot: high, range: [low, high], variables: { pivotIdx: high, low, high } }
  );
  
  for (let j = low; j < high; j++) {
    // Show comparison
    tracer.addState([...arr], { 
      comparing: [j, high], 
      pivot: high, 
      range: [low, high], 
      variables: { i, j, low, high } 
      });
    
    if (arr[j] < pivot) {
      i++;
      // Swap elements
      swap(arr, i, j);
      // Show swap result
      tracer.addState([...arr], { 
        swapped: [i, j],
        pivot: high, 
        range: [low, high], 
        variables: { i, j, low, high } 
      });
    }
  }
  
  // Place pivot in its final position
  swap(arr, i + 1, high);
  tracer.addState([...arr], { swapped: [i + 1, high], pivot: i + 1, range: [low, high], variables: { i, pivotIdx: high, low, high } });
  
  return i + 1;
}

// [TEST]
// [PARAMS]
const originalArr = [92, 14, 461, 1122, 235, 9, 127];
// [/PARAMS]
const tracer = new Tracer('sorting'); // Tracer instance
const [sortedArr] = quickSort([...originalArr], tracer);

console.log('Original array:', originalArr);
console.log('Sorted array:', sortedArr);

tracer.finalize();
