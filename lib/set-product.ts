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
