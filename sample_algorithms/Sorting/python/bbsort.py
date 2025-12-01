import tracers.tracer as trc

# [ALGORITHM]
def bubble_sort(arr, tracer):
    n = len(arr)
    for i in range(n):
        tracer.add_state(arr.copy())  # Track state
        swapped = False
        for j in range(0, n - i - 1):
            # Show comparison (yellow)
            tracer.add_state(arr.copy(), comparing=[j, j + 1])
            if arr[j] > arr[j + 1]:
                arr[j], arr[j + 1] = arr[j + 1], arr[j]
                # Show swap result (green)
                tracer.add_state(arr.copy(), swapped=[j, j + 1])
                swapped = True
        if not swapped:
            break
    return arr, tracer

# [TEST]
if __name__ == "__main__":
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    sorted_arr, tracer = bubble_sort(original_arr.copy(), trc.Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    # Output tracer data for visualization
    tracer.finalize()