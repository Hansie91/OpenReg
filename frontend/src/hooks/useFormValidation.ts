import { useState, useCallback } from 'react';

// Validation rule types
type ValidationRule<T> = {
  validate: (value: T, allValues?: Record<string, unknown>) => boolean;
  message: string;
};

type FieldRules<T> = ValidationRule<T>[];

interface UseFormValidationOptions<T extends Record<string, string>> {
  initialValues: T;
  rules: Partial<Record<keyof T, FieldRules<string>>>;
  onSubmit: (values: T) => void | Promise<void>;
}

// Built-in validation rules
export const validators = {
  required: (message = 'This field is required'): ValidationRule<string> => ({
    validate: (value) => value.trim().length > 0,
    message,
  }),

  email: (message = 'Please enter a valid email address'): ValidationRule<string> => ({
    validate: (value) => !value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value),
    message,
  }),

  minLength: (min: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length >= min,
    message: message || `Must be at least ${min} characters`,
  }),

  maxLength: (max: number, message?: string): ValidationRule<string> => ({
    validate: (value) => !value || value.length <= max,
    message: message || `Must be no more than ${max} characters`,
  }),

  pattern: (regex: RegExp, message: string): ValidationRule<string> => ({
    validate: (value) => !value || regex.test(value),
    message,
  }),

  port: (message = 'Please enter a valid port number (1-65535)'): ValidationRule<string> => ({
    validate: (value) => {
      if (!value) return true;
      const port = parseInt(value, 10);
      return !isNaN(port) && port >= 1 && port <= 65535;
    },
    message,
  }),

  url: (message = 'Please enter a valid URL'): ValidationRule<string> => ({
    validate: (value) => {
      if (!value) return true;
      try {
        new URL(value);
        return true;
      } catch {
        return false;
      }
    },
    message,
  }),
};

export function useFormValidation<T extends Record<string, string>>({
  initialValues,
  rules,
  onSubmit,
}: UseFormValidationOptions<T>) {
  const [values, setValues] = useState<T>(initialValues);
  const [errors, setErrors] = useState<Partial<Record<keyof T, string | null>>>({});
  const [touched, setTouched] = useState<Partial<Record<keyof T, boolean>>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Validate single field
  const validateField = useCallback(
    (name: keyof T, value: string): string | null => {
      const fieldRules = rules[name];
      if (!fieldRules) return null;

      for (const rule of fieldRules) {
        if (!rule.validate(value, values as Record<string, unknown>)) {
          return rule.message;
        }
      }
      return null;
    },
    [rules, values]
  );

  // Validate all fields
  const validateAll = useCallback((): boolean => {
    const newErrors: Partial<Record<keyof T, string | null>> = {};
    let isValid = true;

    for (const name of Object.keys(values) as Array<keyof T>) {
      const error = validateField(name, values[name]);
      newErrors[name] = error;
      if (error) isValid = false;
    }

    setErrors(newErrors);
    return isValid;
  }, [values, validateField]);

  // Handle field change
  const handleChange = useCallback(
    (name: keyof T) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
      const value = e.target.value;
      setValues((prev) => ({ ...prev, [name]: value }));

      // Validate on change if field was already touched
      if (touched[name]) {
        const error = validateField(name, value);
        setErrors((prev) => ({ ...prev, [name]: error }));
      }
    },
    [touched, validateField]
  );

  // Handle field blur (validate on blur)
  const handleBlur = useCallback(
    (name: keyof T) => () => {
      setTouched((prev) => ({ ...prev, [name]: true }));
      const error = validateField(name, values[name]);
      setErrors((prev) => ({ ...prev, [name]: error }));
    },
    [values, validateField]
  );

  // Handle form submit
  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();

      // Mark all fields as touched
      const allTouched = Object.keys(values).reduce(
        (acc, key) => ({ ...acc, [key]: true }),
        {} as Record<keyof T, boolean>
      );
      setTouched(allTouched);

      // Validate all
      if (!validateAll()) return;

      setIsSubmitting(true);
      try {
        await onSubmit(values);
      } finally {
        setIsSubmitting(false);
      }
    },
    [values, validateAll, onSubmit]
  );

  // Get field props helper
  const getFieldProps = useCallback(
    (name: keyof T) => ({
      name: name as string,
      value: values[name],
      onChange: handleChange(name),
      onBlur: handleBlur(name),
      error: touched[name] ? errors[name] : null,
    }),
    [values, errors, touched, handleChange, handleBlur]
  );

  // Check if form has any errors
  const hasErrors = Object.values(errors).some((error) => error !== null);

  // Reset form
  const reset = useCallback(() => {
    setValues(initialValues);
    setErrors({});
    setTouched({});
  }, [initialValues]);

  return {
    values,
    errors,
    touched,
    isSubmitting,
    hasErrors,
    handleChange,
    handleBlur,
    handleSubmit,
    getFieldProps,
    validateField,
    validateAll,
    reset,
    setValues,
  };
}
