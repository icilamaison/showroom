"use client";

import { formatAmount, formatDigits, lineAmount } from "@/lib/contract-amount";
import { getSizeOptionName, type SetComponent } from "@/lib/product-catalog";
import {
  resolveComponentBaseSalePrice,
  resolveComponentSizeOptions,
  type SetComponentSelection,
} from "@/lib/set-product";
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
        const selection = selections[componentIndex] ?? {
          color: "",
          size: "",
          quantity: "",
          unitPrice: "",
        };
        const colorOptions = (component.colors ?? []).filter(
          (name) => !component.soldOutColors?.includes(name),
        );
        const sizeOptions = resolveComponentSizeOptions(component).filter(
          (option) => !component.soldOutSizes?.includes(getSizeOptionName(option)),
        );
        const baseSalePrice = resolveComponentBaseSalePrice(component);
        const amount = lineAmount(selection);

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
                  baseSalePrice={baseSalePrice}
                  onChange={(value) => onChange(componentIndex, "size", value)}
                />
              ) : sizeOptions.length === 1 ? (
                <span className="contract-doc__set-component-value">
                  {getSizeOptionName(sizeOptions[0])}
                </span>
              ) : null}
            </td>
            <td>
              <span className="contract-doc__set-component-value contract-doc__set-component-value--center">
                {selection.quantity}
              </span>
            </td>
            <td>
              <span className="contract-doc__set-component-value contract-doc__set-component-value--right">
                {formatDigits(selection.unitPrice)}
              </span>
            </td>
            <td>
              <span className="contract-doc__set-component-value contract-doc__set-component-value--right">
                {amount > 0 ? formatAmount(amount) : ""}
              </span>
            </td>
          </tr>
        );
      })}
    </>
  );
}
