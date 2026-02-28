import { Minus, Plus } from "lucide-react";
import { Button } from "./button";

interface QuantitySelectorProps {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  disabled?: boolean;
  label?: string;
}

export function QuantitySelector({
  value,
  onChange,
  min = 1,
  max = 99,
  disabled = false,
  label,
}: QuantitySelectorProps) {
  const canDecrement = value > min;
  const canIncrement = value < max;

  const handleDecrement = () => {
    if (canDecrement && !disabled) {
      onChange(value - 1);
    }
  };

  const handleIncrement = () => {
    if (canIncrement && !disabled) {
      onChange(value + 1);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = parseInt(e.target.value);
    if (!isNaN(newValue) && newValue >= min && newValue <= max) {
      onChange(newValue);
    }
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-xs font-medium leading-none text-muted-foreground">
          {label}
        </label>
      )}
      <div className="inline-flex items-center gap-0.5 rounded-full border border-border/70 bg-surface-1 px-1 py-1 shadow-sm">
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDecrement}
          disabled={!canDecrement || disabled}
          className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary disabled:opacity-45 transition-all active:scale-95"
          aria-label="Diminuir quantidade"
        >
          <Minus className="h-3.5 w-3.5" />
        </Button>

        <div className="flex min-w-10 items-center justify-center px-1">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            disabled={disabled}
            className="w-10 bg-transparent text-center text-base font-semibold tabular-nums text-foreground focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Quantidade"
          />
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleIncrement}
          disabled={!canIncrement || disabled}
          className="h-8 w-8 rounded-full hover:bg-primary/10 hover:text-primary disabled:opacity-45 transition-all active:scale-95"
          aria-label="Aumentar quantidade"
        >
          <Plus className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
