"use client";

import { ApiClientError, submitContract } from "@/lib/api-client";
import type { ContractFormValues, ProductRow } from "@/lib/validation/contract";
import { validateContractForm } from "@/lib/validation/contract";
import { useRouter } from "next/navigation";
import { useState } from "react";
import "../contract.css";
import ContractForm, { createInitialContractFormValues } from "./ContractForm";

export default function ContractWritePage() {
  const router = useRouter();
  const [values, setValues] = useState<ContractFormValues>(
    createInitialContractFormValues,
  );
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
    setValues((current) => {
      const next = { ...current, [field]: value };

      if (field === "recipientSameAsBuyer" && value === true) {
        next.recipientName = "";
        next.recipientPhone = "";
        next.recipientAddress = "";
      }

      if (field === "paymentMethod" && value === "card") {
        next.cashReceiptType = "";
        next.cashReceiptPhone = "";
        next.cashReceiptBusinessNumber = "";
        next.taxInvoiceRequested = false;
        next.taxInvoiceEmail = "";
      }

      return next;
    });

    clearFieldError(field);
  }

  function handleProductChange(
    index: number,
    field: keyof ProductRow,
    value: string,
  ) {
    setValues((current) => ({
      ...current,
      products: current.products.map((product, productIndex) =>
        productIndex === index ? { ...product, [field]: value } : product,
      ),
    }));

    clearFieldError("products");
    clearFieldError(`products.${index}.${field}`);
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
        `/contract/complete?contractNumber=${encodeURIComponent(result.contractNumber)}`,
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
    <main className="contract-page">
      <div className="contract-page__container">
        {formError ? (
          <p className="contract-page__form-error">{formError}</p>
        ) : null}

        <ContractForm
          values={values}
          errors={errors}
          isSubmitting={isSubmitting}
          onChange={handleChange}
          onProductChange={handleProductChange}
          onSubmit={handleSubmit}
        />
      </div>
    </main>
  );
}
