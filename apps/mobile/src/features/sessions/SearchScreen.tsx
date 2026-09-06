import { Stack } from 'expo-router';
import { useState } from 'react';
import { NativeGroupedList } from '@lody-ios/kit';
import { useCatalog } from '@/cloud/CatalogProvider';
import { usePalette } from '@/theme/palette';
import { useAuth } from '@/features/auth/AuthProvider';
import { searchSections } from './inbox';
import { openCatalogRow } from './navigation';

export default function SearchScreen() {
  const { catalog, loading, connected } = useCatalog();
  const { account } = useAuth();
  const colors = usePalette();
  const [query, setQuery] = useState('');
  return (
    <>
      <Stack.SearchBar
        placement="automatic"
        placeholder="搜索项目或会话"
        hideWhenScrolling={false}
        onChangeText={({ nativeEvent }) => setQuery(nativeEvent.text)}
        onCancelButtonPress={() => setQuery('')}
      />
      <NativeGroupedList
        style={{ flex: 1 }}
        accent={colors.accent}
        sections={account ? searchSections(catalog, query, colors.accent) : []}
        placeholder={
          !account
            ? '登录后搜索你的项目和会话'
            : !query.trim()
              ? '搜索当前工作区的项目和会话，包括已归档会话'
              : loading
                ? '正在载入…'
                : !connected
                  ? '连接已中断，请在会话页重新同步'
                  : '没有匹配的项目或会话'
        }
        onRowPress={({ nativeEvent }) =>
          openCatalogRow(nativeEvent.id, catalog)
        }
      />
    </>
  );
}
