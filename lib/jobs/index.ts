// Importing this module registers every handler. Add new modules here --
// that is the entire cost of teaching Outpost a new kind of scheduled work.
import "./handlers/email-send";

export { tick, type TickResult } from "./runner";
export { register, PermanentError, registeredKinds } from "./registry";
