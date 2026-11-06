import React, { useId, useState } from 'react';
import { AlertTriangleIcon } from '../../../components/icons';

export type TextFieldProps = {
  label: string;
  name: string;
  value: string;
  onChange: (value: string) => void;
  type?: 'text' | 'email' | 'password';
  autoComplete?: string;
  placeholder?: string;
  inputMode?: 'text' | 'email' | 'numeric' | 'tel' | 'url' | 'search' | 'decimal';
  /** Helper text shown under the field (suppressed while an error is shown). */
  hint?: string;
  /** Inline validation message; links itself to the input via aria-describedby. */
  error?: string | null;
  required?: boolean;
  disabled?: boolean;
  minLength?: number;
  /** Adds a Show/Hide toggle for password fields. */
  revealable?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
};

const controlBase =
  'w-full min-h-[44px] border bg-white px-3.5 py-2.5 text-sm text-[#161512] placeholder:text-[#8c877c] transition-colors focus:outline-none focus:border-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed disabled:bg-[#f1eee7]';

/**
 * Labelled form control used by the public account forms: top-aligned label,
 * optional helper text, and an inline error linked with aria-describedby.
 */
export function TextField({
  label,
  name,
  value,
  onChange,
  type = 'text',
  autoComplete,
  placeholder,
  inputMode,
  hint,
  error,
  required = false,
  disabled = false,
  minLength,
  revealable = false,
  inputRef,
}: TextFieldProps) {
  const generatedId = useId();
  const id = `${name}-${generatedId}`;
  const hintId = `${id}-hint`;
  const errorId = `${id}-error`;
  const [revealed, setRevealed] = useState(false);

  const describedBy = [error ? errorId : hint ? hintId : null].filter(Boolean).join(' ');
  const inputType = revealable && revealed ? 'text' : type;

  return (
    <div className="space-y-2">
      <label htmlFor={id} className="block text-sm font-medium text-[#161512]">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          ref={inputRef}
          name={name}
          type={inputType}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          placeholder={placeholder}
          inputMode={inputMode}
          required={required}
          disabled={disabled}
          minLength={minLength}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy || undefined}
          className={`${controlBase} ${
            revealable ? 'pr-20' : ''
          } ${error ? 'border-[#8b0000] bg-[#fdf8f8]' : 'border-[#c9c3b6]'}`}
        />

        {revealable && (
          <button
            type="button"
            onClick={() => setRevealed((current) => !current)}
            disabled={disabled}
            aria-label={revealed ? 'Hide password' : 'Show password'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-xs font-medium text-[#5b574e] underline underline-offset-4 hover:text-[#161512] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-[#7a1f1f] disabled:cursor-not-allowed"
          >
            {revealed ? 'Hide' : 'Show'}
          </button>
        )}
      </div>

      {error ? (
        <p id={errorId} className="flex items-start gap-1.5 text-sm text-[#8b0000]">
          <AlertTriangleIcon className="mt-0.5 h-4 w-4 shrink-0" />
          {error}
        </p>
      ) : (
        hint && (
          <p id={hintId} className="text-xs leading-5 text-[#5b574e]">
            {hint}
          </p>
        )
      )}
    </div>
  );
}
