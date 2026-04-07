import * as React from 'react';
import * as types from 'notion-types';
import { getBlockCollectionId, getBlockParentPage, getTextContent } from 'notion-utils';
import { useLocalStorage, useWindowSize } from 'react-use';
import * as DropdownMenu from '@radix-ui/react-dropdown-menu';

import { CollectionRow } from './collection-row';
import { CollectionViewIcon } from '../icons/collection-view-icon';
import CheckIcon from '../icons/check';
import { ChevronDownIcon } from '../icons/chevron-down-icon';
import { CollectionView } from './collection-view';
import { PropertyImplMemo } from './property';
import { PageIcon } from '../components/page-icon';
import { NotionContext, NotionContextProvider, useNotionContext } from '../context';
import { cs } from '../utils';

const isServer = typeof window === 'undefined';

export const Collection: React.FC<{
  block: types.CollectionViewBlock | types.CollectionViewPageBlock | types.PageBlock;
  className?: string;
  ctx: NotionContext;
}> = ({ block: rawBlock, className, ctx }) => {
  // 💡 [AaRC 핵심 패치 1] 노션 API 응답 데이터가 { value: { value: ... } } 구조인 경우 껍질을 벗깁니다.
  let block = rawBlock as any;
  if (block && block.value) {
    block = block.value;
  }

  // 데이터 무결성 검사: block 데이터가 없으면 렌더링하지 않습니다.
  if (!block || !block.type) {
    return null;
  }

  const context: NotionContext = React.useMemo(
    () => ({
      ...ctx,
    }),
    [ctx],
  );

  if (block.type === 'page') {
    if (block.parent_table !== 'collection') {
      return null;
    }

    return (
      <NotionContextProvider {...context}>
        <div className="notion-collection-page-properties">
          <CollectionRow block={block as types.PageBlock} pageHeader={true} className={className} />
        </div>
      </NotionContextProvider>
    );
  } else {
    return (
      <NotionContextProvider {...context}>
        <CollectionViewBlock block={block} className={className} />
      </NotionContextProvider>
    );
  }
};

const CollectionViewBlock: React.FC<{
  block: types.CollectionViewBlock | types.CollectionViewPageBlock;
  className?: string;
}> = ({ block, className }) => {
  const { recordMap, showCollectionViewDropdown } = useNotionContext();
  const { view_ids: viewIds } = block;
  const collectionId = getBlockCollectionId(block, recordMap);

  const [isMounted, setIsMounted] = React.useState(false);
  React.useEffect(() => {
    setIsMounted(true);
  }, []);

  const defaultCollectionViewId = viewIds[0];
  const [collectionState, setCollectionState] = useLocalStorage(block.id, {
    collectionViewId: defaultCollectionViewId,
  });

  const collectionViewId =
    (isMounted && viewIds.find(id => id === collectionState.collectionViewId)) ||
    defaultCollectionViewId;

  const onChangeView = React.useCallback(
    (collectionViewId: string) => {
      setCollectionState({
        ...collectionState,
        collectionViewId,
      });
    },
    [collectionState, setCollectionState],
  );

  let { width: windowWidth } = useWindowSize();
  if (isServer) {
    windowWidth = 1024;
  }

  const collection = recordMap.collection[collectionId]?.value;
  const collectionView = recordMap.collection_view[collectionViewId]?.value;
  const collectionData = recordMap.collection_query[collectionId]?.[collectionViewId];
  const parentPage = getBlockParentPage(block, recordMap);

  const { style, width, padding } = React.useMemo(() => {
    const style: React.CSSProperties = {};

    if (collectionView?.type !== 'table' && collectionView?.type !== 'board') {
      return { style, width: 0, padding: 0 };
    }

    const width = windowWidth;
    const maxNotionBodyWidth = isServer
      ? 100
      : +getComputedStyle(document.documentElement)
          .getPropertyValue('--notion-max-width')
          .replace('px', '');
    let notionBodyWidth = maxNotionBodyWidth;

    if (parentPage?.format?.page_full_width) {
      notionBodyWidth = (width - 2 * Math.min(96, width * 0.08)) | 0;
    } else {
      notionBodyWidth =
        width < maxNotionBodyWidth
          ? (width - width * 0.02) | 0
          : maxNotionBodyWidth;
    }

    const padding = isServer && !isMounted ? 96 : ((width - notionBodyWidth) / 2) | 0;
    style.paddingLeft = padding;
    style.paddingRight = padding;

    return { style, width, padding };
  }, [windowWidth, parentPage, collectionView?.type, isMounted]);

  if (!(collection && collectionView && collectionData)) {
    return null;
  }

  const title = getTextContent(collection.name).trim();
  if (collection.icon) {
    block.format = {
      ...block.format,
      page_icon: collection.icon,
    };
  }

  return (
    <div className={cs('notion-collection', className)}>
      <div className="notion-collection-header" style={style}>
        {title && (
          <div className="notion-collection-header-title">
            <PageIcon block={block} className="notion-page-title-icon" hideDefaultIcon />
            {title}
          </div>
        )}

        {viewIds.length > 1 && showCollectionViewDropdown && (
          <CollectionViewDropdownMenu
            collectionView={collectionView}
            collectionViewId={collectionViewId}
            viewIds={viewIds}
            onChangeView={onChangeView}
          />
        )}
      </div>

      <CollectionView
        collection={collection}
        collectionView={collectionView}
        collectionData={collectionData}
        padding={padding}
        width={width}
      />
    </div>
  );
};

