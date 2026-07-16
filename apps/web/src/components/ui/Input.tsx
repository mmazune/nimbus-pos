import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

export function Input({ className, type = "text", ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      type={type}
      className={cn(
        "min-h-11 w-full rounded-md bg-surface px-4 text-base text-text-primary shadow-subtle",
        "placeholder:text-text-muted",
        "transition-[background-color,box-shadow] duration-150 ease-out",
        "disabled:bg-surface-muted disabled:text-text-muted",
        className,
      )}
      {...props}
    />
  );
}
