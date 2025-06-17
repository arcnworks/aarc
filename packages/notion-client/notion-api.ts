// import { promises as fs } from 'fs'
import got, { OptionsOfJSONResponseBody } from 'got';
import * as notion from 'notion-types';
import { parsePageId, getPageContentBlockIds, uuidToId, getBlockCollectionId } from 'notion-utils';
import pMap from 'p-map';

import * as types from './types';

/**
 * Main Notion API client.
 */
export class NotionAPI {
  private readonly _apiBaseUrl: string;
  private readonly _authToken?: string;
  private readonly _activeUser?: string;
  private readonly _userTimeZone: string;

  constructor({
    apiBaseUrl = 'https://www.notion.so/api/v3',
    authToken,
    activeUser,
    userTimeZone = 'America/New_York',
  }: {
    apiBaseUrl?: string;
    authToken?: string;
    userLocale?: string;
    userTimeZone?: string;
    activeUser?: string;
  } = {}) {
    this._apiBaseUrl = apiBaseUrl;
    this._authToken = authToken;
    this._activeUser = activeUser;
    this._userTimeZone = userTimeZone;
  }

  public async getPage(
    pageId: string,
    {
      concurrency = 3,
      fetchMissingBlocks = true,
      fetchCollections = true,
      signFileUrls = true,
      chunkLimit = 100,
      chunkNumber = 0,
      gotOptions,
      draftView = false,
    }: {
      concurrency?: number;
      fetchMissingBlocks?: boolean;
      fetchCollections?: boolean;
      signFileUrls?: boolean;
      chunkLimit?: number;
      chunkNumber?: number;
      gotOptions?: OptionsOfJSONResponseBody;
      draftView?: boolean;
    } = {},
  ): Promise<notion.ExtendedRecordMap> {
    const page = await this.getPageRaw(pageId, {
      chunkLimit,
      chunkNumber,
      gotOptions,
    });

    const recordMap = page?.recordMap as notion.ExtendedRecordMap;

    if (!recordMap?.block) {
      throw new Error(`Notion page not found "${uuidToId(pageId)}"`);
    }

    // CUSTOM: 작성자 유저 정보 가져오도록 처리
    const pageBlockId = Object.keys(recordMap.block)[0];
    const pageBlock = recordMap.block[pageBlockId].value;
    const authorId = pageBlock.created_by_id;
    const users = await this.getUsers([authorId]);
    const author = users.results[0];

    recordMap.notion_user = {
      [authorId]: author,
    };

    // ensure that all top-level maps exist 모든 최상위 지도(map)가 존재하도록 보장하세요.
    recordMap.collection = recordMap.collection ?? {};
    recordMap.collection_view = recordMap.collection_view ?? {};
    recordMap.notion_user = recordMap.notion_user ?? {};

    // additional mappings added for convenience 추가적인 매핑이 편의를 위해 추가되었습니다.
    // note: these are not native notion objects 참고: 이것들은 기본 Notion 객체가 아닙니다.
    recordMap.collection_query = {};
    recordMap.signed_urls = {};

    if (fetchMissingBlocks) {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        // fetch any missing content blocks 누락된 콘텐츠 블록을 가져오세요.
        const pendingBlockIds = getPageContentBlockIds(recordMap).filter(
          id => !recordMap.block[id],
        );

        if (!pendingBlockIds.length) {
          break;
        }

        const newBlocks = await this.getBlocks(pendingBlockIds, gotOptions).then(
          res => res.recordMap.block,
        );

        recordMap.block = { ...recordMap.block, ...newBlocks };
      }
    }

    const contentBlockIds = getPageContentBlockIds(recordMap);

