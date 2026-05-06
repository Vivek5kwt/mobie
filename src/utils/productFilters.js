const cleanText = (value) => String(value ?? "").trim();

const addUniqueOption = (bucket, option) => {
  const label = cleanText(option?.label);
  const value = cleanText(option?.value ?? label);
  const type = cleanText(option?.type || "keyword") || "keyword";
  if (!label || !value) return;
  const key = `${type}:${value}`.toLowerCase();
  if (bucket.has(key)) return;
  bucket.set(key, {
    id: key,
    label,
    title: label,
    type,
    value,
  });
};

export const buildProductFilterOptions = (products = []) => {
  const options = new Map();

  products.forEach((product) => {
    addUniqueOption(options, {
      type: "vendor",
      label: product?.vendor,
      value: product?.vendor,
    });
    addUniqueOption(options, {
      type: "productType",
      label: product?.productType,
      value: product?.productType,
    });

    const tags = Array.isArray(product?.tags) ? product.tags : [];
    tags.forEach((tag) => {
      addUniqueOption(options, { type: "tag", label: tag, value: tag });
    });

    const productOptions = Array.isArray(product?.options) ? product.options : [];
    productOptions.forEach((option) => {
      const name = cleanText(option?.name);
      const values = Array.isArray(option?.values) ? option.values : [];
      values.forEach((value) => {
        const text = cleanText(value);
        addUniqueOption(options, {
          type: "option",
          label: name ? `${name}: ${text}` : text,
          value: text,
        });
      });
    });
  });

  return Array.from(options.values()).slice(0, 40);
};

export const productMatchesFilter = (product, filter) => {
  if (!filter) return true;
  const label = cleanText(filter?.label ?? filter?.title ?? filter);
  const value = cleanText(filter?.value ?? label).toLowerCase();
  const type = cleanText(filter?.type || "keyword");
  if (!value) return true;

  if (type === "vendor") {
    return cleanText(product?.vendor).toLowerCase() === value;
  }

  if (type === "productType") {
    return cleanText(product?.productType).toLowerCase() === value;
  }

  if (type === "tag") {
    return (product?.tags || []).some((tag) => cleanText(tag).toLowerCase() === value);
  }

  if (type === "option") {
    return (product?.options || []).some((option) =>
      (option?.values || []).some((optionValue) => cleanText(optionValue).toLowerCase() === value)
    );
  }

  const haystack = [
    product?.title,
    product?.vendor,
    product?.productType,
    ...(product?.tags || []),
    ...(product?.options || []).flatMap((option) => [option?.name, ...(option?.values || [])]),
  ]
    .map((part) => cleanText(part).toLowerCase())
    .filter(Boolean);

  return haystack.some((part) => part.includes(value));
};
