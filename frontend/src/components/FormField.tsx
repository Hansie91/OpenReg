import { InputHTMLAttributes } from 'react';
import { FormError } from './FormError';

interface FormFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  label: string;
  name: string;
  error?: string | null;
  hint?: string;
  required?: boolean;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onBlur?: () => void;
}

export function FormField({
  label,
  name,
  error,
  hint,
  required,
  className = '',
  ...inputProps
}: FormFieldProps) {
  const inputId = `field-${name}`;
  const errorId = `${inputId}-error`;
  const hasError = !!error;

  return (
    <div className="form-field">
      <label htmlFor={inputId} className="input-label">
        {label}
        {required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      <input
        id={inputId}
        name={name}
        className={`input ${hasError ? 'input-error' : ''} ${className}`}
        aria-invalid={hasError}
        aria-describedby={hasError ? errorId : undefined}
        {...inputProps}
      />
      {hint && !error && (
        <p className="text-xs text-gray-500 mt-1">{hint}</p>
      )}
      <FormError error={error} />
    </div>
  );
}
