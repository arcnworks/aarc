import { Client, isNotionClientError } from '@notionhq/client';

import { NextApiRequest, NextApiResponse } from 'next';

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Next.js에서 제공하는 res.json은 \n을 자동으로 추가하기 때문에 새로 만든 함수입니다.
const responseJSON = (res: NextApiResponse, status: number, json: any) => {
  res.status(status).setHeader('Content-Type', 'application/json; charset=utf-8').send(json);
};

export default async (req: NextApiRequest, res: NextApiResponse) => {
  const { id, cursor } = req.query;
  const pageId = Array.isArray(id) ? id[0] : id;

  if (!pageId) {
    return responseJSON(res, 400, { message: 'A page ID is required.' });
  }

  if (req.method === 'POST') {
    const { content } = req.body;
    if (!content) {
      return responseJSON(res, 400, { message: 'content is required' });
    }

    try {
      const result = await notion.comments.create({
        parent: {
          page_id: pageId,
        },
        rich_text: [
          {
            text: {
              content: content,
            },
          },
        ],
      });

      return responseJSON(res, 200, result);
    } catch (error) {
      // isAPIResponseError 헬퍼가 특정 버전/환경에서 문제를 일으킬 수 있으므로,
      // 'status' 속성의 존재 여부를 직접 확인하는 것이 더 안정적입니다.
      if (isNotionClientError(error) && 'status' in error) {
        return responseJSON(res, error.status, { code: error.code, message: error.message });
      }
      console.error('Failed to create comment:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      return responseJSON(res, 500, { message: errorMessage });
    }
  } else if (req.method === 'GET') {
    try {
      const result = await notion.comments.list({
        block_id: pageId,
        ...(cursor && { start_cursor: cursor as string }),
      });

      return responseJSON(res, 200, result);
    } catch (error) {
      // isAPIResponseError 헬퍼가 특정 버전/환경에서 문제를 일으킬 수 있으므로,
      // 'status' 속성의 존재 여부를 직접 확인하는 것이 더 안정적입니다.
      if (isNotionClientError(error) && 'status' in error) {
        return responseJSON(res, error.status, { code: error.code, message: error.message });
      }
      console.error('Failed to list comments:', error);
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred.';
      return responseJSON(res, 500, { message: errorMessage });
    }
  }

  return responseJSON(res, 405, { message: 'method not allowed' });
};
