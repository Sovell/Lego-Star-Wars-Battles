import type { UnitTemplate } from "../types";

export function getUnitInitials(template: UnitTemplate): string {
  return template.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

export function getUnitTokenImageUrl(template: UnitTemplate): string | undefined {
  const photoPrefix = "/unit-images/photos/";

  return template.imageUrl?.startsWith(photoPrefix)
    ? template.imageUrl.replace(photoPrefix, "/unit-images/tokens/")
    : undefined;
}
