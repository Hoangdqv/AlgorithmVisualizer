import Tracer from './runtime/tracer.js';
import { swap } from './helpers.js';

// [ALGORITHM]
function quickSortHoare(arr, tracer, low = 0, high = arr.length - 1) {
  if (low < high) {
    // Partition and get the pivot index
    const pivotIndex = partitionHoare(arr, tracer, low, high);
    
    // Recursively sort left partition
    quickSortHoare(arr, tracer, low, pivotIndex);
    
    // Recursively sort right partition
    quickSortHoare(arr, tracer, pivotIndex + 1, high);
  }
  
  // Track state after partitioning
  if (low === 0 && high === arr.length - 1) {
    tracer.add_state([...arr]); // Complete state
  }
  
  return [arr, tracer];
}

function partitionHoare(arr, tracer, low, high) {
  const pivot = arr[low];
  
  // Show pivot selection
  tracer.add_state([...arr], { 
    pivot: low, 
    range: [low, high],
    indexVars: ['low', 'high', 'pivotIdx'],
    variables: { pivotIdx: low, low, high } 
  });
  
  let i = low - 1;
  let j = high + 1;
  
  while (true) {
    // Move left pointer right
    do {
      i++;
      // Show left scan
      if (i <= j) {
        tracer.add_state([...arr], { 
          comparing: [i, low], 
          pivot: low, 
          range: [low, high],
          indexVars: ['i', 'j', 'low', 'high'],
          variables: { i, j, low, high } 
        });
      }
    } while (arr[i] < pivot);
    
    // Move right pointer left
    do {
      j--;
      // Show right scan
      if (i <= j) {
        tracer.add_state([...arr], { 
          comparing: [j, low], 
          pivot: low, 
          range: [low, high],
          indexVars: ['i', 'j', 'low', 'high'],
          variables: { i, j, low, high } 
        });
      }
    } while (arr[j] > pivot);
    
    // If pointers haven't crossed, swap
    if (i < j) {
      // Show which elements will be swapped
      tracer.add_state([...arr], { 
        comparing: [i, j], 
        pivot: low, 
        range: [low, high],
        indexVars: ['i', 'j', 'low', 'high'],
        variables: { i, j, low, high } 
      });
      swap(arr, i, j);
      // Show swap result
      tracer.add_state([...arr], { 
        swapped: [i, j], 
        pivot: low, 
        range: [low, high],
        indexVars: ['i', 'j', 'low', 'high'],
        variables: { i, j, low, high } 
      });
    } else {
      break;
    }
  }
  
  return j;
}

// [TEST]
// [PARAMS]
const originalArr = [92, 14, 461, 1122, 235, 9, 127];
// [/PARAMS]
const tracer = new Tracer('sorting'); // Tracer instance
const [sortedArr] = quickSortHoare([...originalArr], tracer);

console.log('Original array:', originalArr);
console.log('Sorted array:', sortedArr);

// Output tracer data for visualization
tracer.finalize();
