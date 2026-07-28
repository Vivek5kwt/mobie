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
  if (requestedFit === "stretch" || requestedFit === "fill-stretch") {
    return "stretch";
  }
  // Builder Preview's Scale toggle defaults to "Fill" (CSS object-fit: cover)
  // for every block that uses this helper — "contain" here regardless of the
  // requested value silently forced every Scale=Fill selection back to Fit,
  // making the toggle a no-op in the APK.
  return "cover";
};
