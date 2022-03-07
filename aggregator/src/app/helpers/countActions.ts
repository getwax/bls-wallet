import { Bundle } from "../../../deps.ts";
import plus from "./plus.ts";

export default function countActions(bundle: Bundle) {
  return bundle.operations.map((op) => op.actions.length).reduce(plus, 0);
}
