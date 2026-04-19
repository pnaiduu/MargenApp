import { Link } from 'react-router-dom'
import { MargenLogo } from '../components/branding/MargenLogo'
import { SpaLink } from '../components/SpaLink'
import { useAuth } from '../contexts/useAuth'
import { PRICING_PLANS } from '../lib/plans'

const CALENDLY_AUDIT = 'https://calendly.com/davynaidu/30min'

export function LandingPage() {
  const { user } = useAuth()

  return (
    <div className="min-h-dvh bg-[#fafaf8] text-[#111111]">
      <header className="sticky top-0 z-20 border-b border-[#ebebeb] bg-[#fafaf8]">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-6 py-3 sm:h-14 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8 sm:py-0">
          <Link
            to="/"
            className="shrink-0 text-lg font-semibold tracking-tight text-[#111111] sm:text-xl"
            aria-label="Margen home"
          >
            Margen
          </Link>
          <div className="flex flex-wrap items-center justify-start gap-2 sm:justify-end sm:gap-3">
            <a
              href={CALENDLY_AUDIT}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex rounded-md border border-[#111111] bg-transparent px-3 py-2 text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5"
            >
              Get my free audit
            </a>
            {user ? (
              <Link
                to="/dashboard"
                className="margen-btn-primary-solid inline-flex px-4 py-2 text-sm"
              >
                Dashboard
              </Link>
            ) : (
              <>
                <SpaLink
                  to="/login"
                  state={{ intent: 'sign-in-only' }}
                  className="inline-flex items-center rounded-md px-3 py-2 text-sm font-medium text-[#555555] underline-offset-4 ring-1 ring-inset ring-[#ebebeb] transition hover:bg-[#f5f5f5] hover:text-[#111111]"
                >
                  Sign in
                </SpaLink>
                <Link
                  to="/signup"
                  className="margen-btn-primary-solid inline-flex px-3 py-2 text-sm"
                >
                  Create account
                </Link>
              </>
            )}
          </div>
        </div>
      </header>

      <main>
        <section className="border-b border-[#ebebeb] px-6 py-16 sm:px-8 sm:py-24">
          <div className="mx-auto max-w-3xl text-center">
            <p className="text-sm font-medium leading-snug text-[#555555] sm:text-base">
              AI operations platform for home service companies
            </p>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight text-[#111111] sm:text-4xl md:text-[2.5rem] md:leading-tight">
              Your business is losing money in more ways than one
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-base leading-relaxed text-[#555555] sm:text-lg">
              Margen is an all-in-one AI platform that answers your calls, dispatches your technicians, tracks your team,
              and shows you exactly where revenue is slipping through the cracks — all in one place.
            </p>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row sm:flex-wrap sm:gap-4">
              {user ? (
                <Link
                  to="/dashboard"
                  className="margen-btn-primary-solid inline-flex w-full justify-center px-6 py-3 text-center text-sm sm:w-auto"
                >
                  Go to dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/signup"
                    className="margen-btn-primary-solid inline-flex w-full justify-center px-6 py-3 text-center text-sm sm:w-auto"
                  >
                    Create account
                  </Link>
                  <SpaLink
                    to="/login"
                    state={{ from: '/pricing' }}
                    className="inline-flex w-full justify-center rounded-md border border-[#111111] bg-transparent px-6 py-3 text-center text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5 sm:w-auto"
                  >
                    Sign in to choose a plan
                  </SpaLink>
                </>
              )}
              <a
                href="#features"
                className="inline-flex w-full justify-center rounded-md border border-[#111111] bg-transparent px-6 py-3 text-center text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5 sm:w-auto"
              >
                See how it works
              </a>
            </div>
          </div>
        </section>

        <section className="border-b border-[#ebebeb] bg-[#f2f2ec] px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto grid max-w-5xl gap-6 sm:grid-cols-3">
            {[
              { stat: '62%', label: 'of calls go unanswered every day' },
              { stat: '$180K+', label: 'lost annually to operational inefficiency' },
              { stat: '3 hours', label: 'average time wasted per technician per day' },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-xl border border-[#ebebeb] bg-white px-6 py-8 text-center transition hover:border-[#cccccc]"
              >
                <p className="text-3xl font-semibold tabular-nums text-[#111111] sm:text-4xl">{item.stat}</p>
                <p className="mt-3 text-sm leading-snug text-[#555555]">{item.label}</p>
              </div>
            ))}
          </div>
        </section>

        <section id="features" className="scroll-mt-16 border-b border-[#ebebeb] bg-[#fafaf8] px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <h2 className="section-title text-center">Why Margen</h2>
            <div className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
              {[
                {
                  title: 'AI call handling',
                  body: 'Your calls are answered 24/7. Every lead qualified, every job booked — even at 11pm. No more missed revenue from unanswered phones.',
                },
                {
                  title: 'Smart dispatching',
                  body: 'The right technician gets the right job automatically. Assigned by skill, location, and availability. No more scheduling chaos.',
                },
                {
                  title: 'Live team tracking',
                  body: 'See every technician on a live map in real time. Know who is available, who is busy, and who is running late — instantly.',
                },
                {
                  title: 'Revenue intelligence',
                  body: 'See exactly what your business is losing and where. Missed calls, idle technicians, unassigned jobs — all tracked and measured.',
                },
              ].map((f) => (
                <div
                  key={f.title}
                  className="rounded-xl border border-[#ebebeb] bg-white p-6 transition hover:-translate-y-px hover:border-[#cccccc] sm:p-8"
                >
                  <h3 className="card-title">{f.title}</h3>
                  <p className="mt-3 text-sm leading-relaxed text-[#555555]">{f.body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="border-b border-[#ebebeb] bg-[#fafaf8] px-6 py-14 sm:px-8 sm:py-20">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <h2 className="section-title">Choose a plan</h2>
              <p className="mx-auto mt-3 max-w-xl text-sm leading-relaxed text-[#555555]">
                Compare tiers here. Sign in to open the full plans page (monthly or annual) and complete checkout.
              </p>
            </div>
            <div className="mt-10 grid gap-6 md:grid-cols-3">
              {PRICING_PLANS.map((plan) => (
                <div
                  key={plan.id}
                  className={[
                    'flex flex-col rounded-xl border bg-white p-6 transition hover:-translate-y-px hover:border-[#cccccc]',
                    plan.popular ? 'border-[#111111]' : 'border-[#ebebeb]',
                  ].join(' ')}
                >
                  <div className="min-h-[1.25rem]">
                    {plan.popular ? (
                      <p className="label-caps text-[#111111]">Most popular</p>
                    ) : null}
                  </div>
                  <h3 className="mt-2 card-title text-lg">{plan.name}</h3>
                  <p className="mt-3 text-2xl font-semibold tabular-nums text-[#111111]">
                    ${plan.priceUsd.toLocaleString()}
                    <span className="text-sm font-normal text-[#888888]">/mo</span>
                  </p>
                  <p className="mt-1 text-xs text-[#888888]">
                    {plan.techLimit == null ? 'Unlimited technicians' : `Up to ${plan.techLimit} technicians`}
                  </p>
                  <div className="mt-6">
                    {user ? (
                      <Link
                        to="/pricing"
                        className="inline-flex w-full justify-center rounded-md border border-[#111111] bg-transparent px-4 py-2.5 text-center text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5"
                      >
                        View plans & checkout
                      </Link>
                    ) : (
                      <SpaLink
                        to="/login"
                        state={{ from: '/pricing' }}
                        className="inline-flex w-full justify-center rounded-md border border-[#111111] bg-transparent px-4 py-2.5 text-center text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5"
                      >
                        Sign in to choose plan
                      </SpaLink>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-10 text-center">
              {user ? (
                <Link
                  to="/pricing"
                  className="inline-flex rounded-md border border-[#111111] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5"
                >
                  View full pricing
                </Link>
              ) : (
                <SpaLink
                  to="/login"
                  state={{ from: '/pricing' }}
                  className="inline-flex rounded-md border border-[#111111] bg-transparent px-5 py-2.5 text-sm font-semibold text-[#111111] transition hover:bg-[#111111]/5"
                >
                  View full pricing
                </SpaLink>
              )}
            </div>
          </div>
        </section>

        <section className="bg-[#111111] px-6 py-14 text-white sm:px-8 sm:py-20">
          <div className="mx-auto max-w-2xl px-6 text-center sm:px-10">
            <h2 className="text-2xl font-semibold sm:text-3xl">
              Every day without Margen is revenue you won&apos;t get back
            </h2>
            <p className="mt-3 text-sm leading-relaxed text-[#d1d5db] sm:text-base">
              Find out exactly what your operation is losing — free, no commitment.
            </p>
            <a
              href={CALENDLY_AUDIT}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-8 inline-flex rounded-md bg-white px-6 py-3 text-sm font-semibold text-[#111111] transition hover:opacity-90"
            >
              Get my free audit
            </a>
          </div>
        </section>
      </main>

      <footer className="border-t border-[#ebebeb] bg-[#fafaf8] px-6 py-8 sm:px-8">
        <div className="mx-auto grid max-w-6xl grid-cols-1 items-center gap-6 sm:grid-cols-3">
          <p className="text-center text-xs text-[#888888] sm:text-left">
            &copy; {new Date().getFullYear()} Margen. All rights reserved.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-6 text-xs font-medium text-[#888888]">
            {user ? (
              <Link to="/pricing" className="transition hover:text-[#111111] hover:underline">
                Pricing
              </Link>
            ) : (
              <SpaLink to="/login" state={{ from: '/pricing' }} className="transition hover:text-[#111111] hover:underline">
                Pricing
              </SpaLink>
            )}
            <SpaLink to="/login" state={{ intent: 'sign-in-only' }} className="transition hover:text-[#111111] hover:underline">
              Sign in
            </SpaLink>
            <Link to="/signup" className="transition hover:text-[#111111] hover:underline">
              Create account
            </Link>
          </div>
          <div className="flex justify-center sm:justify-end">
            <MargenLogo title="Margen" className="h-16 w-auto sm:h-20" />
          </div>
        </div>
      </footer>
    </div>
  )
}
