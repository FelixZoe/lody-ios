import { StyleSheet, View } from 'react-native';
import { NativeSymbolButton } from '@lody-ios/kit';
import { usePalette } from '@/theme/palette';
import { AppText } from '@/ui/AppText';

export function workedLabel({
  timestamp,
  endedAt,
  permissionWaitMs,
}: {
  timestamp?: string;
  endedAt?: number;
  permissionWaitMs?: number;
}) {
  const started = timestamp ? Date.parse(timestamp) : Number.NaN;
  if (!endedAt || Number.isNaN(started)) return '进行中';
  const seconds = Math.max(
    0,
    Math.round((endedAt - started - (permissionWaitMs ?? 0)) / 1000),
  );
  const minutes = Math.floor(seconds / 60);
  return minutes
    ? `已工作 ${minutes} 分 ${seconds % 60} 秒`
    : `已工作 ${seconds} 秒`;
}

export function TurnHeader({
  timestamp,
  endedAt,
  permissionWaitMs,
  onCopy,
}: {
  timestamp?: string;
  startedAt?: number;
  endedAt?: number;
  permissionWaitMs?: number;
  onCopy: () => void;
}) {
  const colors = usePalette();
  const time = timestamp
    ? new Date(timestamp).toLocaleTimeString('zh-CN', {
        hour: '2-digit',
        minute: '2-digit',
      })
    : '';
  return (
    <View
      style={{
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: colors.separator,
        paddingBottom: 6,
      }}
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'flex-end',
          gap: 4,
        }}
      >
        <AppText variant="meta">{time}</AppText>
        <NativeSymbolButton
          accessibilityName="复制这一轮"
          symbol="doc.on.doc"
          tint="secondary"
          onPress={onCopy}
          style={{ width: 44, height: 44 }}
        />
      </View>
      <AppText variant="meta">
        {workedLabel({ timestamp, endedAt, permissionWaitMs })}
      </AppText>
    </View>
  );
}
