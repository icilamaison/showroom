"use client";

import {
  normalizeProductOptions,
  type CatalogSizeOption,
  type ProductSelectOption,
} from "@/lib/product-catalog";

type ProductOptionSelectProps = {
  value: string;
  options: string[] | CatalogSizeOption[] | ProductSelectOption[];
  baseSalePrice?: number;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
};

function toSelectOptions(
  options: string[] | CatalogSizeOption[] | ProductSelectOption[],
  baseSalePrice?: number,
): ProductSelectOption[] {
  if (!options.length) {
    return [];
  }

  const first = options[0];
  if (typeof first === "string") {
    return normalizeProductOptions(options as string[], baseSalePrice);
  }

  if (typeof first === "object" && first != null && "value" in first) {
    return options as ProductSelectOption[];
  }

  return normalizeProductOptions(options as CatalogSizeOption[], baseSalePrice);
}

export default function ProductOptionSelect({
  value,
  options,
  baseSalePrice,
  onChange,
  placeholder = "선택",
  className = "",
}: ProductOptionSelectProps) {
  const selectOptions = toSelectOptions(options, baseSalePrice);
  const selectClassName = [
    "contract-doc__cell-input",
    "contract-doc__cell-select",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className={selectClassName}
    >
      <option value="">{placeholder}</option>
      {selectOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
