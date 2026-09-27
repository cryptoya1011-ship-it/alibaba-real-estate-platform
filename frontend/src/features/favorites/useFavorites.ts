import { useCallback, useMemo } from "react";
import { toast } from "sonner";
import { api } from "@/api";
import { invalidate, useApi } from "@/hooks/useApi";
import type { Favorite } from "@/lib/types";
import { errorMessage } from "@/components/ui/states";

/** Favorites with optimistic add/remove (rolls back on failure). */
export function useFavorites() {
  const state = useApi(() => api.listFavorites(), [], { keys: ["favorites"] });
  const { data, setData } = state;
  const ids = useMemo(() => new Set((data ?? []).map((f) => f.property_id)), [data]);

  const toggle = useCallback(
    async (propertyId: number) => {
      const was = ids.has(propertyId);
      const prev = data ?? [];
      setData(
        was
          ? prev.filter((f) => f.property_id !== propertyId)
          : [...prev, { id: -Date.now(), property_id: propertyId } as Favorite],
      );
      try {
        if (was) await api.removeFavorite(propertyId);
        else await api.addFavorite(propertyId);
        toast.success(was ? "از علاقه‌مندی‌ها حذف شد" : "به علاقه‌مندی‌ها اضافه شد");
        invalidate("favorites");
      } catch (err) {
        setData(prev);
        toast.error(errorMessage(err, "تغییر علاقه‌مندی ناموفق بود"));
      }
    },
    [ids, data, setData],
  );

  return { ...state, ids, toggle };
}
