import { useMemo } from "react";
import { api } from "@/api";
import { useApi } from "@/hooks/useApi";

/** Properties + persons for select inputs and id→name lookups (visits, deals). */
export function useLookups() {
  const props = useApi(() => api.listProperties({ limit: 100 }), [], { keys: ["properties"] });
  const persons = useApi(() => api.listPersons({ limit: 100 }), [], { keys: ["persons"] });
  const propMap = useMemo(() => new Map((props.data ?? []).map((p) => [p.id, p])), [props.data]);
  const personMap = useMemo(() => new Map((persons.data ?? []).map((p) => [p.id, p])), [persons.data]);
  return { properties: props.data ?? [], persons: persons.data ?? [], propMap, personMap, loading: props.loading || persons.loading };
}
