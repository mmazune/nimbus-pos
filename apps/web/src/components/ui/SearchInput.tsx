import { MagnifyingGlass } from "@phosphor-icons/react";
import { InputHTMLAttributes } from "react";

import { cn } from "@/lib/utils/cn";

type SearchInputProps = InputHTMLAttributes<HTMLInputElement>;

export function SearchInput({ className, ...props }: SearchInputProps) {
  return (
    <label className={cn("relative block", className)}>
      <span className="pointer-events-none absolute left-4 top-1/2 flex -translate-y-1/2 text-text-muted">
        <MagnifyingGlass size={20} aria-hidden />
      </span>
      <input
        type="search"
        className={cn(
          "min-h-12 w-full rounded-md bg-surface py-3 pl-12 pr-4 text-base text-text-primary shadow-subtle",
          "placeholder:text-text-muted",
          "transition-[background-color,box-shadow] duration-150 ease-out",
        )}
        {...props}
      />
    </label>
  );
}
