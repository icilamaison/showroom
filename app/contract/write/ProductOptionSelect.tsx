"use client";

import { useState } from "react";
import {
  normalizeProductOptions,
  type CatalogSizeOption,
  type ProductSelectOption,
} from "@/lib/product-catalog";

// 실제 옵션 값과 겹치지 않는 표식. onChange로는 전달하지 않는다.
const CUSTOM_OPTION_VALUE = "__custom__";

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
  // 카탈로그에 없는 옵션(주문 제작 사이즈 등)은 "직접 입력"으로 받는다.
  // 저장된 값이 목록에 없으면 처음부터 입력칸으로 보여준다.
  // 제품을 바꾸면 옵션 목록이 달라지므로 그때는 다시 셀렉트로 돌아가게 목록 기준으로 기억한다.
  const optionsKey = selectOptions.map((option) => option.value).join("|");
  const [customOptionsKey, setCustomOptionsKey] = useState<string | null>(() =>
    value !== "" && !selectOptions.some((option) => option.value === value)
      ? optionsKey
      : null,
  );
  const isCustom = customOptionsKey === optionsKey;
  const selectClassName = [
    "contract-doc__cell-input",
    "contract-doc__cell-select",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  if (isCustom) {
    return (
      <input
        type="text"
        value={value}
        autoFocus
        placeholder="직접 입력"
        onChange={(event) => onChange(event.target.value)}
        // 비운 채로 벗어나면 다시 목록에서 고를 수 있게 되돌린다
        onBlur={() => {
          if (!value.trim()) {
            setCustomOptionsKey(null);
          }
        }}
        className="contract-doc__cell-input"
      />
    );
  }

  return (
    <select
      value={value}
      onChange={(event) => {
        if (event.target.value === CUSTOM_OPTION_VALUE) {
          setCustomOptionsKey(optionsKey);
          onChange("");
          return;
        }

        onChange(event.target.value);
      }}
      className={selectClassName}
    >
      <option value="">{placeholder}</option>
      {selectOptions.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
      <option value={CUSTOM_OPTION_VALUE}>직접 입력</option>
    </select>
  );
}
