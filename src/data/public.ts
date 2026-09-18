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

export function publicSalaryValues(size: number): number[] {
  return Array.from({ length: size }, (_, index) => salaryBands[(index * 5) % salaryBands.length]).sort((left, right) => left - right)
}