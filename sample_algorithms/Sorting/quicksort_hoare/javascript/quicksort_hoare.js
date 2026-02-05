const Tracer = require('../../tracers/tracer');

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
    tracer.addState([...arr]); // Complete state
  }
  
  return [arr, tracer];
}

function partitionHoare(arr, tracer, low, high) {
  const pivot = arr[low];
  
  // Show pivot selection (purple)
  tracer.addState([...arr], { selected: [low], variables: { pivotIdx: low, low, high } });
  
  let i = low - 1;
  let j = high + 1;
  
  while (true) {
    // Move left pointer right
    do {
      i++;
      // Show left scan (yellow)
      if (i <= j) {
        tracer.addState([...arr], { comparing: [i, low], variables: { i, j, low, high } });
      }
    } while (arr[i] < pivot);
    
    // Move right pointer left
    do {
      j--;
      // Show right scan (yellow)
      if (i <= j) {
        tracer.addState([...arr], { comparing: [j, low], variables: { i, j, low, high } });
      }
    } while (arr[j] > pivot);
    
    // If pointers haven't crossed, swap
    if (i < j) {
      [arr[i], arr[j]] = [arr[j], arr[i]];
      // Show swap result (green)
      tracer.addState([...arr], { swapped: [i, j], variables: { i, j, low, high } });
    } else {
      break;
    }
  }
  
  return j;
}

// [TEST]
if (require.main === module) {
    const originalArr = [92, 14, 461, 1122, 235, 9, 127, 48, 75, 42];
    const tracer = new Tracer('sorting'); // Tracer instance
    const [sortedArr] = quickSortHoare([...originalArr], tracer);
    
    console.log('Original array:', originalArr);
    console.log('Sorted array:', sortedArr);
    
    // Output tracer data for visualization
    tracer.finalize();
}
