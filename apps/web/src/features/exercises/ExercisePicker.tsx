import { useState } from "react";
import { ChevronsUpDown, Plus } from "lucide-react";
import type { Exercise } from "../../api/types";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";

interface ExercisePickerProps {
  exercises: Exercise[];
  onSelect: (exercise: Exercise) => void;
  placeholder?: string;
}

export function ExercisePicker({
  exercises,
  onSelect,
  placeholder = "Buscar ejercicio…",
}: ExercisePickerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      {/* Render the Radix trigger directly (not asChild+Button): the vendored
          Button is authored React-19-style without forwardRef, so under React 18
          it would swallow the anchor ref and the popover would mis-position. */}
      <PopoverTrigger
        type="button"
        role="combobox"
        aria-expanded={open}
        className={cn(
          buttonVariants({ variant: "outline" }),
          "w-full justify-between font-normal text-muted-foreground",
        )}
      >
        <span className="flex items-center gap-1.5">
          <Plus className="size-3.5" />
          Agregar ejercicio
        </span>
        <ChevronsUpDown className="size-4 opacity-50" />
      </PopoverTrigger>
      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0">
        <Command>
          <CommandInput placeholder={placeholder} />
          <CommandList>
            <CommandEmpty>Sin resultados</CommandEmpty>
            {exercises.map((ex) => (
              <CommandItem
                key={ex.id}
                value={ex.name}
                onSelect={() => {
                  onSelect(ex);
                  setOpen(false);
                }}
              >
                {ex.name}
              </CommandItem>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
