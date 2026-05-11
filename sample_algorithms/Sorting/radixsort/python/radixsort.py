from runtime.tracer import Tracer

# [ALGORITHM]
def sort_by_digit(arr, exp, tracer):
    """Sort arr by the digit at position exp (1, 10, 100, ...)"""
    n = len(arr)
    buckets = [[] for _ in range(10)]  # one bucket per digit 0-9

    tracer.add_state(arr.copy(), 
                indexVars=[],
                buckets=[b.copy() for b in buckets])
    # Distribute: pop elements from end of array into buckets
    while len(arr) > 0:
        val = arr.pop()
        digit = (val // exp) % 10
        buckets[digit].append(val)
        display = list(arr) + [None] * (n - len(arr))
        tracer.add_state(display, comparing=[len(arr)],
                         buckets=[b.copy() for b in buckets],
                         indexVars=[],
                         variables={'pass': f'{exp}', 'val': val, 'digit': digit})

    # Collect: pop elements from end of each bucket back into array
    for digit in range(10):
        while len(buckets[digit]) > 0:
            val = buckets[digit].pop()
            arr.append(val)
            # Pad with None for remaining slots
            display = list(arr) + [None] * (n - len(arr))
            tracer.add_state(display, selected=[len(arr) - 1],
                             buckets=[b.copy() for b in buckets],
                             indexVars=[],
                             variables={'pass': f'{exp}', 'placing': val, 'from_bucket': digit})



def radix_sort(arr, tracer):
    if not arr:
        return arr, tracer

    max_val = max(arr)

    exp = 1
    while max_val // exp > 0:
        sort_by_digit(arr, exp, tracer)
        exp *= 10

    tracer.add_state(arr.copy(), indexVars=[], variables={'status': 'sorted'})
    return arr, tracer


# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    # [/PARAMS]
    sorted_arr, tracer = radix_sort(original_arr.copy(), Tracer(category='sorting'))
    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    tracer.finalize()
