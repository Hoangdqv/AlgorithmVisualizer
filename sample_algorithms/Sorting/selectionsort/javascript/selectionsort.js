const Tracer = require('../../tracers/tracer');

// [ALGORITHM]
function selectionSort(arr, tracer) {
    const n = arr.length;
    
    for (let i = 0; i < n - 1; i++) {
        // Show the position where we'll place the minimum (blue highlight)
        tracer.addState([...arr], { selected: [i], variables: { i } });
        
        let minIndex = i;
        
        // Find the minimum element in the unsorted portion
        for (let j = i + 1; j < n; j++) {
            tracer.addState([...arr], { comparing: [minIndex, j], selected: [i], variables: { i, j, minIndex } });  // Keep selected position visible
            if (arr[j] < arr[minIndex]) {
                minIndex = j;
            }
        }
        
        // Swap the minimum element with the first element of unsorted portion
        if (minIndex !== i) {
            [arr[i], arr[minIndex]] = [arr[minIndex], arr[i]];
            tracer.addState([...arr], { swapped: [i, minIndex], selected: [i], variables: { i, minIndex } });  // Keep selected position visible
        }
    }
    tracer.addState([...arr]); // Complete state
    return [arr, tracer];
}

// [TEST]
if (require.main === module) {
    const originalArr = [64, 34, 25, 12, 22, 11, 90];
    const tracer = new Tracer('sorting'); // Tracer instance
    const [sortedArr] = selectionSort([...originalArr], tracer);
    
    console.log('Original array:', originalArr);
    console.log('Sorted array:', sortedArr);
    
    // Output tracer data for visualization
    tracer.finalize();
}
