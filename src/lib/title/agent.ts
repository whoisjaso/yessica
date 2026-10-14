/**
 * The title agent who does the paperwork, said once.
 *
 * The owner: she is the agent on every sale she files, "because obviously
 * she's doing the paperwork for the dealer". So her name prints in the
 * parentheses on the 130-U seller line ("Dealer LLC (Her Name)", which
 * webDEALER review requires) and is recorded as who filed, unless a dealer
 * names someone else. Her full legal name, as on her ID: this is a state
 * title document. Set NEXT_PUBLIC_AGENT_NAME in Vercel to change it without
 * a code change.
 */
export const AGENT_NAME = (process.env.NEXT_PUBLIC_AGENT_NAME || "Yessica Patino").trim();

/** Who signs for this dealer: the dealer's own choice, else her. */
export function signerFor(dealer: { agentName?: string | null } | null | undefined): string {
  return dealer?.agentName?.trim() || AGENT_NAME;
}
