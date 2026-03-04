/**
 * Common Helper Functions for Algorithm Implementations
 * 
 * This module contains reusable utility functions that are frequently used
 * across multiple algorithms.
 */

export function swap(arr, i, j) {
    [arr[i], arr[j]] = [arr[j], arr[i]];
}
