'use client'

import { useState } from 'react'
import { CALENDLY, CONTACT_EMAIL } from '../../lib/site'

export function ContactForm() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [message, setMessage] = useState('')
  const [sent, setSent] = useState(false)

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const subject = encodeURIComponent(`Margen inquiry from ${name.trim()}`)
    const body = encodeURIComponent(
      `Name: ${name.trim()}\nEmail: ${email.trim()}\n\n${message.trim()}`,
    )
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`
    setSent(true)
  }

  if (sent) {
    return (
      <div className="contact-success">
        <p>Thanks for reaching out. Your email client should open shortly. We will get back to you within 24 hours.</p>
        <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
          Or book a free audit
        </a>
      </div>
    )
  }

  return (
    <form className="contact-form" onSubmit={handleSubmit}>
      <label className="form-field">
        <span className="form-label">Name</span>
        <input
          className="form-input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span className="form-label">Email</span>
        <input
          type="email"
          className="form-input"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>
      <label className="form-field">
        <span className="form-label">Message</span>
        <textarea
          className="form-input form-textarea"
          rows={5}
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
      </label>
      <button type="submit" className="btn btn--accent">
        Send message
      </button>
    </form>
  )
}
