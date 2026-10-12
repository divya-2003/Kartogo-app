const HOME_BACK_SECTIONS = new Set(["/categories", "/search", "/print"]);

export function backMustReturnHome(currentPath: string, nextPath: string, action: string): boolean {
  return HOME_BACK_SECTIONS.has(currentPath) && nextPath !== "/" && (action === "BACK" || action === "GO");
}