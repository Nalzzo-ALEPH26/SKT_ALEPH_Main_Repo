import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'

import { createFeedbackAction, deleteFeedbackAction } from './actions'

export const dynamic = 'force-dynamic'

export default async function FeedbackPage() {
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const isAdmin = claims.app_metadata?.role === 'admin'

  const [{ data: posts, error: postsError }, { data: profiles, error: profilesError }] = await Promise.all([
    client
      .from('feedback_posts')
      .select('id,author_id,body,created_at')
      .order('created_at', { ascending: false })
      .limit(100),
    client.from('profiles').select('user_id,display_name,username'),
  ])

  if (postsError) throw postsError
  if (profilesError) throw profilesError

  const profileById = new Map(
    (profiles ?? []).map((profile) => [
      profile.user_id as string,
      {
        displayName: profile.display_name as string,
        username: profile.username as string,
      },
    ]),
  )

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
      <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500">FEEDBACK</p>
      <h1 className="mt-2 text-2xl font-semibold">피드백 게시판</h1>
      <p className="mt-2 text-sm text-zinc-500">Keychats를 쓰면서 불편한 점이나 개선 아이디어를 남겨주세요.</p>

      <form action={createFeedbackAction} className="mt-6 rounded-2xl border border-black/10 p-4 dark:border-white/10">
        <label className="block text-sm font-semibold" htmlFor="feedback-body">피드백 작성</label>
        <textarea
          id="feedback-body"
          name="body"
          required
          maxLength={4000}
          rows={4}
          placeholder="어떤 점을 개선하면 좋을까요?"
          className="mt-3 w-full resize-y rounded-xl border border-black/20 bg-white px-3 py-2 text-sm text-black outline-none focus:border-black dark:border-white/20 dark:bg-zinc-950 dark:text-white"
        />
        <button type="submit" className="mt-3 rounded-xl bg-zinc-950 px-4 py-2 text-sm font-semibold text-white dark:bg-white dark:text-zinc-950">
          등록
        </button>
      </form>

      <div className="mt-6 space-y-3">
        {(posts ?? []).map((post) => {
          const author = profileById.get(post.author_id as string)
          const canDelete = isAdmin || post.author_id === claims.sub
          return (
            <article key={post.id as string} className="rounded-2xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-sm font-semibold">
                    {author?.displayName ?? '사용자'}{' '}
                    <span className="font-normal text-zinc-500">@{author?.username ?? 'unknown'}</span>
                  </div>
                  <time className="mt-1 block text-xs text-zinc-400" dateTime={post.created_at as string}>
                    {new Date(post.created_at as string).toLocaleString('ko-KR')}
                  </time>
                </div>
                {canDelete ? (
                  <form action={deleteFeedbackAction}>
                    <input type="hidden" name="feedbackId" value={post.id as string} />
                    <button type="submit" className="text-xs text-zinc-400 hover:text-red-600">삭제</button>
                  </form>
                ) : null}
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{post.body as string}</p>
            </article>
          )
        })}
        {(posts ?? []).length === 0 ? (
          <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">
            아직 피드백이 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  )
}
