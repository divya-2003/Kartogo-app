import { createContext, useContext } from "react";

// Kept in a NON-route module so TanStack Router's code-splitter can't create a
// second instance of the context (route files have their components compiled out
// into separate chunks, which would otherwise duplicate a context declared there).
export type SupplierInfo = { id: string; name: string; categories: string[] };

export const SupplierContext = createContext<SupplierInfo | null>(null);
export const useSupplier = () => useContext(SupplierContext);
