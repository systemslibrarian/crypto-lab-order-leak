const departments = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']
const salaryBands = [31, 34, 42, 55, 73, 101, 149, 233]
export type AuxiliaryPopulation = 'matching' | 'shifted' | 'mismatch'

export function publicDepartmentDistribution(size: number, population: AuxiliaryPopulation = 'matching'): Record<string, number> {
  const labels = [...new Set(departments)]
  const counts = Object.fromEntries(labels.map((label) => [label, 0]))
  for (let index = 0; index < size; index++) counts[departments[index % departments.length]]++
  if (population === 'shifted') {
    const transfer = Math.floor(size * 0.08)
    counts.Support -= transfer
    counts.Sales += transfer
  }
  if (population === 'mismatch') delete counts.Sales
  return counts
}

export function publicAgeValues(size: number): number[] {
  return Array.from({ length: size }, (_, index) => 20 + (index % 46)).sort((left, right) => left - right)
}

export function publicSalaryValues(size: number, population: AuxiliaryPopulation = 'matching'): number[] {
  const values = Array.from({ length: size }, (_, index) => salaryBands[(index * 5) % salaryBands.length]).sort((left, right) => left - right)
  if (population === 'shifted') {
    const transfer = Math.min(Math.floor(size * 0.08), values.filter((value) => value === salaryBands[0]).length - 1)
    values.splice(0, transfer)
    values.push(...Array.from({ length: transfer }, () => salaryBands.at(-1)!))
  }
  return population === 'mismatch' ? values.filter((value) => value !== salaryBands.at(-1)) : values
}