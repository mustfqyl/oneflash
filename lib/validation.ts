const CONTROL_CHARACTERS_PATTERN = /[\u0000-\u001F\u007F]/;
const USERNAME_PATTERN = /^[a-z0-9_]{3,20}$/;

export function normalizeEmail(value: string) {
  return value.trim().toLowerCase();
}

export function getPasswordValidationError(value: string) {
  if (value.trim().length < 10) {
    return "Password must be at least 10 characters";
  }

  if (!/[a-z]/.test(value) || !/[A-Z]/.test(value) || !/\d/.test(value)) {
    return "Password must include uppercase, lowercase, and a number";
  }

  return null;
}

export function getDisplayNameValidationError(value: string) {
  const trimmed = value.trim();

  if (trimmed.length < 2 || trimmed.length > 50) {
    return "Name must be 2-50 characters";
  }

  if (CONTROL_CHARACTERS_PATTERN.test(trimmed) || /[<>]/.test(trimmed)) {
    return "Name contains invalid characters";
  }

  return null;
}

export function getUsernameValidationError(value: string) {
  const normalized = value.trim().toLowerCase();

  if (!normalized) {
    return "Username is required";
  }

  if (!USERNAME_PATTERN.test(normalized)) {
    return "Username must be 3-20 characters long and can only contain lowercase letters, numbers, and underscores";
  }

  return null;
}

export function isValidSixDigitPin(value: string) {
  return /^\d{6}$/.test(value);
}

export function getItemNameValidationError(
  value: string,
  label = "Name"
) {
  const trimmed = value.trim();

  if (!trimmed) {
    return `${label} is required`;
  }

  if (trimmed.length > 255) {
    return `${label} must be 255 characters or fewer`;
  }

  if (CONTROL_CHARACTERS_PATTERN.test(trimmed) || /[\\/]/.test(trimmed)) {
    return `${label} contains invalid characters`;
  }

  return null;
}
