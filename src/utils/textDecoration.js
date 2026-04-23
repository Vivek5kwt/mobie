export const normalizeTextDecorationLine = (value, fallback = "none") => {
  if (value === undefined || value === null || value === "") return fallback;

  if (typeof value === "string") {
    const tokens = value
      .trim()
      .toLowerCase()
      .split(/\s+/)
      .filter(Boolean);

    if (!tokens.length) return fallback;

    const parts = [];
    if (tokens.includes("underline")) parts.push("underline");
    if (tokens.includes("line-through")) parts.push("line-through");

    if (parts.length) return parts.join(" ");
    if (tokens.includes("none")) return "none";
  }

  return fallback;
};

export const resolveTextDecorationLine = ({
  underline,
  strikethrough,
  fallback = "none",
} = {}) => {
  const parts = [];

  if (underline) parts.push("underline");
  if (strikethrough) parts.push("line-through");

  return parts.length ? parts.join(" ") : fallback;
};
