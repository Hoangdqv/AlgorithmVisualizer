const Tracer = require('./tracers/tracer');

// [ALGORITHM]
function bubbleSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 0; i < n; i++) {
        tracer.addState([...arr]);  // Track state
        let swapped = false;
        
        for (let j = 0; j < n - i - 1; j++) {
            if (arr[j] > arr[j + 1]) {
                [arr[j], arr[j + 1]] = [arr[j + 1], arr[j]];
                tracer.addState([...arr]);  // Track state
                swapped = true;
            }
        }
        
        if (!swapped) {
            break;
        }
    }
    
    return [arr, tracer];
}

// [TEST]
if (require.main === module) {
    const originalArr = [64, 34, 25, 12, 22, 11, 90];
    const tracer = new Tracer('sorting'); // Tracer instance
    const [sortedArr] = bubbleSort([...originalArr], tracer);
    
    console.log('Original array:', originalArr);
    console.log('Sorted array:', sortedArr);
    
    // Output tracer data for visualization
    tracer.finalize();
}