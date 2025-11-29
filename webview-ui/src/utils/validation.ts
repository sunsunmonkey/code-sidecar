/**
 * Validation utility functions for configuration inputs
 * Provides validation for URLs, numbers, required fields, and other configuration values
 */

/**
 * Validates a URL string
 * @param url - The URL string to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateUrl(url: string): string | undefined {
  if (!url || url.trim() === '') {
    return 'URL is required';
  }

  try {
    const urlObj = new URL(url);
    if (!urlObj.protocol.startsWith('http')) {
      return 'URL must use HTTP or HTTPS protocol';
    }
    return undefined;
  } catch {
    return 'Invalid URL format';
  }
}

/**
 * Validates a number within optional min/max bounds
 * @param value - The value to validate (can be string or number)
 * @param options - Validation options including min, max, and integer requirement
 * @returns Error message if invalid, undefined if valid
 */
export function validateNumber(
  value: string | number,
  options?: {
    min?: number;
    max?: number;
    integer?: boolean;
  }
): string | undefined {
  const numValue = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(numValue)) {
    return 'Must be a valid number';
  }

  if (options?.integer && !Number.isInteger(numValue)) {
    return 'Must be an integer';
  }

  if (options?.min !== undefined && numValue < options.min) {
    return `Must be at least ${options.min}`;
  }

  if (options?.max !== undefined && numValue > options.max) {
    return `Must be at most ${options.max}`;
  }

  return undefined;
}

/**
 * Validates that a required field is not empty
 * @param value - The value to validate
 * @param fieldName - The name of the field for error messages
 * @returns Error message if invalid, undefined if valid
 */
export function validateRequired(value: string, fieldName?: string): string | undefined {
  if (!value || value.trim() === '') {
    return fieldName ? `${fieldName} is required` : 'This field is required';
  }
  return undefined;
}

/**
 * Validates temperature value (0-2 range for LLM APIs)
 * @param temperature - The temperature value to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateTemperature(temperature: number | string): string | undefined {
  return validateNumber(temperature, { min: 0, max: 2 });
}

/**
 * Validates max tokens value (must be positive integer)
 * @param maxTokens - The max tokens value to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateMaxTokens(maxTokens: number | string): string | undefined {
  return validateNumber(maxTokens, { min: 1, integer: true });
}

/**
 * Validates max loop count (must be positive integer)
 * @param maxLoopCount - The max loop count value to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateMaxLoopCount(maxLoopCount: number | string): string | undefined {
  return validateNumber(maxLoopCount, { min: 1, integer: true });
}

/**
 * Validates context window size (must be positive integer)
 * @param contextWindowSize - The context window size value to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateContextWindowSize(contextWindowSize: number | string): string | undefined {
  return validateNumber(contextWindowSize, { min: 1, integer: true });
}

/**
 * Validates model name (must not be empty)
 * @param model - The model name to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateModel(model: string): string | undefined {
  return validateRequired(model, 'Model name');
}

/**
 * Validates API key (must not be empty)
 * @param apiKey - The API key to validate
 * @returns Error message if invalid, undefined if valid
 */
export function validateApiKey(apiKey: string): string | undefined {
  return validateRequired(apiKey, 'API key');
}
