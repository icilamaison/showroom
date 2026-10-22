"use client";

import { formatDigits } from "@/lib/contract-amount";
import {
  splitColorSize,
  withColorOnlyLabels,
  withSoldOutLabels,
  type SetComponent,
} from "@/lib/product-catalog";
import {
  resolveComponentBaseSalePrice,
  resolveComponentColorOptions,
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
        const baseSalePrice = resolveComponentBaseSalePrice(component);
        const colorOptions = withColorOnlyLabels(
          withSoldOutLabels(
            resolveComponentColorOptions(component),
            component.soldOutColors,
          ),
        );
        const sizeOptions = withSoldOutLabels(
          resolveComponentSizeOptions(component),
          component.soldOutSizes,
          baseSalePrice,
        );
        // 구성품도 "베이지 SS 160X210"처럼 색상·사이즈가 한 옵션이면 사이즈는 사이즈 칸에 따로 보여준다
        const selectedColor =
          selection.color ||
          (colorOptions.length === 1 ? colorOptions[0].value : "");
        const combinedSize = sizeOptions.length
          ? ""
          : splitColorSize(selectedColor)?.size ?? "";

        return (
          <tr
            key={`${rowIndex}-component-${componentIndex}`}
            className="contract-doc__set-component-row"
          >
            <td />
            <td className="contract-doc__set-component-name">{component.name}</td>
            <td />
            <td>
              {colorOptions.length > 1 ? (
                <ProductOptionSelect
                  value={selection.color}
                  options={colorOptions}
                  onChange={(value) => onChange(componentIndex, "color", value)}
                />
              ) : colorOptions.length === 1 ? (
                <span className="contract-doc__set-component-value">
                  {colorOptions[0].label}
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
                  {sizeOptions[0].label}
                </span>
              ) : combinedSize ? (
                <span className="contract-doc__set-component-value">
                  {combinedSize}
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
            <td />
          </tr>
        );
      })}
    </>
  );
}
