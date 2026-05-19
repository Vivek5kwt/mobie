const unwrapImageFitValue = (value) => {
  if (value === undefined || value === null) return "";
  if (typeof value === "object") {
    if (value.value !== undefined) return unwrapImageFitValue(value.value);
    if (value.const !== undefined) return unwrapImageFitValue(value.const);
    if (value.properties !== undefined) return unwrapImageFitValue(value.properties);
  }
  return String(value).trim().toLowerCase();
};

export const resolveProductImageResizeMode = (...values) => {
  const requestedFit = values.map(unwrapImageFitValue).find(Boolean);
  if (requestedFit === "contain" || requestedFit === "fit" || requestedFit === "scale-down") {
    return "contain";
  }
  return "contain";
};
