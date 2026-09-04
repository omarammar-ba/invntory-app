import React, { useState } from 'react';
import {
  Check,
  ChevronDown,
} from 'lucide-react';

import {
  useIsMobile,
} from '@/hooks/useMediaQuery';

import {
  ResponsiveOverlay,
} from './ResponsiveOverlay';

export interface AppChoiceOption {
  id: string;
  label: string;
  value: string | number;
  description?: string;
}

interface AppChoiceFieldProps {
  label?: string;
  value: string | number;
  onChange: (
    value: string | number,
  ) => void;
  options: AppChoiceOption[];
  placeholder?: string;
  disabled?: boolean;
  required?: boolean;
  mobilePresentation?: 'sheet' | 'inline';
}

export const AppChoiceField: React.FC<
  AppChoiceFieldProps
> = ({
  label,
  value,
  onChange,
  options,
  placeholder = 'اختر...',
  disabled = false,
  required = false,
  mobilePresentation = 'inline',
}) => {
  const [open, setOpen] =
    useState(false);

  const isMobile =
    useIsMobile();

  const selectedOption =
    options.find(
      option =>
        option.value === value,
    );

  if (!isMobile) {
    return (
      <div className="w-full">
        {label && (
          <label
            className="
              mb-1.5
              block
              px-0.5
              text-xs
              font-semibold
              text-slate-700
              dark:text-slate-300
            "
          >
            {label}

            {required && (
              <span className="mr-1 text-rose-500">
                *
              </span>
            )}
          </label>
        )}

        <select
          value={value}
          disabled={disabled}
          required={required}
          onChange={event => {
            const matched =
              options.find(
                option =>
                  String(
                    option.value,
                  ) ===
                  event.target.value,
              );

            if (matched) {
              onChange(
                matched.value,
              );
            }
          }}
          className="
            h-11
            w-full
            rounded-[13px]
            border
            border-slate-200/80
            bg-white
            px-3
            text-sm
            font-semibold
            text-slate-800
            outline-none
            transition
            focus:border-indigo-400
            focus:ring-2
            focus:ring-indigo-500/15
            disabled:cursor-not-allowed
            disabled:opacity-50
            dark:border-white/[0.08]
            dark:bg-neutral-900
            dark:text-slate-200
          "
        >
          {!selectedOption && (
            <option value="">
              {placeholder}
            </option>
          )}

          {options.map(
            option => (
              <option
                key={option.id}
                value={String(
                  option.value,
                )}
              >
                {option.label}
              </option>
            ),
          )}
        </select>
      </div>
    );
  }

  return (
    <div className="w-full">
      {label && (
        <label
          className="
            mb-1.5
            block
            px-0.5
            text-xs
            font-semibold
            text-slate-700
            dark:text-slate-300
          "
        >
          {label}

          {required && (
            <span className="mr-1 text-rose-500">
              *
            </span>
          )}
        </label>
      )}

      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen(previous => !previous)}
        aria-expanded={open}
        className="
          flex
          h-11
          w-full
          items-center
          justify-between
          rounded-[13px]
          border
          border-slate-200/80
          bg-white
          px-3
          text-right
          text-sm
          font-semibold
          text-slate-800
          shadow-sm
          transition
          focus:outline-none
          focus:ring-2
          focus:ring-indigo-500/20
          disabled:cursor-not-allowed
          disabled:opacity-50
          dark:border-white/[0.08]
          dark:bg-neutral-900
          dark:text-slate-200
        "
      >
        <span
          className={
            selectedOption
              ? ''
              : 'text-slate-400 dark:text-slate-500'
          }
        >
          {selectedOption?.label ||
            (value !== '' &&
            value !== null &&
            value !== undefined
              ? String(value)
              : placeholder)}
        </span>

        <ChevronDown
          className="
            h-4
            w-4
            shrink-0
            text-slate-400
          "
        />
      </button>

      {mobilePresentation === 'inline' ? (
        open && (
          <div
            className="mt-2 overflow-hidden rounded-[14px] border border-slate-200/80 bg-slate-50/70 p-1.5 shadow-sm dark:border-white/[0.08] dark:bg-neutral-800/55"
            role="listbox"
            aria-label={label || placeholder}
          >
            {options.map(option => {
              const selected = option.value === value;

              return (
                <button
                  key={option.id}
                  type="button"
                  role="option"
                  aria-selected={selected}
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`
                    flex w-full items-center justify-between gap-3
                    rounded-[11px] px-3.5 py-3 text-right
                    transition-colors
                    ${
                      selected
                        ? 'bg-white text-indigo-700 shadow-sm dark:bg-neutral-900 dark:text-indigo-300'
                        : 'text-slate-700 hover:bg-white/80 dark:text-slate-300 dark:hover:bg-neutral-900/70'
                    }
                  `}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {option.label}
                    </span>

                    {option.description && (
                      <span className="mt-0.5 block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {option.description}
                      </span>
                    )}
                  </span>

                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        )
      ) : (
        <ResponsiveOverlay
          open={open}
          onClose={() => setOpen(false)}
          title={label || placeholder}
          mobileSnap="compact"
          desktopMaxWidth="max-w-md"
        >
          <div className="space-y-1">
            {options.map(option => {
              const selected = option.value === value;

              return (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`
                    flex w-full items-center justify-between gap-3
                    rounded-[12px] px-3.5 py-3 text-right
                    transition-colors
                    ${
                      selected
                        ? 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300'
                        : 'text-slate-700 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-neutral-800'
                    }
                  `}
                >
                  <span className="min-w-0">
                    <span className="block text-sm font-bold">
                      {option.label}
                    </span>

                    {option.description && (
                      <span className="mt-0.5 block text-[10px] font-medium text-slate-500 dark:text-slate-400">
                        {option.description}
                      </span>
                    )}
                  </span>

                  {selected && <Check className="h-4 w-4 shrink-0" />}
                </button>
              );
            })}
          </div>
        </ResponsiveOverlay>
      )}
    </div>
  );
};
