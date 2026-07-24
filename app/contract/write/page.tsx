"use client";

import { ApiClientError, submitContract } from "@/lib/api-client";
import { getSizeSalePrice, getVariantComponents, isSetProduct, type CatalogProduct } from "@/lib/product-catalog";
import {
  createSetComponentSelections,
  formatSetOptionName,
  resolveComponentPriceForSize,
  type SetComponentSelection,
} from "@/lib/set-product";
import { formatPhoneInput, PHONE_FORM_FIELDS } from "@/lib/phone";
import type { ContractFormValues, ProductRow } from "@/lib/validation/contract";
import {
  createEmptyProductRow,
  PRODUCT_ROW_COUNT,
  validateContractForm,
} from "@/lib/validation/contract";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../contract.css";
import ContractForm, { createInitialContractFormValues } from "./ContractForm";

export default function ContractWritePage() {
  const router = useRouter();
  const [values, setValues] = useState<ContractFormValues>(
    createInitialContractFormValues,
  );
  const [productSelections, setProductSelections] = useState<
    Record<number, CatalogProduct | null>
  >({});
  const [setComponentSelections, setSetComponentSelections] = useState<
    Record<number, SetComponentSelection[]>
  >({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearFieldError(field: string) {
    if (!errors[field]) {
      return;
    }

    setErrors((current) => {
      const next = { ...current };
      delete next[field];
      return next;
    });
  }

  function handleChange(
    field: keyof ContractFormValues,
    value: string | boolean | null,
  ) {
    const nextValue =
      typeof value === "string" && PHONE_FORM_FIELDS.has(field)
        ? formatPhoneInput(value)
        : value;

    setValues((current) => {
      const next = { ...current, [field]: nextValue };

      if (field === "recipientSameAsBuyer" && value === true) {
        next.recipientName = "";
        next.recipientPhone = "";
      }

      if (field === "paymentMethod" && value === "card") {
        next.cashReceiptType = "";
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
        next.taxInvoiceRequested = false;
        next.taxInvoiceEmail = "";
      }

      if (field === "cashReceiptType" && value) {
        next.taxInvoiceRequested = false;
        next.taxInvoiceEmail = "";
      }

      if (field === "cashReceiptType" && !value) {
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
      }

      if (field === "taxInvoiceRequested" && value === true) {
        next.cashReceiptType = "";
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
      }

      if (
        field === "writtenDateYear" ||
        field === "writtenDateMonth" ||
        field === "writtenDateDay"
      ) {
        next.agreementDateYear = next.writtenDateYear;
        next.agreementDateMonth = next.writtenDateMonth;
        next.agreementDateDay = next.writtenDateDay;
      }

      if (field === "buyerName" && typeof nextValue === "string") {
        next.signatureName = nextValue;
      }

      return next;
    });

    clearFieldError(field);

    if (
      field === "writtenDateYear" ||
      field === "writtenDateMonth" ||
      field === "writtenDateDay"
    ) {
      clearFieldError("agreementDateYear");
      clearFieldError("agreementDateMonth");
      clearFieldError("agreementDateDay");
    }

    if (field === "buyerName") {
      clearFieldError("signatureName");
    }
  }

  function handleProductChange(
    index: number,
    field: keyof ProductRow,
    value: string,
  ) {
    if (field === "name") {
      setProductSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
      setSetComponentSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
    }

    setValues((current) => ({
      ...current,
      products: current.products.map((product, productIndex) => {
        if (productIndex !== index) {
          return product;
        }

        if (field === "name") {
          return {
            ...product,
            name: value,
            color: "",
            size: "",
            remarks: "",
          };
        }

        if (field === "color") {
          const selected = productSelections[index];
          const salePrice = selected
            ? getSizeSalePrice(selected, value) ?? selected.salePrice
            : null;
          const components = selected ? getVariantComponents(selected, value) : [];

          if (components.length) {
            setSetComponentSelections((current) => ({
              ...current,
              [index]: createSetComponentSelections(components),
            }));
          } else {
            setSetComponentSelections((current) => {
              if (!current[index]) {
                return current;
              }

              const next = { ...current };
              delete next[index];
              return next;
            });
          }

          return {
            ...product,
            color: value,
            size: "",
            ...(salePrice != null ? { unitPrice: String(salePrice) } : {}),
          };
        }

        if (field === "size") {
          const selected = productSelections[index];
          const salePrice = selected
            ? getSizeSalePrice(selected, value) ?? selected.salePrice
            : null;
          const components = selected ? getVariantComponents(selected, value) : [];

          if (components.length) {
            setSetComponentSelections((current) => ({
              ...current,
              [index]: createSetComponentSelections(components),
            }));
          }

          return {
            ...product,
            size: value,
            ...(salePrice != null ? { unitPrice: String(salePrice) } : {}),
          };
        }

        return { ...product, [field]: value };
      }),
    }));

    clearFieldError("products");
    clearFieldError(`products.${index}.${field}`);
  }

  function handleSetComponentChange(
    index: number,
    componentIndex: number,
    field: keyof SetComponentSelection,
    value: string,
  ) {
    const selectedProduct = productSelections[index];
    const row = values.products[index];
    const variantName = row?.color || row?.size || "";
    const components = selectedProduct
      ? getVariantComponents(selectedProduct, variantName)
      : [];

    if (!components.length) {
      return;
    }
    const nextSelections = [
      ...(setComponentSelections[index] ??
        createSetComponentSelections(components)),
    ];
    nextSelections[componentIndex] = {
      ...nextSelections[componentIndex],
      [field]: value,
      ...(field === "size"
        ? { unitPrice: resolveComponentPriceForSize(components[componentIndex], value) }
        : {}),
    };

    setSetComponentSelections((current) => ({
      ...current,
      [index]: nextSelections,
    }));

    setValues((current) => ({
      ...current,
      products: current.products.map((row, productIndex) =>
        productIndex === index
          ? {
              ...row,
              color: selectedProduct?.components?.length
                ? formatSetOptionName(components, nextSelections)
                : row.color,
            }
          : row,
      ),
    }));
  }

  function handleProductSelect(index: number, product: CatalogProduct) {
    setProductSelections((current) => ({
      ...current,
      [index]: product,
    }));

    const isSet = isSetProduct(product);
    const componentSelections = isSet
      ? createSetComponentSelections(product.components ?? [])
      : [];

    if (isSet) {
      setSetComponentSelections((current) => ({
        ...current,
        [index]: componentSelections,
      }));
    } else {
      setSetComponentSelections((current) => {
        if (!current[index]) {
          return current;
        }

        const next = { ...current };
        delete next[index];
        return next;
      });
    }

    setValues((current) => ({
      ...current,
      products: current.products.map((row, productIndex) =>
        productIndex === index
          ? {
              ...row,
              name: product.productName,
              color: isSet
                ? formatSetOptionName(
                    product.components ?? [],
                    componentSelections,
                  )
                : "",
              size: "",
              quantity: row.quantity || "1",
              unitPrice: String(product.salePrice),
              remarks: "",
            }
          : row,
      ),
    }));

    clearFieldError("products");
    clearFieldError(`products.${index}.name`);
    clearFieldError(`products.${index}.unitPrice`);
  }

  function handleAddProductRow() {
    setValues((current) => ({
      ...current,
      products: [...current.products, createEmptyProductRow()],
    }));
  }

  function handleRemoveLastProductRow() {
    setValues((current) => {
      if (current.products.length <= PRODUCT_ROW_COUNT) {
        return current;
      }

      return {
        ...current,
        products: current.products.slice(0, -1),
      };
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");

    const validation = validateContractForm(values);

    if (!validation.valid) {
      setErrors(validation.errors);
      return;
    }

    setErrors({});
    setIsSubmitting(true);

    try {
      const result = await submitContract(validation.data);
      router.push(
        `/contract/complete?contractNumber=${encodeURIComponent(result.contractNumber)}&viewToken=${encodeURIComponent(result.viewToken)}`,
      );
    } catch (error) {
      if (error instanceof ApiClientError) {
        setFormError(error.message);

        if (error.errors) {
          setErrors(error.errors);
        }
      } else {
        setFormError("서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요.");
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="app-page">
      <div className="app-container app-container--doc">
        <Link href="/contract/notice" className="app-back-link">
          ← 안내로 돌아가기
        </Link>

        <div className="contract-doc-flow">
          {formError ? (
            <p className="app-alert app-alert--error contract-doc-flow__alert">
              {formError}
            </p>
          ) : null}

          <ContractForm
            values={values}
            errors={errors}
            isSubmitting={isSubmitting}
            productSelections={productSelections}
            setComponentSelections={setComponentSelections}
            onChange={handleChange}
            onProductChange={handleProductChange}
            onProductSelect={handleProductSelect}
            onAddProductRow={handleAddProductRow}
            onRemoveLastProductRow={handleRemoveLastProductRow}
            onSetComponentChange={handleSetComponentChange}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </main>
  );
}
