export function generateRepCode(prefix: 'DEV' | 'SAL') {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `${prefix}-${digits}`
}
