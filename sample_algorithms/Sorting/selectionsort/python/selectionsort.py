# Simple Selection Sort in Python
from tracers.tracer import Tracer
from helpers import swap  # Helper function: swaps arr[i] and arr[j] in-place

# [ALGORITHM]
def selection_sort(arr, tracer):
    n = len(arr)
    
    for i in range(n - 1):
        # Show the position where we'll place the minimum
        tracer.add_state(arr.copy(), selected=[i], indexVars=['i'], variables={'i': i})
        
        # Find the minimum element in the unsorted portion
        min_index = i
        for j in range(i + 1, n):
            tracer.add_state(arr.copy(), comparing=[min_index, j], selected=[i], indexVars=['i', 'j', 'min_index'], variables={'i': i, 'j': j, 'min_index': min_index})
            if arr[j] < arr[min_index]:
                min_index = j
        
        # If minIndex changed, update the selected position
        tracer.add_state(arr.copy(), selected=[i, min_index], indexVars=['i', 'min_index'], variables={'i': i, 'min_index': min_index})
        # Swap the minimum element with the first element of unsorted portion
        if min_index != i:
            swap(arr, i, min_index)
            tracer.add_state(arr.copy(), swapped=[i, min_index], selected=[i, min_index], indexVars=['i', 'min_index'], variables={'i': i, 'min_index': min_index})
    
    tracer.add_state(arr.copy()) # Complete state
    return arr, tracer

# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    # [/PARAMS]
    sorted_arr, tracer = selection_sort(original_arr.copy(), Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    # Output tracer data for visualization
    tracer.finalize()
