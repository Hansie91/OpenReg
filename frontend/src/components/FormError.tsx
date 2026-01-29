interface FormErrorProps {
  error: string | null | undefined;
}

export function FormError({ error }: FormErrorProps) {
  if (!error) return null;
  return (
    <p className="form-error" role="alert">
      {error}
    </p>
  );
}
