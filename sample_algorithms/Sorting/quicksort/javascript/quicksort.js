import Tracer from './tracers/tracer.js';
import { swap } from './helpers.js';  // Helper function: swaps arr[i] and arr[j]

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
    { pivot: high, range: [low, high], indexVars: ['low', 'high', 'pivotIdx'], variables: { pivotIdx: high, low, high } }
  );
  
  for (let j = low; j < high; j++) {
    // Show current element being examined
    tracer.addState([...arr], { 
      selected: [j], 
      pivot: high, 
      range: [low, high],
      indexVars: ['i', 'j', 'low', 'high'],
      variables: { i, j, low, high } 
      });
    
    if (arr[j] < pivot) {
      i++;
      if (i !== j) {
        // Show comparison before swap
        tracer.addState([...arr], { 
          comparing: [i, j],
          pivot: high, 
          range: [low, high],
          indexVars: ['i', 'j', 'low', 'high'],
          variables: { i, j, low, high } 
        });
        // Swap elements
        swap(arr, i, j);
        // Show swap result
        tracer.addState([...arr], { 
          swapped: [i, j],
          pivot: high, 
          range: [low, high],
          indexVars: ['i', 'j', 'low', 'high'],
          variables: { i, j, low, high } 
        });
      }
    }
  }
  
  // Place pivot in its final position
  if (i + 1 !== high) {
    tracer.addState([...arr], { 
      comparing: [i + 1, high], 
      pivot: high, 
      range: [low, high], 
      indexVars: ['i', 'low', 'high', 'pivotIdx'], 
      variables: { i, pivotIdx: i + 1, low, high } 
    });
    swap(arr, i + 1, high);
    tracer.addState([...arr], { 
      swapped: [i + 1, high], 
      pivot: i + 1, 
      range: [low, high], 
      indexVars: ['i', 'low', 'high', 'pivotIdx'], 
      variables: { i, pivotIdx: i + 1, low, high } 
    });
  } else {
    tracer.addState([...arr], { 
      pivot: i + 1, 
      range: [low, high], 
      indexVars: ['i', 'low', 'high', 'pivotIdx'], 
      variables: { i, pivotIdx: i + 1, low, high } 
    });
  }
  
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