    // Optionally fetch all data for embedded collections and their associated views. 선택적으로 포함된 컬렉션과 해당 관련된 뷰의 모든 데이터를 가져옵니다.
    // NOTE: We're eagerly fetching *all* data for each collection and all of its views.참고: 각 컬렉션과 모든 뷰의 *모든* 데이터를 미리 가져오고 있습니다.
    // This is really convenient in order to ensure that all data needed for a given 이는 특정 Notion 페이지에 필요한 모든 데이터를 서버 사이드 렌더링과
    // Notion page is readily available for use cases involving server-side rendering 엣지 캐싱과 같은 사용 사례에서 즉시 활용할 수 있도록 보장하는 데 매우 유용합니다.
    // and edge caching.
    if (fetchCollections) {
      const allCollectionInstances: Array<{
        collectionId: string;
        collectionViewId: string;
      }> = contentBlockIds.flatMap(blockId => {
        const block = recordMap.block[blockId].value;
        const collectionId =
          block &&
          (block.type === 'collection_view' || block.type === 'collection_view_page') &&
          getBlockCollectionId(block, recordMap);

        if (collectionId) {
          return block.view_ids?.map(collectionViewId => ({
            collectionId,
            collectionViewId,
          }));
        } else {
          return [];
        }
      });

      // fetch data for all collection view instances
      await pMap(
        allCollectionInstances,
        async collectionInstance => {
          const { collectionId, collectionViewId } = collectionInstance;
          const collectionView = recordMap.collection_view[collectionViewId]?.value;

          try {
            const collectionData = await this.getCollectionData(
              collectionId,
              collectionViewId,
              collectionView,
              {
                gotOptions,
                draftView,
              },
            );

            // await fs.writeFile(
            //   `${collectionId}-${collectionViewId}.json`,
            //   JSON.stringify(collectionData.result, null, 2)
            // )

            recordMap.block = {
              ...recordMap.block,
              ...collectionData.recordMap.block,
            };

            recordMap.collection = {
              ...recordMap.collection,
              ...collectionData.recordMap.collection,
            };

            recordMap.collection_view = {
              ...recordMap.collection_view,
              ...collectionData.recordMap.collection_view,
            };

            recordMap.notion_user = {
              ...recordMap.notion_user,
              ...collectionData.recordMap.notion_user,
            };

            recordMap.collection_query![collectionId] = {
              ...recordMap.collection_query![collectionId],
              [collectionViewId]: (collectionData.result as any)?.reducerResults,
            };
          } catch (err) {
            // It's possible for public pages to link to private collections, in which case
            // Notion returns a 400 error
            console.warn('NotionAPI collectionQuery error', pageId, err.message);
            console.error(err);
          }
        },
        {
          concurrency,
        },
      );
    }

    // Optionally fetch signed URLs for any embedded files.
    // NOTE: Similar to collection data, we default to eagerly fetching signed URL info
    // because it is preferable for many use cases as opposed to making these API calls
    // lazily from the client-side.
    if (signFileUrls) {
      await this.addSignedUrls({ recordMap, contentBlockIds, gotOptions });
    }

