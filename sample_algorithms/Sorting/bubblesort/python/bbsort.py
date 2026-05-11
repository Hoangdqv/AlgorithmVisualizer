from runtime.tracer import Tracer
from helpers import swap

# [ALGORITHM]
def bubble_sort(arr, tracer):
    n = len(arr)
    for i in range(n):
        swapped = False
        for j in range(0, n - i - 1):
            # Show comparison (yellow)
            tracer.add_state(
                arr.copy(), 
                comparing=[j, j + 1],
                indexVars=['i', 'j'],
                variables={'i': i, 'j': j}
            )
            if arr[j] > arr[j + 1]:
                swap(arr, j, j + 1)
                # Show swap result (green)
                tracer.add_state(
                    arr.copy(), 
                    swapped=[j, j + 1],
                    indexVars=['i', 'j'],
                    variables={'i': i, 'j': j}
                )
                swapped = True
        if not swapped:
            break
    tracer.add_state(arr.copy()) #Complete state
    return arr, tracer

# [TEST]
if __name__ == "__main__":
    # [PARAMS]
    original_arr = [92, 14, 461, 1122, 235, 9, 127]
    # [/PARAMS]
    sorted_arr, tracer = bubble_sort(original_arr.copy(), Tracer(category='sorting'))

    print(f'Original array: {original_arr}')
    print(f'Sorted array: {sorted_arr}')
    
    tracer.finalize()