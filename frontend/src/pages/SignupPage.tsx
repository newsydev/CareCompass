import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import healthcareHero from '../assets/healthcare-hero.png'
import { AuthLayout } from '../components/AuthLayout'
import { useDemoSession } from '../hooks/useDemoSession'

export function SignupPage() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { login, busy } = useDemoSession()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''), String(form.get('fullName') ?? ''))) navigate('/home')
  }

  return (
    <AuthLayout
      illustration={healthcareHero}
      tagline="CareCompass helps you find the right care, fast — day or night, in your own language."
    >
      <h1 className="text-2xl font-semibold text-gray-900">Create Account</h1>
      <p className="mt-2 text-sm text-gray-500">Create a password-protected account with a saved profile and conversation history. Use fictional health data: care guidance and bookings remain a demo.</p>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-gray-600">
          Full Name
          <input
            type="text"
            name="fullName"
            required
            maxLength={100}
            autoComplete="name"
            className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="Your full name"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-gray-600">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className="rounded-lg border border-gray-200 px-3.5 py-2.5 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm text-gray-600">
          Password
          <span className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-10 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="At least 12 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-3 flex items-center text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? '🙈' : '👁️'}
            </button>
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className="mt-2 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700"
        >
          {busy ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{' '}
        <Link to="/login" className="font-medium text-brand-600 hover:text-brand-700">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
