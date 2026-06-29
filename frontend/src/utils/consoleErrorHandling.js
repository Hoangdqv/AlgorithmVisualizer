// eslint-disable-next-line no-control-regex
const ANSI_PATTERN = /\u001b\[[0-9;]*m/g;
// This strips ANSI escape codes from the error message, which can be present in some environments and may cause issues when displayed in the UI.
export const stripAnsi = (text) => (text ?? '').toString().replace(ANSI_PATTERN, '');

export const consoleErrorHandling = (error) => {
    const sanitized = stripAnsi(error);
    const message_lowered = sanitized.toLowerCase();
    if (message_lowered.includes('fetching server api version')) {
        return 'Execution failed: Server is not started. Make sure Docker Desktop is running.';
    }
    if (message_lowered.includes('failed to fetch')) {
        return 'Execution failed: Unable to connect to the server. Please check your network connection and try again.';
    }
    return `Execution failed: ${sanitized || 'Unknown error'}`;
};