import React, { forwardRef, type TextareaHTMLAttributes } from 'react';

export interface TextAreaProps extends Omit<
  TextareaHTMLAttributes<HTMLTextAreaElement>,
  'onChange'
> {
  onValueChange?: (value: string) => void;
}

export const TextArea = forwardRef<HTMLTextAreaElement, TextAreaProps>(
  ({ onValueChange, ...props }, ref) => {
    const handleChange = (event: React.ChangeEvent<HTMLTextAreaElement>): void => {
      onValueChange?.(event.target.value);
    };

    return <textarea ref={ref} {...props} onChange={handleChange} />;
  },
);

TextArea.displayName = 'TextArea';
