const CALENDLY = 'https://calendly.com/davynaidu/30min'

export default function QuoteSuccessPage() {
  return (
    <div className="page success-page">
      <main className="success-main">
        <img src="/margen-logo.png" alt="Margen" className="success-logo" height={80} />
        <h1 className="success-headline">We got you.</h1>
        <p className="success-subheadline">We will reach out to you shortly.</p>
        <p className="success-note">
          Expect a call from (808) 379-7937 within 24 hours. In the meantime feel free to book a time that works for
          you.
        </p>
        <a href={CALENDLY} target="_blank" rel="noopener noreferrer" className="btn btn--accent">
          Book your audit now
        </a>
      </main>
      <footer className="success-footer">Margen · Allen, Texas · trymargen.com</footer>
    </div>
  )
}
