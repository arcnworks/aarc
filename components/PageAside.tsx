import * as React from 'react'
import { Block, ExtendedRecordMap } from 'notion-types'
import Link from 'next/link'
import { PageActions } from './PageActions'
import { getPageTweet } from 'lib/get-page-tweet'

export const PageAside: React.FC<{
  block: Block
  recordMap: ExtendedRecordMap
  isBlogPost: boolean
  recentPosts?: Array<{ id: string; title: string; url: string }>
}> = ({ block, recordMap, isBlogPost, recentPosts }) => {
  if (!block) return null

  if (isBlogPost) {
    const tweet = getPageTweet(block, recordMap)

    return (
      <div className='arc-aside-container'>
        {tweet && <PageActions tweet={tweet} />}

        {recentPosts && recentPosts.length > 0 && (
          <div className='aside-recent-posts'>
            <div className='aside-recent-title'>최신글 읽어보기</div>
            <nav className='aside-recent-list'>
              {recentPosts.map((post) => (
                <Link key={post.id} href={post.url} className='aside-recent-item'>
                  <span className='aside-recent-text'>{post.title}</span>
                </Link>
              ))}
            </nav>
          </div>
        )}
      </div>
    )
  }

  return null
}