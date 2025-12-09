export const validateEmail = (email) => {
    if (isEmailEmpty(email)) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

export const isUsernameEmpty = (username) => {
    return username.trim() === '';
}

export const isEmailEmpty = (email) => {
    return email.trim() === '';
}

export const validatePassword = (password) => {
    return password.length >= 8;
};

export const validatePasswordMatch = (password, confirmPassword) => {
    return password === confirmPassword;
};