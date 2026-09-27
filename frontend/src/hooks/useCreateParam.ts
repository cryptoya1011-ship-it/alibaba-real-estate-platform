import { useCallback } from "react";
import { useSearchParams } from "react-router-dom";

/** `?new=1` opens a page's create dialog (used by dashboard quick actions + command palette). */
export function useCreateParam(): [boolean, (open: boolean) => void] {
  const [params, setParams] = useSearchParams();
  const open = params.get("new") === "1";
  const setOpen = useCallback(
    (next: boolean) => {
      setParams(
        (prev) => {
          const p = new URLSearchParams(prev);
          if (next) p.set("new", "1");
          else p.delete("new");
          return p;
        },
        { replace: true },
      );
    },
    [setParams],
  );
  return [open, setOpen];
}
