import type { SetComponent } from "./product-catalog";

export type SetComponentSelection = {
  color: string;
  size: string;
};

export function createSetComponentSelections(
  components: SetComponent[],
): SetComponentSelection[] {
  return components.map((component) => ({
    color: component.colors?.length === 1 ? component.colors[0] : "",
    size: component.sizes?.length === 1 ? component.sizes[0] : "",
  }));
}

export function formatSetOptionName(
  components: SetComponent[],
  selections: SetComponentSelection[],
): string {
  const options = components
    .map((_, index) => {
      const selection = selections[index];
      return selection?.color || selection?.size || "";
    })
    .filter(Boolean);

  if (options.length === 0) {
    return "";
  }

  return `COLOR=${options.join(" + ")}`;
}

export function parseSetColorOptions(color: string): string[] {
  if (!color.trim().startsWith("COLOR=")) {
    return [];
  }

  return color
    .trim()
    .slice(6)
    .split(" + ")
    .map((option) => option.trim())
    .filter(Boolean);
}

export function buildSetSelectionsFromColor(
  components: SetComponent[],
  color: string,
): SetComponentSelection[] {
  const options = parseSetColorOptions(color);

  return components.map((component, index) => {
    const option = options[index] ?? "";

    if (component.colors?.length) {
      return { color: option, size: "" };
    }

    if (component.sizes?.length) {
      return { color: "", size: option };
    }

    return { color: option, size: "" };
  });
}
