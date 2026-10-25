import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import doctorsTeam from '../assets/doctors-team.png'
import { AuthLayout } from '../components/AuthLayout'
import { authButton, authInput, authToggle } from '../components/authStyles'
import { useDemoSession } from '../hooks/useDemoSession'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()
  const { login, busy } = useDemoSession()

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const form = new FormData(e.currentTarget)
    if (await login(String(form.get('email') ?? ''), String(form.get('password') ?? ''))) navigate('/home')
  }

  return (
    <AuthLayout
      illustration={doctorsTeam}
      tagline="Welcome back. Your caregivers are ready when you are."
    >
      <h1 className="text-2xl font-bold text-gray-900">Log In</h1>
      
      <form onSubmit={handleSubmit} className="mt-8 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm font-medium text-gray-700">
          Email
          <input
            type="email"
            required
            name="email"
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
              maxLength={256}
              autoComplete="current-password"
              className={`${authInput} pr-16`}
              placeholder="Your password"
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
          {busy ? 'Logging in...' : 'Log In'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-600">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-semibold text-brand-700 hover:text-brand-800 focus-visible:outline-2 focus-visible:outline-brand-600">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
