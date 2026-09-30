import { clearObservations } from './marker-observations'

/**
 * Clear the runtime marker sink before anything runs.
 *
 * Without this, a sink left behind by an earlier run would answer for this one,
 * and the runtime-pair check in `verdict-coverage.spec.ts` would report an
 * assertion as executed on the strength of a file written yesterday. That is
 * the same defect the check exists to close, one layer further back.
 */
export default function globalSetup(): void {
  clearObservations()
}
