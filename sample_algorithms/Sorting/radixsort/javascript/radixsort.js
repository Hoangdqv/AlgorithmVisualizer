import Tracer from './tracers/tracer.js';

// [ALGORITHM]
function sortByDigit(arr, exp, tracer) {
    const n = arr.length;
    const buckets = Array.from({ length: 10 }, () => []);  // one bucket per digit 0-9

    tracer.addState([...arr], {
        indexVars: [],
        buckets: buckets.map(b => [...b])
    });
    // Distribute: pop elements from end of array into buckets
    while (arr.length > 0) {
        const val = arr.pop();
        const digit = Math.floor(val / exp) % 10;
        buckets[digit].push(val);
        // Pad with null to keep visual array at original size
        const display = [...arr, ...new Array(n - arr.length).fill(null)];
        tracer.addState(display, {
            comparing: [arr.length],
            buckets: buckets.map(b => [...b]),
            indexVars: [],
            variables: { pass: `${exp}`, val, digit }
        });
    }

    // Collect: pop elements from end of each bucket back into array
    for (let digit = 0; digit < 10; digit++) {
        while (buckets[digit].length > 0) {
            const val = buckets[digit].pop();
            arr.push(val);
            // Pad with null for remaining slots
            const display = [...arr, ...new Array(n - arr.length).fill(null)];
            tracer.addState(display, {
                selected: [arr.length - 1],
                buckets: buckets.map(b => [...b]),
                indexVars: [],
                variables: { pass: `${exp}`, placing: val, from_bucket: digit }
            });
        }
    }
}

function radixSort(arr, tracer) {
    if (arr.length === 0) return [arr, tracer];

    const maxVal = Math.max(...arr);
    tracer.addState([...arr], { indexVars: [], variables: { max: maxVal, status: 'start' } });

    let exp = 1;
    while (Math.floor(maxVal / exp) > 0) {
        sortByDigit(arr, exp, tracer);
        exp *= 10;
    }

    tracer.addState([...arr], { indexVars: [], variables: { status: 'sorted' } });
    return [arr, tracer];
}

// [TEST]
// [PARAMS]
const originalArr = [92, 14, 461, 1122, 235, 9, 127];
// [/PARAMS]
const tracer = new Tracer('sorting');
const [sortedArr] = radixSort([...originalArr], tracer);
console.log('Original array:', originalArr);
console.log('Sorted array:', sortedArr);
tracer.finalize();
