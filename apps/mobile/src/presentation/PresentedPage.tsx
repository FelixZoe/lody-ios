import {
  type NativeStackNavigationOptions,
  router,
  Stack,
  useLocalSearchParams,
  useNavigation,
} from 'expo-router';
import {
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { NativeCloseButton } from '@lody-ios/kit';
import type { ColorValue } from 'react-native';
import { softScrollEdgeEffects } from '@/ui/Screen';

import {
  type PageDefinitionBase,
  type PageFinish,
  type PagePresentationStyle,
  type PageRuntime,
  PageRuntimeProvider,
} from './page';
import {
  cancelPresentation,
  completePresentation,
  getPresentationSession,
  present,
  type PresentationSession,
} from './presentationStore';

export const presentationHeaderHeight = 52;

function first(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function parsePresentationId(
  value: string | string[] | undefined,
): number | null {
  const parsed = Number(first(value));
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

function dismissPresentedPage(): void {
  if (router.canDismiss()) {
    router.dismiss();
    return;
  }
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

function nativePresentationStyle(style: PagePresentationStyle) {
  switch (style) {
    case 'push': {
      return 'card' as const;
    }
    case 'formSheet': {
      return 'formSheet' as const;
    }
    case 'fullScreen': {
      return 'fullScreenModal' as const;
    }
    case 'overFullScreen': {
      return 'transparentModal' as const;
    }
    case 'pageSheet': {
      return 'pageSheet' as const;
    }
  }
}

function nativeAnimation(animationType: 'fade' | 'none' | 'slide') {
  switch (animationType) {
    case 'fade': {
      return 'fade' as const;
    }
    case 'none': {
      return 'none' as const;
    }
    case 'slide': {
      return 'slide_from_bottom' as const;
    }
  }
}

export function nativePresentationOptions(
  routeParams: Readonly<object | undefined>,
  backgroundColor: ColorValue,
): NativeStackNavigationOptions {
  const rawId =
    routeParams && 'presentationId' in routeParams
      ? routeParams.presentationId
      : undefined;
  const presentationId =
    typeof rawId === 'string' || Array.isArray(rawId)
      ? parsePresentationId(rawId as string | string[])
      : null;
  const session =
    presentationId === null
      ? undefined
      : getPresentationSession(presentationId);

  if (!session) {
    return {
      contentStyle: { backgroundColor: backgroundColor },
      headerShown: false,
      presentation: 'formSheet',
    };
  }

  const { animationType, dismissible, headerShown, headerVariant, style } =
    session.presentation;
  const formSheet = style === 'formSheet';
  const transparentHeader = headerVariant === 'transparent';

  return {
    animation: style === 'push' ? 'default' : nativeAnimation(animationType),
    contentStyle: {
      backgroundColor:
        style === 'overFullScreen' ? 'transparent' : backgroundColor,
    },
    gestureEnabled: dismissible,
    headerBackVisible: style === 'push' && dismissible,
    headerBackButtonDisplayMode: 'minimal',
    headerShadowVisible: false,
    scrollEdgeEffects: softScrollEdgeEffects,
    headerShown,
    headerStyle: transparentHeader
      ? { backgroundColor: 'transparent' }
      : undefined,
    headerTransparent: transparentHeader,
    presentation: nativePresentationStyle(style),
    sheetAllowedDetents: formSheet
      ? session.presentation.sheetAllowedDetents
      : undefined,
    sheetGrabberVisible: formSheet
      ? session.presentation.sheetGrabberVisible
      : undefined,
    sheetInitialDetentIndex: formSheet
      ? session.presentation.sheetInitialDetentIndex
      : undefined,
    title: session.page.title,
  };
}

function usePresentedPageSession(expectedPage?: PageDefinitionBase) {
  const routeParams = useLocalSearchParams<{
    presentationId?: string | string[];
  }>();
  const navigation = useNavigation();
  const presentationId = parsePresentationId(routeParams.presentationId);
  const [session] = useState<PresentationSession | null>(() =>
    presentationId === null
      ? null
      : (getPresentationSession(presentationId) ?? null),
  );

  useEffect(() => {
    if (!session) {
      dismissPresentedPage();
      return;
    }

    const unsubscribe = navigation.addListener('beforeRemove', () => {
      cancelPresentation(session.id);
    });
    return () => {
      unsubscribe();
      cancelPresentation(session.id);
    };
  }, [navigation, session]);

  if (session && expectedPage && session.page.id !== expectedPage.id) {
    throw new Error(
      `Presentation route expected page "${expectedPage.id}" but received "${session.page.id}".`,
    );
  }

  const cancel = useCallback(() => {
    if (!session) return;
    cancelPresentation(session.id);
    dismissPresentedPage();
  }, [session]);
  const finish = useCallback(
    (value?: unknown) => {
      if (!session) return;
      completePresentation(session.id, value);
      dismissPresentedPage();
    },
    [session],
  ) as PageFinish<unknown>;
  const runtime = useMemo<PageRuntime<unknown, unknown> | null>(
    () =>
      session
        ? {
            cancel,
            finish,
            params: session.params,
            present,
            source: 'presentation',
          }
        : null,
    [cancel, finish, session],
  );

  return { runtime, session };
}

export function PresentedPageProvider({
  children,
  page,
}: {
  children: ReactNode;
  page: PageDefinitionBase;
}) {
  const { runtime } = usePresentedPageSession(page);
  if (!runtime) return null;
  return <PageRuntimeProvider value={runtime}>{children}</PageRuntimeProvider>;
}

export function PresentedPageRoute() {
  const { runtime, session } = usePresentedPageSession();
  if (!runtime || !session) return null;
  const { Component } = session.page;
  const showCloseItem =
    session.presentation.style !== 'push' &&
    session.presentation.headerShown &&
    session.presentation.dismissible;

  return (
    <>
      {showCloseItem ? (
        <Stack.Screen
          options={{
            headerRight: () => (
              <NativeCloseButton
                label={`关闭${session.page.title}`}
                onPress={runtime.cancel}
                style={{ width: 44, height: 44 }}
              />
            ),
          }}
        />
      ) : null}
      <PageRuntimeProvider value={runtime}>
        <Component />
      </PageRuntimeProvider>
    </>
  );
}
