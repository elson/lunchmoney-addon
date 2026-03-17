import type { LunchmoneyAccount } from "./lunchmoney";
import type { AccountMapping } from "../types";

export function filterAccounts(
  lmAccounts: LunchmoneyAccount[],
  search: string,
  filterTab: "all" | "linked" | "skipped",
  draft: AccountMapping,
): LunchmoneyAccount[] {
  const query = search.trim().toLowerCase();
  return lmAccounts.filter((acc) => {
    if (query) {
      const haystack = [acc.name, acc.display_name ?? "", acc.institution_name ?? ""]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(query)) return false;
    }
    if (filterTab === "linked") {
      return draft[acc.id]?.type === "existing" || draft[acc.id]?.type === "create";
    }
    if (filterTab === "skipped") {
      return !draft[acc.id] || draft[acc.id]?.type === "ignore";
    }
    return true;
  });
}
