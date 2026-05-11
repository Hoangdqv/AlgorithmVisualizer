export const consoleErrorHandling = (error) => {
    const message_lowered = (error ?? '').toString().toLowerCase();
    if (message_lowered.includes('fetching server api version')) {
        return 'Execution failed: Server is not started. Make sure Docker Desktop is running.';
    }
    if (message_lowered.includes('failed to fetch')) {
        return 'Execution failed: Unable to connect to the server. Please check your network connection and try again.';
    }
    return `Execution failed: ${message_lowered || 'Unknown error'}`;
};