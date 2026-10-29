"use client";

import * as React from "react";
import { Popover as PopoverPrimitive } from "radix-ui";
import {
  addDays,
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  isValid,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

type CalendarDatePickerProps = Omit<
  React.ComponentPropsWithoutRef<"button">,
  "type" | "value" | "onChange"
> & {
  value?: string;
  onChange: (value: string) => void;
  min?: string;
  max?: string;
  required?: boolean;
  name?: string;
};

const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

const CalendarDatePicker = React.forwardRef<
  HTMLButtonElement,
  CalendarDatePickerProps
>(function CalendarDatePicker(
  {
    id,
    name,
    value = "",
    onChange,
    min,
    max,
    required,
    disabled,
    className,
    onBlur,
    ...buttonProps
  },
  ref
) {
  const selectedDate = value ? parseISO(value) : undefined;
  const validSelectedDate = selectedDate && isValid(selectedDate) ? selectedDate : undefined;
  const [open, setOpen] = React.useState(false);
  const [month, setMonth] = React.useState(() =>
    startOfMonth(validSelectedDate ?? new Date())
  );

  const days = eachDayOfInterval({
    start: startOfWeek(startOfMonth(month)),
    end: endOfWeek(endOfMonth(month)),
  });

  function setPopoverOpen(nextOpen: boolean) {
    if (nextOpen) setMonth(startOfMonth(validSelectedDate ?? new Date()));
    setOpen(nextOpen);
  }

  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setPopoverOpen}>
      <PopoverPrimitive.Trigger asChild>
        <button
          {...buttonProps}
          ref={ref}
          id={id}
          type="button"
          disabled={disabled}
          aria-label={validSelectedDate ? format(validSelectedDate, "EEEE, MMMM d, yyyy") : "Choose date"}
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-required={required || undefined}
          onBlur={onBlur}
          data-slot="input"
          className={cn(
            "flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded-none border border-input bg-background px-2.5 py-1 text-left text-xs text-foreground outline-none transition-colors focus-visible:border-ring focus-visible:ring-1 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-input/50 disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-1 aria-invalid:ring-destructive/20 dark:bg-input/30 dark:disabled:bg-input/80 dark:aria-invalid:border-destructive/50 dark:aria-invalid:ring-destructive/40",
            className
          )}
        >
          <span className={cn("truncate", !validSelectedDate && "text-muted-foreground")}>
            {validSelectedDate ? format(validSelectedDate, "MMM d, yyyy") : "Select date"}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        </button>
      </PopoverPrimitive.Trigger>

      {name && <input type="hidden" name={name} value={value} />}

      <PopoverPrimitive.Portal>
        <PopoverPrimitive.Content
          align="start"
          sideOffset={6}
          collisionPadding={12}
          aria-label="Choose date"
          className="z-[100] w-[min(20rem,calc(100vw-1.5rem))] rounded-none border border-border bg-popover p-3 text-popover-foreground shadow-lg ring-1 ring-foreground/10 outline-none animation-duration-200 data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-98 data-[state=open]:slide-in-from-top-2 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-98 data-[state=closed]:slide-out-to-top-2"
        >
          <div className="mb-3 flex items-center justify-between">
            <button
              type="button"
              aria-label="Previous month"
              onClick={() => setMonth((current) => addMonths(current, -1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            </button>
            <p className="text-sm font-medium" aria-live="polite">
              {format(month, "MMMM yyyy")}
            </p>
            <button
              type="button"
              aria-label="Next month"
              onClick={() => setMonth((current) => addMonths(current, 1))}
              className="inline-flex h-8 w-8 items-center justify-center rounded-none text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <ChevronRight className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>

          <div role="group" aria-label={format(month, "MMMM yyyy")}>
            <div className="mb-1 grid grid-cols-7">
              {WEEKDAYS.map((day) => (
                <div key={day} aria-hidden="true" className="py-1 text-center text-[10px] font-medium text-muted-foreground">
                  {day}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1">
              {days.map((day) => {
                const dateValue = format(day, "yyyy-MM-dd");
                const isSelected = validSelectedDate ? isSameDay(day, validSelectedDate) : false;
                const outsideMonth = !isSameMonth(day, month);
                const outsideRange = Boolean((min && dateValue < min) || (max && dateValue > max));

                return (
                  <button
                    key={dateValue}
                    type="button"
                    aria-label={format(day, "EEEE, MMMM d, yyyy")}
                    aria-pressed={isSelected}
                    aria-current={format(new Date(), "yyyy-MM-dd") === dateValue ? "date" : undefined}
                    disabled={outsideRange}
                    onClick={() => {
                      onChange(dateValue);
                      setOpen(false);
                    }}
                    className={cn(
                      "h-9 min-w-0 rounded-none text-xs tabular-nums transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-30",
                      outsideMonth && "text-muted-foreground/50",
                      !outsideMonth && !isSelected && "text-foreground",
                      isSelected && "bg-primary font-medium text-primary-foreground hover:bg-primary/90",
                      !isSelected && format(new Date(), "yyyy-MM-dd") === dateValue && "ring-1 ring-inset ring-primary/50"
                    )}
                  >
                    {format(day, "d")}
                  </button>
                );
              })}
            </div>
          </div>
        </PopoverPrimitive.Content>
      </PopoverPrimitive.Portal>
    </PopoverPrimitive.Root>
  );
});

CalendarDatePicker.displayName = "CalendarDatePicker";

export { CalendarDatePicker };
