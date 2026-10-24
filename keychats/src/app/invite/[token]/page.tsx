import { InviteForm } from './invite-form'

export default async function InvitePage({
  params,
}: {
  params: Promise<{ token: string }>
}) {
  const { token } = await params
  const tokenLooksValid = /^[A-Za-z0-9_-]{43}$/.test(token)

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-10">
      <section className="w-full max-w-sm rounded-3xl border border-black/5 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold tracking-[0.2em] text-black/40">KEYCHATS</p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight">초대받아 가입하기</h1>
        <p className="mt-2 text-sm leading-6 text-black/50">
          이 링크는 한 번만 사용할 수 있으며 발급 후 1시간 동안 유효합니다.
        </p>

        {tokenLooksValid ? (
          <InviteForm token={token} />
        ) : (
          <p role="alert" className="mt-8 text-sm text-red-600">
            초대 링크가 유효하지 않거나 더 이상 사용할 수 없습니다.
          </p>
        )}
      </section>
    </main>
  )
}
