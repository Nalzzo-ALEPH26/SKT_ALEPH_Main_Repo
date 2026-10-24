import { notFound } from 'next/navigation'

import { CommunityComposer } from '@/components/community-composer'
import { requireActiveUser } from '@/lib/auth/guards'
import { createAuthGuardAccess } from '@/lib/auth/server-access'
import { createClient } from '@/lib/supabase/server'
import { formatSeoulDateTime } from '@/lib/time/format'

import {
  createCommunityCommentAction,
  createCommunityPostAction,
  deleteCommunityCommentAction,
  deleteCommunityPostAction,
  renameCommunityAction,
  setCommunityCommentPinnedAction,
  setCommunityPostPinnedAction,
} from './actions'

type PageProps = { params: Promise<{ communityId: string }> }
type CommunityCommentRow = { id: string; post_id: string; author_id: string; body: string; created_at: string }

export const dynamic = 'force-dynamic'

export default async function CommunityPage({ params }: PageProps) {
  const { communityId } = await params
  const client = await createClient()
  const { claims } = await requireActiveUser(createAuthGuardAccess(client))
  const isAdmin = claims.app_metadata?.role === 'admin'

  const [{ data: community, error: communityError }, { data: posts, error: postsError }, { data: profiles, error: profilesError }] = await Promise.all([
    client.from('communities').select('id,name,created_by,created_at').eq('id', communityId).maybeSingle(),
    client.from('community_posts').select('id,author_id,body,created_at').eq('community_id', communityId).order('created_at', { ascending: false }).limit(100),
    client.from('profiles').select('user_id,display_name,username').eq('status', 'active'),
  ])
  if (communityError) throw communityError
  if (!community) notFound()
  if (postsError) throw postsError
  if (profilesError) throw profilesError

  const postIds = (posts ?? []).map((post) => post.id as string)
  let postPins: Array<{ post_id: string; pinned_at: string }> = []
  let comments: CommunityCommentRow[] = []
  if (postIds.length > 0) {
    const [{ data: pinRows, error: pinError }, { data: commentRows, error: commentError }] = await Promise.all([
      client.from('community_post_pins').select('post_id,pinned_at').in('post_id', postIds),
      client.from('community_comments').select('id,post_id,author_id,body,created_at').in('post_id', postIds).order('created_at', { ascending: true }),
    ])
    if (pinError) throw pinError
    if (commentError) throw commentError
    postPins = (pinRows ?? []) as Array<{ post_id: string; pinned_at: string }>
    comments = (commentRows ?? []) as CommunityCommentRow[]
  }

  const commentIds = comments.map((comment) => comment.id)
  let commentPins: Array<{ comment_id: string; pinned_at: string }> = []
  if (commentIds.length > 0) {
    const { data, error } = await client.from('community_comment_pins').select('comment_id,pinned_at').in('comment_id', commentIds)
    if (error) throw error
    commentPins = (data ?? []) as Array<{ comment_id: string; pinned_at: string }>
  }

  const profileById = new Map((profiles ?? []).map((profile) => [profile.user_id as string, { displayName: profile.display_name as string, username: profile.username as string }]))
  const creator = profileById.get(community.created_by as string)
  const isCreator = community.created_by === claims.sub
  const canRename = isCreator
  const canPinPosts = isAdmin || isCreator
  const canPinComments = isAdmin || isCreator

  const pinTimeByPostId = new Map(postPins.map((pin) => [pin.post_id, new Date(pin.pinned_at).getTime()]))
  const pinTimeByCommentId = new Map(commentPins.map((pin) => [pin.comment_id, new Date(pin.pinned_at).getTime()]))
  const commentsByPostId = new Map<string, CommunityCommentRow[]>()
  for (const comment of comments) {
    const current = commentsByPostId.get(comment.post_id) ?? []
    current.push(comment)
    commentsByPostId.set(comment.post_id, current)
  }
  for (const [postId, postComments] of commentsByPostId) {
    commentsByPostId.set(postId, [...postComments].sort((left, right) => {
      const leftPin = pinTimeByCommentId.get(left.id)
      const rightPin = pinTimeByCommentId.get(right.id)
      if (leftPin !== undefined && rightPin !== undefined) return rightPin - leftPin
      if (leftPin !== undefined) return -1
      if (rightPin !== undefined) return 1
      return new Date(left.created_at).getTime() - new Date(right.created_at).getTime()
    }))
  }

  const sortedPosts = [...(posts ?? [])].sort((left, right) => {
    const leftPin = pinTimeByPostId.get(left.id as string)
    const rightPin = pinTimeByPostId.get(right.id as string)
    if (leftPin !== undefined && rightPin !== undefined) return rightPin - leftPin
    if (leftPin !== undefined) return -1
    if (rightPin !== undefined) return 1
    return new Date(right.created_at as string).getTime() - new Date(left.created_at as string).getTime()
  })

  const createPostAction = createCommunityPostAction.bind(null, communityId)
  const deletePostAction = deleteCommunityPostAction.bind(null, communityId)
  const renameAction = renameCommunityAction.bind(null, communityId)
  const setPostPinAction = setCommunityPostPinnedAction.bind(null, communityId)
  const createCommentAction = createCommunityCommentAction.bind(null, communityId)
  const deleteCommentAction = deleteCommunityCommentAction.bind(null, communityId)
  const setCommentPinAction = setCommunityCommentPinnedAction.bind(null, communityId)

  return (
    <div className="mx-auto w-full max-w-3xl px-5 py-8 md:px-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold tracking-[0.16em] text-zinc-500">COMMUNITY</p>
          <h1 className="mt-2 text-2xl font-semibold">{community.name}</h1>
          <p className="mt-2 text-sm text-zinc-500">생성자 {creator?.displayName ?? '사용자'} <span className="text-zinc-400">@{creator?.username ?? 'unknown'}</span></p>
          <p className="mt-1 text-sm text-zinc-500">팀원들과 자유롭게 글을 남기는 커뮤니티입니다.</p>
        </div>
        {canRename ? (
          <details className="relative">
            <summary className="cursor-pointer list-none rounded-lg border border-black/10 px-3 py-2 text-xs font-semibold dark:border-white/10">제목 수정</summary>
            <form action={renameAction} className="absolute right-0 z-20 mt-2 w-64 space-y-2 rounded-xl border border-black/10 bg-white p-3 shadow-xl dark:border-white/10 dark:bg-zinc-900">
              <input name="communityName" defaultValue={community.name as string} required maxLength={40} aria-label="커뮤니티 제목" className="w-full rounded-lg border border-black/15 bg-white px-2.5 py-2 text-sm text-black outline-none dark:border-white/15 dark:bg-zinc-950 dark:text-white" />
              <button type="submit" className="w-full rounded-lg bg-black px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black">저장</button>
            </form>
          </details>
        ) : null}
      </div>

      <CommunityComposer action={createPostAction} />

      <div className="mt-6 space-y-3">
        {sortedPosts.map((post) => {
          const postId = post.id as string
          const author = profileById.get(post.author_id as string)
          const canDelete = isAdmin || post.author_id === claims.sub
          const pinned = pinTimeByPostId.has(postId)
          const postComments = commentsByPostId.get(postId) ?? []
          return (
            <article key={postId} data-community-post data-pinned={pinned ? 'true' : 'false'} className={`rounded-2xl border p-4 ${pinned ? 'border-amber-500/35 bg-amber-500/[0.06]' : 'border-black/10 dark:border-white/10'}`}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-semibold">
                    <span>{author?.displayName ?? '사용자'} <span className="font-normal text-zinc-500">@{author?.username ?? 'unknown'}</span></span>
                    {pinned ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:text-amber-300">고정 게시글</span> : null}
                  </div>
                  <time className="mt-1 block text-xs text-zinc-400" dateTime={post.created_at as string}>{formatSeoulDateTime(post.created_at as string)}</time>
                </div>
                <div className="flex items-center gap-2">
                  {canPinPosts ? (
                    <form action={setPostPinAction}>
                      <input type="hidden" name="postId" value={postId} />
                      <input type="hidden" name="operation" value={pinned ? 'unpin' : 'pin'} />
                      <button type="submit" className="text-xs text-zinc-400 hover:text-amber-600">{pinned ? '고정 해제' : '상단 고정'}</button>
                    </form>
                  ) : null}
                  {canDelete ? <form action={deletePostAction}><input type="hidden" name="postId" value={postId} /><button type="submit" className="text-xs text-zinc-400 hover:text-red-600">삭제</button></form> : null}
                </div>
              </div>
              <p className="mt-3 whitespace-pre-wrap break-words text-sm leading-6">{post.body as string}</p>

              <details data-community-comments className="mt-4 border-t border-black/5 pt-3 dark:border-white/10">
                <summary className="cursor-pointer select-none text-xs font-semibold text-zinc-500">댓글 {postComments.length}개 · 펼치기/접기</summary>
                <div className="mt-3 space-y-3">
                  {postComments.map((comment) => {
                    const commentAuthor = profileById.get(comment.author_id)
                    const canDeleteComment = isAdmin || comment.author_id === claims.sub
                    const commentPinned = pinTimeByCommentId.has(comment.id)
                    return (
                      <div key={comment.id} data-community-comment data-pinned={commentPinned ? 'true' : 'false'} className={`rounded-xl px-3 py-2.5 ${commentPinned ? 'border border-amber-500/25 bg-amber-500/[0.07]' : 'bg-black/[0.025] dark:bg-white/[0.04]'}`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                              <span>{commentAuthor?.displayName ?? '사용자'} <span className="font-normal text-zinc-500">@{commentAuthor?.username ?? 'unknown'}</span></span>
                              {commentPinned ? <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-700 dark:text-amber-300">고정 댓글</span> : null}
                            </div>
                            <time className="mt-0.5 block text-[11px] text-zinc-400" dateTime={comment.created_at}>{formatSeoulDateTime(comment.created_at)}</time>
                          </div>
                          <div className="flex items-center gap-2">
                            {canPinComments ? <form action={setCommentPinAction}><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="postId" value={postId} /><input type="hidden" name="operation" value={commentPinned ? 'unpin' : 'pin'} /><button type="submit" className="text-[11px] text-zinc-400 hover:text-amber-600">{commentPinned ? '댓글 고정 해제' : '댓글 상단 고정'}</button></form> : null}
                            {canDeleteComment ? <form action={deleteCommentAction}><input type="hidden" name="commentId" value={comment.id} /><input type="hidden" name="postId" value={postId} /><button type="submit" className="text-[11px] text-zinc-400 hover:text-red-600">삭제</button></form> : null}
                          </div>
                        </div>
                        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-5">{comment.body}</p>
                      </div>
                    )
                  })}
                  <form action={createCommentAction} className="flex items-end gap-2">
                    <input type="hidden" name="postId" value={postId} />
                    <textarea name="commentBody" required maxLength={1000} rows={2} placeholder="댓글을 입력하세요." aria-label="댓글" className="min-w-0 flex-1 resize-y rounded-xl border border-black/10 bg-white px-3 py-2 text-sm text-black outline-none dark:border-white/10 dark:bg-zinc-950 dark:text-white" />
                    <button type="submit" className="shrink-0 rounded-xl bg-black px-3 py-2 text-xs font-semibold text-white dark:bg-white dark:text-black">등록</button>
                  </form>
                </div>
              </details>
            </article>
          )
        })}
        {sortedPosts.length === 0 ? <div className="rounded-2xl border border-dashed border-black/10 p-8 text-center text-sm text-zinc-500 dark:border-white/10">아직 글이 없습니다.</div> : null}
      </div>
    </div>
  )
}
