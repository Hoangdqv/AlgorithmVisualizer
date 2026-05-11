import Tracer from './runtime/tracer.js';
import { swap } from './helpers.js';

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
    tracer.add_state([...arr]); // Complete state
  }
  
  return [arr, tracer];
}

function partition(arr, tracer, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  
  tracer.add_state(
    [...arr], 
    { pivot: high, range: [low, high], indexVars: ['low', 'high', 'pivotIdx'], variables: { pivotIdx: high, low, high } }
  );
  
  for (let j = low; j < high; j++) {
    // Show current element being examined
    tracer.add_state([...arr], { 
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
        tracer.add_state([...arr], { 
          comparing: [i, j],
          pivot: high, 
          range: [low, high],
          indexVars: ['i', 'j', 'low', 'high'],
          variables: { i, j, low, high } 
        });
        // Swap elements
        swap(arr, i, j);
        // Show swap result
        tracer.add_state([...arr], { 
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
    tracer.add_state([...arr], { 
      comparing: [i + 1, high], 
      pivot: high, 
      range: [low, high], 
      indexVars: ['i', 'low', 'high', 'pivotIdx'], 
      variables: { i, pivotIdx: i + 1, low, high } 
    });
    swap(arr, i + 1, high);
    tracer.add_state([...arr], { 
      swapped: [i + 1, high], 
      pivot: i + 1, 
      range: [low, high], 
      indexVars: ['i', 'low', 'high', 'pivotIdx'], 
      variables: { i, pivotIdx: i + 1, low, high } 
    });
  } else {
    tracer.add_state([...arr], { 
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
