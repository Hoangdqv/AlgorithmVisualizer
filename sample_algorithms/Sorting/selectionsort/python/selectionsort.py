# Simple Selection Sort in Python
import tracers.tracer as trc

# [ALGORITHM]
def selection_sort(arr, tracer):
    n = len(arr)
    
    for i in range(n - 1):
        # Show the position where we'll place the minimum (blue highlight)
        tracer.add_state(arr.copy(), selected=[i], variables={'i': i})
        
        # Find the minimum element in the unsorted portion
        min_index = i
        for j in range(i + 1, n):
            # Show comparison (yellow) - keep selected position highlighted
            tracer.add_state(arr.copy(), comparing=[min_index, j], selected=[i], variables={'i': i, 'j': j, 'min_index': min_index})
            if arr[j] < arr[min_index]:
                min_index = j
        
        # Swap the minimum element with the first element of unsorted portion
        if min_index != i:
            arr[i], arr[min_index] = arr[min_index], arr[i]
            # Show swap result (green) - keep selected position highlighted
            tracer.add_state(arr.copy(), swapped=[i, min_index], selected=[i], variables={'i': i, 'min_index': min_index})
    
    tracer.add_state(arr.copy()) # Complete state
    return arr, tracer

# [TEST]
if __name__ == "__main__":
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    sorted_arr, tracer = selection_sort(original_arr.copy(), trc.Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    # Output tracer data for visualization
    tracer.finalize()
