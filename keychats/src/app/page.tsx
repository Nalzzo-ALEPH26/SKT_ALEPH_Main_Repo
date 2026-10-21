import Link from 'next/link'

export default function HomePage() {
  return (
    <main
      data-keychats-shell
      className="mx-auto flex min-h-screen max-w-5xl items-center justify-center px-6 py-12"
    >
      <section className="w-full max-w-xl rounded-3xl border border-black/5 bg-white p-10 shadow-sm">
        <p className="text-sm font-medium tracking-[0.18em] text-black/45">KEYCHATS</p>
        <h1 className="mt-4 text-4xl font-semibold tracking-tight">팀 채팅을 시작하세요.</h1>
        <p className="mt-3 text-base leading-7 text-black/55">
          초대받은 팀원만 로그인할 수 있는 비공개 협업 채팅입니다.
        </p>
        <Link
          href="/login"
          className="mt-8 inline-flex rounded-xl bg-black px-5 py-3 text-sm font-semibold text-white"
        >
          로그인
        </Link>
        <img
          src="/chats/default-avatar.svg"
          alt=""
          aria-hidden="true"
          className="mt-8 h-10 w-10 opacity-70"
        />
      </section>
    </main>
  )
}
