export const TABLET_BREAKPOINT = 768;

const toFiniteNumber = (value, fallback = 0) => {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

export const isTabletWidth = (width) => toFiniteNumber(width) >= TABLET_BREAKPOINT;

export const getResponsiveColumns = ({
  screenWidth,
  requestedColumns = 2,
  horizontalPadding = 0,
  gap = 0,
  minCardWidth = 180,
  maxColumns = 6,
}) => {
  const width = Math.max(1, toFiniteNumber(screenWidth, 1));
  const requested = Math.max(1, Math.round(toFiniteNumber(requestedColumns, 1)));

  if (!isTabletWidth(width)) return requested;

  const safeGap = Math.max(0, toFiniteNumber(gap, 0));
  const availableWidth = Math.max(1, width - Math.max(0, toFiniteNumber(horizontalPadding, 0)));
  const autoColumns = Math.floor((availableWidth + safeGap) / (Math.max(1, minCardWidth) + safeGap));

  return Math.max(1, Math.min(Math.max(requested, autoColumns), maxColumns));
};
