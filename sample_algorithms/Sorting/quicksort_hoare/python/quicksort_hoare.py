# Quick Sort (Hoare Partition) in Python
from runtime.tracer import Tracer
from helpers import swap

# [ALGORITHM]
def quick_sort_hoare(arr, tracer, low=0, high=None):
    if high is None:
        high = len(arr) - 1
    
    if low < high:
        # Partition and get the pivot index
        pivot_index = partition_hoare(arr, tracer, low, high)
        
        # Recursively sort left partition
        quick_sort_hoare(arr, tracer, low, pivot_index)
        
        # Recursively sort right partition
        quick_sort_hoare(arr, tracer, pivot_index + 1, high)
    
    # Track state after partitioning (only at end)
    if low == 0 and high == len(arr) - 1:
        tracer.add_state(arr.copy()) # Complete state
    
    return arr, tracer

def partition_hoare(arr, tracer, low, high):
    pivot = arr[low]
    # Show pivot selection
    tracer.add_state(arr.copy(), pivot=low, range=[low, high], indexVars=['low', 'high', 'pivot_idx'], variables={'pivot_idx': low, 'low': low, 'high': high})
    
    i = low - 1
    j = high + 1
    
    while True:
        # Move left pointer right
        while True:
            i += 1
            # Show left scan
            if i <= j:
                tracer.add_state(arr.copy(), comparing=[i, low], pivot=low, range=[low, high], indexVars=['i', 'j', 'low', 'high'], variables={'i': i, 'j': j, 'low': low, 'high': high})
            if arr[i] >= pivot:
                break
        
        # Move right pointer left
        while True:
            j -= 1
            # Show right scan
            if i <= j:
                tracer.add_state(arr.copy(), comparing=[j, low], pivot=low, range=[low, high], indexVars=['i', 'j', 'low', 'high'], variables={'i': i, 'j': j, 'low': low, 'high': high})
            if arr[j] <= pivot:
                break
        
        # If pointers haven't crossed, swap
        if i < j:
            # Show which elements will be swapped
            tracer.add_state(arr.copy(), comparing=[i, j], pivot=low, range=[low, high], indexVars=['i', 'j', 'low', 'high'], variables={'i': i, 'j': j, 'low': low, 'high': high})
            swap(arr, i, j)
            # Show swap result
            tracer.add_state(arr.copy(), swapped=[i, j], pivot=low, range=[low, high], indexVars=['i', 'j', 'low', 'high'], variables={'i': i, 'j': j, 'low': low, 'high': high})
        else:
            break
    
    return j

# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    # [/PARAMS]
    sorted_arr, tracer = quick_sort_hoare(original_arr.copy(), Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    # Output tracer data for visualization
    tracer.finalize()
