# Quick Sort in Python
import tracers.tracer as trc

# [ALGORITHM]
def quick_sort(arr, tracer, low=0, high=None):
    if high is None:
        high = len(arr) - 1
    
    if low < high:
        # Partition and get the pivot index
        pivot_index = partition(arr, tracer, low, high)
        
        # Recursively sort left partition
        quick_sort(arr, tracer, low, pivot_index - 1)
        
        # Recursively sort right partition
        quick_sort(arr, tracer, pivot_index + 1, high)
    
    if low == 0 and high == len(arr) - 1:
        tracer.add_state(arr.copy(), variables={})
    
    return arr, tracer

def partition(arr, tracer, low, high):
    pivot = arr[high]
    i = low - 1
    
    tracer.add_state(arr.copy(), pivot=high, variables={'pivot_idx': high, 'low': low, 'high': high, 'i': i})
    
    for j in range(low, high):
        tracer.add_state(arr.copy(), comparing=[j], pivot=high, variables={'i': i, 'j': j, 'low': low, 'high': high})
        
        if arr[j] < pivot:
            i += 1
            if i != j:
                arr[i], arr[j] = arr[j], arr[i]
                tracer.add_state(arr.copy(), swapped=[i, j], pivot=high, variables={'i': i, 'j': j, 'low': low, 'high': high})
    
    if i + 1 != high:
        arr[i + 1], arr[high] = arr[high], arr[i + 1]
        tracer.add_state(arr.copy(), swapped=[i + 1, high], variables={'i': i, 'pivot_idx': i + 1, 'low': low, 'high': high})
    else:
        tracer.add_state(arr.copy(), pivot=i + 1, variables={'i': i, 'pivot_idx': i + 1, 'low': low, 'high': high})
    
    return i + 1

# [TEST]
if __name__ == "__main__":
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    sorted_arr, tracer = quick_sort(original_arr.copy(), trc.Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    # Output tracer data for visualization
    tracer.finalize()
