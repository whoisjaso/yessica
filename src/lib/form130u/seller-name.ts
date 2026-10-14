/**
 * The printed name on the 130-U's seller line.
 *
 * TxDMV's webDEALER review now rejects a dealer's 130-U whose seller line
 * carries the dealership's name alone. It wants the dealership and, in
 * parentheses, the person at the dealership who handled the sale:
 *
 *     Triple J Auto Investment LLC (Jason Obawemimo)
 *
 * A package came back for exactly this on 30 September 2026. The dealership
 * is the seller; the person in parentheses is its agent, and that is the
 * staff member whose signature goes on the same line. Nothing here is
 * Triple J's: the legal name comes from the dealer config and the agent from
 * the team roster, so every dealer on the platform prints its own.
 *
 * The agent's full legal name is used, never a display name or nickname:
 * this is a state title document.
 */
export function sellerPrintedName(
  legalName: string,
  agentName?: string | null,
  fallbackAgent?: string | null,
): string {
  const dealer = legalName.trim();
  const named = (agentName ?? "").replace(/\s+/g, " ").trim();
  const fallback = (fallbackAgent ?? "").replace(/\s+/g, " ").trim();
  const agent = isPersonName(named) ? named : isPersonName(fallback) ? fallback : "";
  if (!agent) return dealer;
  // A roster entry that is itself the dealership would print it twice.
  if (agent.toLowerCase() === dealer.toLowerCase()) return dealer;
  return `${dealer} (${agent})`;
}

/**
 * Words a roster entry uses when it is a role or a shared login, not a person.
 * Production's roster carried "ceo" and "Registration Ops" as full names,
 * which would have printed "Triple J Auto Investment LLC (ceo)" on a state
 * title document.
 */
const NOT_A_PERSON = /\b(ceo|cfo|coo|owner|admin|administrator|manager|ops|operations|operator|registration|sales|office|desk|team|staff|dealer|dealership|ai|bot|agent|test|demo|user|account|llc|inc)\b/i;

/**
 * Whether a roster name is a real person's full name: at least a first and a
 * last name, letters only (with hyphens, apostrophes and periods), and not a
 * role or a shared login.
 */
export function isPersonName(name: string | null | undefined): boolean {
  const value = (name ?? "").trim();
  if (!value || NOT_A_PERSON.test(value)) return false;
  const words = value.split(/\s+/);
  return words.length >= 2 && words.every((word) => /^[\p{L}][\p{L}'.-]*$/u.test(word));
}

/**
 * Key under which the corridor records the agent on a filed document's data,
 * so a reprint months later names the person who handled the sale rather
 * than whoever happens to be signed in when it is printed.
 */
export const SELLER_AGENT_KEY = "sellerAgentName";
