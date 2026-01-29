interface LoadingStateProps {
  message?: string;
  size?: 'sm' | 'md' | 'lg';
}

const sizeClasses = {
  sm: 'p-4',
  md: 'p-8',
  lg: 'p-12',
};

export function LoadingState({ message = 'Loading...', size = 'md' }: LoadingStateProps) {
  return (
    <div className={`card text-center ${sizeClasses[size]}`}>
      <div className="spinner mx-auto text-blue-600"></div>
      <p className="mt-3 text-sm text-gray-500">{message}</p>
    </div>
  );
}
