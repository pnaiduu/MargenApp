export const DEMO_OWNER_EMAIL = 'davynaidu@gmail.com'

export function isDemoOwnerEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === DEMO_OWNER_EMAIL
}
