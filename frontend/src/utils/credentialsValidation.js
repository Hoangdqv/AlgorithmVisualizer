export const validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isEmailEmpty = (email) => {
    return email.trim() === '';
}

export const validatePassword = (password) => {
    return password.length >= 8; // Minimum length of 8 characters
};

export const validatePasswordMatch = (password, confirmPassword) => {
    return password === confirmPassword;
};