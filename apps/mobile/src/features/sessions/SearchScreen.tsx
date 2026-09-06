import { useRouter, useFocusEffect } from 'expo-router';
import { definePage } from '@/presentation';
import { useCallback, useState } from 'react';
import { KeyboardAvoidingView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NativeGroupedList, NativeSearchBar } from '@lody-ios/kit';
import { useCatalog } from '@/cloud/CatalogProvider';
import { usePalette } from '@/theme/palette';
import { useAuth } from '@/features/auth/AuthProvider';
import { searchSections } from './inbox';
import { openCatalogRow } from './navigation';

export default function SearchScreen() {
  const { catalog, selected, loading, connected } = useCatalog();
  const { account } = useAuth();
  const colors = usePalette();
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [focused, setFocused] = useState(false);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const close = () => {
    setFocused(false);
    if (router.canGoBack()) router.back();
    else router.navigate('/sessions');
  };
  return (
    <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
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
        onRowPress={({ nativeEvent }) => {
          setFocused(false);
          openCatalogRow(nativeEvent.id, catalog);
        }}
      />
      <View
        style={{
          paddingHorizontal: 20,
          paddingTop: 8,
          paddingBottom: Math.max(insets.bottom, 12),
        }}
      >
        <NativeSearchBar
          style={{ height: 52 }}
          focused={focused}
          placeholder={selected ? `搜索 ${selected.name}` : '搜索项目或会话'}
          onQueryChange={({ nativeEvent }) => setQuery(nativeEvent.text)}
          onClose={close}
        />
      </View>
    </KeyboardAvoidingView>
  );
}
export const searchPage = definePage({
  id: 'search',
  title: '',
  Component: SearchScreen,
});
