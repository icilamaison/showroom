"use client";

import type { SetComponent } from "@/lib/product-catalog";
import type { SetComponentSelection } from "@/lib/set-product";
import ProductOptionSelect from "./ProductOptionSelect";

type SetProductComponentsProps = {
  rowIndex: number;
  components: SetComponent[];
  selections: SetComponentSelection[];
  onChange: (
    componentIndex: number,
    field: keyof SetComponentSelection,
    value: string,
  ) => void;
};

export default function SetProductComponents({
  rowIndex,
  components,
  selections,
  onChange,
}: SetProductComponentsProps) {
  return (
    <>
      {components.map((component, componentIndex) => {
        const selection = selections[componentIndex] ?? { color: "", size: "" };
        const colorOptions = component.colors ?? [];
        const sizeOptions = component.sizes ?? [];

        return (
          <tr
            key={`${rowIndex}-component-${componentIndex}`}
            className="contract-doc__set-component-row"
          >
            <td />
            <td className="contract-doc__set-component-name">{component.name}</td>
            <td>
              {colorOptions.length > 1 ? (
                <ProductOptionSelect
                  value={selection.color}
                  options={colorOptions}
                  onChange={(value) => onChange(componentIndex, "color", value)}
                />
              ) : colorOptions.length === 1 ? (
                <span className="contract-doc__set-component-value">
                  {colorOptions[0]}
                </span>
              ) : null}
            </td>
            <td>
              {sizeOptions.length > 1 ? (
                <ProductOptionSelect
                  value={selection.size}
                  options={sizeOptions}
                  onChange={(value) => onChange(componentIndex, "size", value)}
                />
              ) : sizeOptions.length === 1 ? (
                <span className="contract-doc__set-component-value">
                  {sizeOptions[0]}
                </span>
              ) : null}
            </td>
            <td colSpan={3} />
          </tr>
        );
      })}
    </>
  );
}
