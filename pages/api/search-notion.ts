import { NextApiRequest, NextApiResponse } from 'next';

import * as types from '../../lib/types';
import { search } from '../../lib/notion';

const searchNotionAPI = async (req: NextApiRequest, res: NextApiResponse) => {
  if (req.method !== 'POST') {
    return res.status(405).send({ error: 'method not allowed' });
  }

  const searchParams: types.SearchParams = req.body;

  const results = await search(searchParams);

  res.setHeader('Cache-Control', 'public, s-maxage=60, max-age=60, stale-while-revalidate=60');
  res.status(200).json(results);
};

export default searchNotionAPI;
