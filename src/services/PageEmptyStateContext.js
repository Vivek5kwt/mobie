import React, { createContext, useContext, useEffect } from "react";

const PageEmptyStateContext = createContext(null);

export function PageEmptyStateProvider({ children, reportEmptyState }) {
  return (
    <PageEmptyStateContext.Provider value={reportEmptyState}>
      {children}
    </PageEmptyStateContext.Provider>
  );
}

export function usePageEmptyStateReporter(key, isEmpty) {
  const reportEmptyState = useContext(PageEmptyStateContext);

  useEffect(() => {
    if (!reportEmptyState || !key || isEmpty === undefined || isEmpty === null) return undefined;
    reportEmptyState(key, Boolean(isEmpty));
    return () => reportEmptyState(key, undefined);
  }, [isEmpty, key, reportEmptyState]);
}
