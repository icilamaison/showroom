"use client";

type ProductOptionSelectProps = {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  placeholder?: string;
};

export default function ProductOptionSelect({
  value,
  options,
  onChange,
  placeholder = "선택",
}: ProductOptionSelectProps) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value)}
      className="contract-doc__cell-input contract-doc__cell-select"
    >
      <option value="">{placeholder}</option>
      {options.map((option) => (
        <option key={option} value={option}>
          {option}
        </option>
      ))}
    </select>
  );
}
