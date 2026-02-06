const Tracer = require('../../tracers/tracer');

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
  
  // Track state after partitioning
  if (low === 0 && high === arr.length - 1) {
    tracer.addState([...arr]); // Complete state
  }
  
  return [arr, tracer];
}

function partition(arr, tracer, low, high) {
  const pivot = arr[high];
  let i = low - 1;
  
  // Show pivot selection (purple)
  tracer.addState([...arr], { selected: [high], variables: { pivotIdx: high, low, high } });
  
  for (let j = low; j < high; j++) {
    // Show comparison (yellow)
    tracer.addState([...arr], { comparing: [j, high], variables: { i, j, low, high } });
    
    if (arr[j] < pivot) {
      i++;
      // Swap elements
      [arr[i], arr[j]] = [arr[j], arr[i]];
      // Show swap result (green)
      tracer.addState([...arr], { swapped: [i, j], variables: { i, j, low, high } });
    }
  }
  
  // Place pivot in its final position
  [arr[i + 1], arr[high]] = [arr[high], arr[i + 1]];
  tracer.addState([...arr], { swapped: [i + 1, high], variables: { i, pivotIdx: high, low, high } });
  
  return i + 1;
}

// [TEST]
if (require.main === module) {
    const originalArr = [92, 14, 461, 1122, 235, 9, 127];
    const tracer = new Tracer('sorting'); // Tracer instance
    const [sortedArr] = quickSort([...originalArr], tracer);
    
    console.log('Original array:', originalArr);
    console.log('Sorted array:', sortedArr);
    
    // Output tracer data for visualization
    tracer.finalize();
}
