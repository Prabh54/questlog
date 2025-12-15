import { forwardRef, useId } from 'react';
import { cn } from '../../lib/cn';

export interface InputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'prefix'> {
  label?: string;
  error?: string;
  hint?: string;
  prefix?: React.ReactNode;
  suffix?: React.ReactNode;
}

const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, label, error, hint, prefix, suffix, id: propId, ...props }, ref) => {
    const generatedId = useId();
    const id = propId ?? generatedId;

    return (
      <div className="w-full space-y-1.5">
        {label && (
          <label htmlFor={id} className="block text-sm font-medium text-surface-200">
            {label}
            {props.required && <span className="ml-1 text-danger-400">*</span>}
          </label>
        )}

        <div className="relative flex items-center">
          {prefix && (
            <span className="absolute left-3 text-surface-400">{prefix}</span>
          )}
          <input
            id={id}
            ref={ref}
            className={cn(
              'form-input w-full rounded-lg border bg-surface-800 text-surface-100 placeholder:text-surface-500',
              'border-surface-700 focus:border-primary-500 focus:ring-1 focus:ring-primary-500',
              'transition-colors duration-150',
              prefix && 'pl-10',
              suffix && 'pr-10',
              error && 'border-danger-500 focus:border-danger-500 focus:ring-danger-500',
              className,
            )}
            aria-invalid={!!error}
            aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
            {...props}
          />
          {suffix && (
            <span className="absolute right-3 text-surface-400">{suffix}</span>
          )}
        </div>

        {error && (
          <p id={`${id}-error`} className="text-xs text-danger-400">
            {error}
          </p>
        )}
        {hint && !error && (
          <p id={`${id}-hint`} className="text-xs text-surface-500">
            {hint}
          </p>
        )}
      </div>
    );
  },
);
Input.displayName = 'Input';

export { Input };
