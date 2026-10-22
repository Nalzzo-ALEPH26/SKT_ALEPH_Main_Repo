import { LoginForm } from '@/components/login-form'

export default function HomePage() {
  return (
    <main
      data-keychats-shell
      className="flex min-h-screen items-center justify-center px-5 py-10"
    >
      <LoginForm />
    </main>
  )
}