    return recordMap;
  }

  public async addSignedUrls({
    recordMap,
    contentBlockIds,
    gotOptions = {},
  }: {
    recordMap: notion.ExtendedRecordMap;
    contentBlockIds?: string[];
    gotOptions?: OptionsOfJSONResponseBody;
  }) {
    recordMap.signed_urls = {};
  
    if (!contentBlockIds) {
      contentBlockIds = getPageContentBlockIds(recordMap);
    }
  
    const allFileInstances = contentBlockIds.flatMap(blockId => {
      const block = recordMap.block[blockId]?.value;
  
      if (
        block &&
        (block.type === 'pdf' ||
          block.type === 'audio' ||
          (block.type === 'image' && block.file_ids?.length) ||
          block.type === 'video' ||
          block.type === 'file' ||
          block.type === 'page')
      ) {
        const source =
          block.type === 'page' ? block.format?.page_cover : block.properties?.source?.[0]?.[0];
  
        if (source) {
          if (
            source.includes('youtube') ||
            source.includes('vimeo') ||
            source.includes('splash')
          ) {
            return [];
          }
  
          return {
            permissionRecord: {
              table: 'block',
              id: block.id,
            },
            url: source,
          };
        }
      }
  
      return [];
    });
  
    if (allFileInstances.length > 0) {
      const tryGetSignedUrls = async (attempt = 1): Promise<types.SignedUrlResponse | null> => {
        try {
          return await this.getSignedFileUrls(allFileInstances, gotOptions);
        } catch (err) {
          console.warn(`NotionAPI getSignedFileUrls attempt ${attempt} failed`, err);
          if (attempt < 2) {
            await new Promise(res => setTimeout(res, 300)); // wait 300ms
            return tryGetSignedUrls(attempt + 1);
          }
          return null;
        }
      };
  
      const result = await tryGetSignedUrls();
  
      if (result?.signedUrls?.length > 0) {
        const signedUrls = result.signedUrls;
  
        for (let i = 0; i < signedUrls.length; ++i) {
          const file = allFileInstances[i];
          const signedUrl = signedUrls[i];
  
          if (file && signedUrl) {
            recordMap.signed_urls[file.permissionRecord.id] = signedUrl;
          } else {
            console.warn(
              `⚠️ Signed URL 누락됨: blockId=${file?.permissionRecord.id}, index=${i}`
            );
          }
        }
  
        if (signedUrls.length < allFileInstances.length) {
          console.warn(
            `⚠️ 일부 signed URL 누락: ${signedUrls.length} / ${allFileInstances.length}`
          );
        }
      } else {
        console.error('❌ 모든 signed URL 요청 실패 또는 응답 없음');
      }
    }
  }
  

  public async getPageRaw(
    pageId: string,
    {
      gotOptions,
      chunkLimit = 100,
      chunkNumber = 0,
    }: {
      chunkLimit?: number;
      chunkNumber?: number;
      gotOptions?: OptionsOfJSONResponseBody;
    } = {},
  ) {
    const parsedPageId = parsePageId(pageId);

    if (!parsedPageId) {
      throw new Error(`invalid notion pageId "${pageId}"`);
    }

    const body = {
      pageId: parsedPageId,
      limit: chunkLimit,
      chunkNumber: chunkNumber,
      cursor: { stack: [] },
      verticalColumns: false,
    };

    return this.fetch<notion.PageChunk>({
      endpoint: 'loadPageChunk',
      body,
      gotOptions,
    });
  }

  public async getCollectionData(
    collectionId: string,
    collectionViewId: string,
    collectionView: any,
    {
      limit = 9999,
      searchQuery = '',
      userTimeZone = this._userTimeZone,
      loadContentCover = true,
      draftView = false,
      gotOptions,
    }: {
      type?: notion.CollectionViewType;
      limit?: number;
      searchQuery?: string;
      userTimeZone?: string;
      userLocale?: string;
      loadContentCover?: boolean;
      draftView?: boolean;
      gotOptions?: OptionsOfJSONResponseBody;
    } = {},
  ) {
    const type = collectionView?.type;
    const isBoardType = type === 'board';
    const groupBy =
      collectionView?.format?.board_columns_by || collectionView?.format?.collection_group_by;

    let loader: any = {
      type: 'reducer',
      reducers: {
        collection_group_results: {
          type: 'results',
          limit,
          loadContentCover,
        },
      },
      sort: [],
      ...collectionView?.query2,
      searchQuery,
      userTimeZone,
    };

    // CUSTOM: 필터 작동하도록 처리
    if (collectionView?.format?.property_filters?.length) {
      loader.filter = {
        operator: 'and',
        filters: collectionView.format.property_filters
          .map(filter => filter.filter)
          .filter(draftView ? filter => filter.filter.operator !== 'status_is' : () => true),
      };
    }

    if (groupBy) {
      const groups =
        collectionView?.format?.board_columns || collectionView?.format?.collection_groups || [];
      const iterators = [isBoardType ? 'board' : 'group_aggregation', 'results'];
      const operators = {
        checkbox: 'checkbox_is',
        url: 'string_starts_with',
        text: 'string_starts_with',
        select: 'enum_is',
        multi_select: 'enum_contains',
        created_time: 'date_is_within',
        ['undefined']: 'is_empty',
      };

      const reducersQuery = {};
      for (const group of groups) {
        const {
          property,
          value: { value, type },
        } = group;

        for (const iterator of iterators) {
          const iteratorProps =
            iterator === 'results'
              ? {
                  type: iterator,
                  limit,
                }
              : {
                  type: 'aggregation',
                  aggregation: {
                    aggregator: 'count',
                  },
                };

          const isUncategorizedValue = typeof value === 'undefined';
          const isDateValue = value?.range;
          // TODO: review dates reducers
          const queryLabel = isUncategorizedValue
            ? 'uncategorized'
            : isDateValue
            ? value.range?.start_date || value.range?.end_date
            : value?.value || value;

          const queryValue = !isUncategorizedValue && (isDateValue || value?.value || value);

          reducersQuery[`${iterator}:${type}:${queryLabel}`] = {
            ...iteratorProps,
            filter: {
              operator: 'and',
              filters: [
                {
                  property,
                  filter: {
                    operator: !isUncategorizedValue ? operators[type] : 'is_empty',
                    ...(!isUncategorizedValue && {
                      value: {
                        type: 'exact',
                        value: queryValue,
                      },
                    }),
                  },
                },
              ],
            },
          };
        }
      }

      const reducerLabel = isBoardType ? 'board_columns' : `${type}_groups`;
      loader = {
        type: 'reducer',
        reducers: {
          [reducerLabel]: {
            type: 'groups',
            groupBy,
            ...(collectionView?.query2?.filter && {
              filter: collectionView?.query2?.filter,
            }),
            groupSortPreference: groups.map(group => group?.value),
            limit,
          },
          ...reducersQuery,
        },
        ...collectionView?.query2,
        searchQuery,
        userTimeZone,
        //TODO: add filters here
        // filter: {
        //   filters: filters,
        //   operator: 'and'
        // }
      };
    }

    return this.fetch<notion.CollectionInstance>({
      endpoint: 'queryCollection',
      body: {
        collection: {
          id: collectionId,
        },
        collectionView: {
          id: collectionViewId,
        },
        loader,
      },
      gotOptions,
    });
  }

  public async getUsers(userIds: string[], gotOptions?: OptionsOfJSONResponseBody) {
    // CUSTOM: 타입 수정
    return this.fetch<
      notion.RecordValues<{
        role: notion.Role;
        value: notion.User;
      }>
    >({
      endpoint: 'getRecordValues',
      body: {
        requests: userIds.map(id => ({ id, table: 'notion_user' })),
      },
      gotOptions,
    });
  }

  public async getBlocks(blockIds: string[], gotOptions?: OptionsOfJSONResponseBody) {
    return this.fetch<notion.PageChunk>({
      endpoint: 'syncRecordValues',
      body: {
        requests: blockIds.map(blockId => ({
          // TODO: when to use table 'space' vs 'block'?
          table: 'block',
          id: blockId,
          version: -1,
        })),
      },
      gotOptions,
    });
  }

  public async getSignedFileUrls(
    urls: types.SignedUrlRequest[],
    gotOptions?: OptionsOfJSONResponseBody,
  ) {
    return this.fetch<types.SignedUrlResponse>({
      endpoint: 'getSignedFileUrls',
      body: {
        urls,
      },
      gotOptions,
    });
  }

  public async search(params: notion.SearchParams, gotOptions?: OptionsOfJSONResponseBody) {
    const body = {
      type: 'BlocksInAncestor',
      query: params.query,
      ancestorId: parsePageId(params.ancestorId),
      filters: {
        isDeletedOnly: false,
        excludeTemplates: false,
        navigableBlockContentOnly: true,
        requireEditPermissions: false,
        includePublicPagesWithoutExplicitAccess: false,
        ancestors: [],
        createdBy: [],
        editedBy: [],
        lastEditedTime: {},
        createdTime: {},
        inTeams: [],
        ...params.filters,
      },
      sort: {
        field: 'relevance',
      },
      limit: params.limit || 20,
      source: 'quick_find_input_change',
      searchExperimentOverrides: {},
      searchSessionId: params.searchSessionId,
      searchSessionFlowNumber: 1,
      excludedBlockIds: [],
    };

    console.log("Fetch Request Body:", body);
    return this.fetch<notion.SearchResults>({
      endpoint: 'search',
      body,
      gotOptions,
    });
  }

  public async fetch<T>({
    endpoint,
    body,
    gotOptions,
    headers: clientHeaders,
  }: {
    endpoint: string;
    body: object;
    gotOptions?: OptionsOfJSONResponseBody;
    headers?: any;
  }): Promise<T> {
    const headers: any = {
      ...clientHeaders,
      ...gotOptions?.headers,
      'Content-Type': 'application/json',
    };

    if (this._authToken) {
      headers.cookie = `token_v2=${this._authToken}`;
    }

    if (this._activeUser) {
      headers['x-notion-active-user-header'] = this._activeUser;
    }

    const url = `${this._apiBaseUrl}/${endpoint}`;

    return got
      .post(url, {
        ...gotOptions,
        retry: {
          limit: 2,
          methods: ['POST'],
        },
        json: body,
        headers,
      })
      .json();
  }
}