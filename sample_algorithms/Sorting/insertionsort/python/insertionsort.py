# Simple Insertion Sort in Python
from tracers.tracer import Tracer

# [ALGORITHM]
def insertion_sort(arr, tracer):
    n = len(arr)
    
    for i in range(1, n):
        key = arr[i]
        j = i - 1
        
        tracer.add_state(
            arr.copy(), 
            selected=[i], 
            variables={'i': i}
        )
        arr[i] = None
        
        # Shift elements greater than key one position to the right
        while j >= 0 and arr[j] > key:
            # Comparing (yellow)
            tracer.add_state(
                arr.copy(), 
                comparing=[j, j + 1], 
                variables={'i': i, 'j': j}
            )
            arr[j + 1] = arr[j]
            arr[j] = None  # Leave blank where element came from
            
            # Shifted (green)
            tracer.add_state(
                arr.copy(), 
                swapped=[j, j + 1], 
                variables={'i': i, 'j': j}
            )
            j -= 1
        
        arr[j + 1] = key
    
    tracer.add_state(arr.copy())
    return arr, tracer

# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    # [/PARAMS]
    sorted_arr, tracer = insertion_sort(original_arr.copy(), Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    tracer.finalize()
