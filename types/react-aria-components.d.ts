// Type declarations for react-aria-components
// The installed version exports these components but TypeScript can't resolve the types
declare module 'react-aria-components' {
    import * as React from 'react';

    export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
        isDisabled?: boolean;
        onPress?: (e: any) => void;
        className?: string | ((renderProps: any) => string);
        children?: React.ReactNode | ((renderProps: any) => React.ReactNode);
    }

    export const Button: React.ForwardRefExoticComponent<ButtonProps & React.RefAttributes<HTMLButtonElement>>;

    export function composeRenderProps<T>(
        className: T | undefined,
        fn: (className: string) => string
    ): any;

    export interface FileTriggerProps {
        acceptedFileTypes?: string[];
        allowsMultiple?: boolean;
        onSelect?: (files: FileList | null) => void;
        children?: React.ReactNode;
    }

    export const FileTrigger: React.FC<FileTriggerProps>;
}
