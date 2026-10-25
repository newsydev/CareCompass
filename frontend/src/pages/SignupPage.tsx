import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import healthcareHero from '../assets/healthcare-hero.png'
import { AuthLayout } from '../components/AuthLayout'
import { authButton, authInput, authToggle } from '../components/authStyles'
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
      <h1 className="text-2xl font-bold text-gray-900">Create Account</h1>
      
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Full Name
          <input
            type="text"
            name="fullName"
            required
            maxLength={100}
            autoComplete="name"
            className={authInput}
            placeholder="Your full name"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            name="email"
            required
            autoComplete="email"
            className={authInput}
            placeholder="you@example.com"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Password
          <span className="relative">
            <input
              type={showPassword ? 'text' : 'password'}
              name="password"
              required
              minLength={12}
              maxLength={256}
              autoComplete="new-password"
              className={`${authInput} pr-16`}
              placeholder="At least 12 characters"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className={authToggle}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </span>
        </label>

        <button
          type="submit"
          disabled={busy}
          className={authButton}
        >
          {busy ? 'Creating account...' : 'Create Account'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Already have an account?{' '}
        <Link to="/login" className="font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600">
          Log in
        </Link>
      </p>
    </AuthLayout>
  )
}
