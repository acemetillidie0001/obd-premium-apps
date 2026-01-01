/**
 * Type-safe assertion that a value should never be reached.
 * Used to catch missing cases in exhaustive checks at compile time.
 * 
 * @example
 * type Status = "pending" | "completed" | "failed";
 * function handleStatus(status: Status) {
 *   if (status === "pending") return "waiting";
 *   if (status === "completed") return "done";
 *   assertNever(status, "Unhandled status case"); // TypeScript error if status type changes
 * }
 */
export function assertNever(x: never, msg?: string): never {
  throw new Error(msg ?? "Unexpected value: " + String(x));
}