// 💡 [AaRC 핵심 패치 2] 탭과 드롭다운을 자유롭게 전환하는 하이브리드 메뉴
const CollectionViewDropdownMenu: React.FC<{
  collectionViewId: string;
  collectionView: types.CollectionView;
  viewIds: string[];
  onChangeView: (viewId: string) => unknown;
}> = ({ collectionViewId, collectionView, viewIds, onChangeView }) => {
  const { recordMap } = useNotionContext();
  const [isTabMode, setIsTabMode] = React.useState(false);

  // NotionPage.tsx에서 설정한 'arc-use-tabs' 클래스가 감지되면 탭 모드로 전환합니다.
  React.useEffect(() => {
    const isTab = !!document.querySelector('.arc-use-tabs');
    setIsTabMode(isTab);
  }, []);

  // 1️⃣ [나열형 탭 모드]
  if (isTabMode) {
    return (
      <div className="arc-collection-tabs-row">
        {viewIds.map((viewId) => {
          const view = recordMap.collection_view[viewId]?.value;
          if (!view) return null;
          const name = view.name || `${view.type[0].toUpperCase()}${view.type.slice(1)} view`;
          const isActive = collectionViewId === viewId;

          return (
            <div
              key={viewId}
              className={cs('arc-tab-item', isActive && 'arc-tab-item-active')}
              onClick={() => onChangeView(viewId)}
            >
              <span className="arc-tab-title">{name}</span>
            </div>
          );
        })}
      </div>
    );
  }

  // 2️⃣ [드롭다운 모드] (기존 안정적인 드롭다운 구조 유지)
  return (
    <DropdownMenu.Root>
      <DropdownMenu.Trigger className="notion-collection-view-dropdown">
        <CollectionViewColumnDesc collectionView={collectionView}>
          <ChevronDownIcon className="notion-collection-view-dropdown-icon" />
        </CollectionViewColumnDesc>
      </DropdownMenu.Trigger>

      <DropdownMenu.Content className="notion-collection-view-dropdown-content">
        <DropdownMenu.RadioGroup value={collectionViewId} onValueChange={onChangeView}>
          {viewIds.map(viewId => (
            <DropdownMenu.RadioItem
              key={viewId}
              value={viewId}
              className={cs(
                'notion-collection-view-dropdown-content-item',
                collectionViewId === viewId &&
                  'notion-collection-view-dropdown-content-item-active',
              )}
            >
              {collectionViewId === viewId && (
                <div className="notion-collection-view-dropdown-content-item-active-icon">
                  <CheckIcon />
                </div>
              )}
              <CollectionViewColumnDesc collectionView={recordMap.collection_view[viewId]?.value} />
            </DropdownMenu.RadioItem>
          ))}
        </DropdownMenu.RadioGroup>
      </DropdownMenu.Content>
    </DropdownMenu.Root>
  );
};

const CollectionViewColumnDesc: React.FC<{
  collectionView: types.CollectionView;
  className?: string;
  children?: React.ReactNode;
}> = ({ collectionView, className, children, ...rest }) => {
  const { type } = collectionView;
  const name = collectionView.name || `${type[0].toUpperCase()}${type.slice(1)} view`;

  return (
    <div className={cs('notion-collection-view-type', className)} {...rest}>
      <CollectionViewIcon className="notion-collection-view-type-icon" type={type} />
      <span className="notion-collection-view-type-title">{name}</span>
      {children}
    </div>
  );
};

export { PropertyImplMemo as Property };