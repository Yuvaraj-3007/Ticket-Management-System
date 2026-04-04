import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";

interface EnumSelectProps<T extends string> {
  value: T;
  options: readonly T[];
  labels: Record<T, string>;
  onValueChange: (val: T) => void;
  disabled?: boolean;
  /** Tailwind width class, e.g. "w-[150px]" */
  width?: string;
  isError?: boolean;
  errorMessage?: string;
}

/**
 * A generic Select for enum-like option sets (Status, Category, SenderType, etc.).
 * Renders the trigger with the current label, maps options to SelectItems,
 * and shows an inline error message when isError is true.
 */
function EnumSelect<T extends string>({
  value,
  options,
  labels,
  onValueChange,
  disabled,
  width = "w-[150px]",
  isError,
  errorMessage,
}: EnumSelectProps<T>) {
  return (
    <>
      <Select value={value} onValueChange={(val) => onValueChange(val as T)}>
        <SelectTrigger size="sm" className={width} disabled={disabled}>
          <span>{labels[value]}</span>
        </SelectTrigger>
        <SelectContent>
          {options.map((o) => (
            <SelectItem key={o} value={o}>{labels[o]}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {isError && errorMessage && (
        <p className="text-xs text-destructive mt-1">{errorMessage}</p>
      )}
    </>
  );
}

export { EnumSelect };
