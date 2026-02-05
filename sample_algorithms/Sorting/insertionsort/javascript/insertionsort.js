// Simple Insertion Sort in JavaScript
const { Tracer } = require('./tracers/tracer');

// [ALGORITHM]
function insertionSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 1; i < n; i++) {
        const key = arr[i];
        let j = i - 1;
        
        tracer.addState(arr.slice(), { selected: [i], variables: { i: i } });
        arr[i] = null;
        
        // Shift elements greater than key one position to the right
        while (j >= 0 && arr[j] > key) {
            // Comparing (yellow)
            tracer.addState(arr.slice(), { comparing: [j, j + 1], variables: { i: i, j: j } });
            arr[j + 1] = arr[j];
            arr[j] = null;
            
            // Shifted (green)
            tracer.addState(arr.slice(), { swapped: [j, j + 1], variables: { i: i, j: j } });
            j--;
        }
        
        arr[j + 1] = key;
    }
    
    tracer.addState(arr.slice());
    return { arr, tracer };
}

// [TEST]
if (require.main === module) {
    const originalArr = [92, 14, 461, 1122, 235, 9, 127];
    const tracer = new Tracer('sorting');
    
    const { arr: sortedArr, tracer: finalTracer } = insertionSort([...originalArr], tracer);
    
    console.log(`Original array: [${originalArr}]`);
    console.log(`Sorted array: [${sortedArr}]`);
    
    // Output tracer data for visualization
    finalTracer.finalize();
}
