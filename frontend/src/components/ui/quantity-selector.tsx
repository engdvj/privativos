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
    <div className="space-y-1.5">
      {label && (
        <label className="text-xs font-medium text-muted-foreground">
          {label}
        </label>
      )}
      <div className="relative inline-flex items-center gap-0 rounded-xl border border-border/70 bg-gradient-to-br from-surface-2 to-surface-2/50 p-1 shadow-sm transition-shadow hover:shadow-md">
        {/* Botão de Decremento */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleDecrement}
          disabled={!canDecrement || disabled}
          className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          aria-label="Diminuir quantidade"
        >
          <Minus className="h-4 w-4" />
        </Button>

        {/* Display do Valor */}
        <div className="relative flex items-center justify-center px-2">
          <input
            type="number"
            value={value}
            onChange={handleInputChange}
            min={min}
            max={max}
            disabled={disabled}
            className="w-14 bg-transparent text-center text-lg font-bold tabular-nums text-foreground focus:outline-none disabled:opacity-50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            aria-label="Quantidade"
          />
        </div>

        {/* Botão de Incremento */}
        <Button
          type="button"
          variant="ghost"
          size="icon"
          onClick={handleIncrement}
          disabled={!canIncrement || disabled}
          className="h-9 w-9 rounded-lg hover:bg-primary/10 hover:text-primary disabled:opacity-30 disabled:cursor-not-allowed transition-all active:scale-95"
          aria-label="Aumentar quantidade"
        >
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      {/* Indicador de Máximo */}
      {max > 1 && (
        <p className="text-xs text-muted-foreground text-center">
          Máx: <span className="font-semibold text-foreground">{max}</span>
        </p>
      )}
    </div>
  );
}
