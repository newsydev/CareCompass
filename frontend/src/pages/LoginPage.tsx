import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import doctorsTeam from '../assets/doctors-team.png'
import { AuthLayout } from '../components/AuthLayout'

export function LoginPage() {
  const [showPassword, setShowPassword] = useState(false)
  const navigate = useNavigate()

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    navigate('/triage')
  }

  return (
    <AuthLayout
      illustration={doctorsTeam}
      tagline="Welcome back. Your caregivers are ready when you are."
    >
      <h1 className="text-2xl font-semibold text-gray-900">Log In</h1>

      <form onSubmit={handleSubmit} className="mt-6 flex flex-col gap-4">
        <label className="flex flex-col gap-1.5 text-sm text-gray-600">
          Email
          <input
            type="email"
            name="email"
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
              autoComplete="current-password"
              className="w-full rounded-lg border border-gray-200 px-3.5 py-2.5 pr-10 text-gray-900 outline-none transition focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20"
              placeholder="Your password"
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

        <div className="flex justify-end">
          <a href="#" className="text-sm font-medium text-brand-600 hover:text-brand-700">
            Forgot password?
          </a>
        </div>

        <button
          type="submit"
          className="mt-1 rounded-lg bg-brand-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-brand-600 active:bg-brand-700"
        >
          Log In
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don&apos;t have an account?{' '}
        <Link to="/signup" className="font-medium text-brand-600 hover:text-brand-700">
          Sign up
        </Link>
      </p>
    </AuthLayout>
  )
}
