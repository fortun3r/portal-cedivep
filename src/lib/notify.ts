/**
 * How the login code reaches the clinic.
 *
 * Only one channel exists today: the server console (and, in demo mode, the
 * screen). Sending it over WhatsApp for real needs a WhatsApp Business API
 * account (Meta) or a provider (Twilio, etc.) — a lab decision, with a cost per
 * message. When it exists, add another Notifier; nothing else changes.
 */
import { maskContact } from './contact'
import type { Clinic } from './types'

export interface Notifier {
  name: string
  send(key: string, code: string, clinics: Clinic[]): Promise<void>
}

export const consoleNotifier: Notifier = {
  name: 'console',
  async send(key, code, clinics) {
    const who = clinics.map((c) => `${c.code} ${c.name}`).join(', ')
    console.log(`[login] code ${code} for ${maskContact(key)} → ${who}`)
  },
}
