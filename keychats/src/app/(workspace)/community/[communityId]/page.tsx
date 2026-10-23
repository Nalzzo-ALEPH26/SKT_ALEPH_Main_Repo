import { notFound } from 'next/navigation'

import { CommunityComposer } from '@/components/community-composer'
import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'
import { formatSeoulDateTime } from '@/lib/time/format'

import { createCommunityPostAction, deleteCommunityPostAction } from './actions'

type PageProps = {
  params: Promise<{ communityId: string }>
}

export const dynamic = 'force-dynamic'

export default async function CommunityPage({ params }: PageProps) {
  const { communityId } = await params
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const isAdmin = claims.app_metadata?.role === 'admin'

  const [
    { data: community, error: communityError },
    { data: posts, error: postsError },
    { data: profiles, error: profilesError },
  ] = await Promise.all([
    client
      .from('communities')
      .select('id,name,created_at')
      .eq('id', communityId)
      .maybeSingle(),
    client
      .from('community_posts')
      .select('id,author_id,body,created_at')
      .eq('community_id', communityId)
      .order('created_at', { ascending: false })
      .limit(100),
    client
      .from('profiles')
      .select('user_id,display_name,username')
      .eq('status', 'active'),
  ])

  if (communityError) throw communityError
  if (!community) notFound()
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

  const createAction = createCommunityPostAction.bind(null, communityId)
  const deleteAction = deleteCommunityPostAction.bind(null, communityId)

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
      <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500">COMMUNITY</p>
      <h1 className="mt-2 text-2xl font-semibold">{community.name}</h1>
      <p className="mt-2 text-sm text-zinc-500">팀원들과 자유롭게 글을 남기는 커뮤니티입니다.</p>

      <CommunityComposer action={createAction} />

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
                    {formatSeoulDateTime(post.created_at as string)}
                  </time>
                </div>
                {canDelete ? (
                  <form action={deleteAction}>
                    <input type="hidden" name="postId" value={post.id as string} />
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
            아직 글이 없습니다.
          </div>
        ) : null}
      </div>
    </div>
  )
}
