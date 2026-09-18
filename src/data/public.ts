const departments = ['Support', 'Support', 'Support', 'Finance', 'Finance', 'Research', 'Research', 'Sales']
const salaryBands = [31, 34, 42, 55, 73, 101, 149, 233]

export function publicDepartmentDistribution(size: number, shifted = false): Record<string, number> {
  const labels = shifted ? ['Support', 'Finance', 'Research', 'Sales'] : [...new Set(departments)]
  const counts = Object.fromEntries(labels.map((label) => [label, 0]))
  for (let index = 0; index < size; index++) counts[departments[index % departments.length]]++
  if (shifted) {
    const transfer = Math.floor(size * 0.08)
    counts.Support -= transfer
    counts.Sales += transfer
  }
  return counts
}

export function publicAgeValues(size: number): number[] {
  return Array.from({ length: size }, (_, index) => 20 + (index % 46)).sort((left, right) => left - right)
}

export function publicSalaryValues(size: number, shifted = false): number[] {
  const values = Array.from({ length: size }, (_, index) => salaryBands[(index * 5) % salaryBands.length]).sort((left, right) => left - right)
  if (shifted) {
    const transfer = Math.min(Math.floor(size * 0.08), values.filter((value) => value === salaryBands[0]).length - 1)
    values.splice(0, transfer)
    values.push(...Array.from({ length: transfer }, () => salaryBands.at(-1)!))
  }
  return values
}