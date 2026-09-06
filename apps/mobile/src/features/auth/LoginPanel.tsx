import { ActivityIndicator, Image, Pressable, Text, View } from 'react-native';
import { usePalette } from '@/theme/palette';
import { useAuth } from './AuthProvider';
import { Button } from '@/ui/Button';
export function LoginPanel() {
  const auth = useAuth(),
    colors = usePalette();
  return (
    <View style={{ gap: 24, paddingTop: 20 }}>
      <Image
        accessibilityIgnoresInvertColors
        accessible
        accessibilityLabel="Lody"
        source={require('../../../assets/logo.png')}
        style={{ width: 56, height: 56 }}
      />
      <View style={{ gap: 12 }}>
        <Text
          style={{
            color: colors.label,
            fontSize: 24,
            fontWeight: '700',
            lineHeight: 32,
            letterSpacing: -0.7,
          }}
        >
          把工作，带在身边。
        </Text>
        <Text
          style={{ color: colors.secondaryLabel, fontSize: 16, lineHeight: 25 }}
        >
          连接 Lody，查看项目进展，{'\n'}与电脑上的智能助手继续对话。
        </Text>
      </View>
      {auth.code ? (
        <View
          style={{
            padding: 20,
            borderRadius: 20,
            backgroundColor: colors.card,
            gap: 12,
          }}
        >
          <Text style={{ color: colors.secondaryLabel }}>
            请在授权页面核对代码
          </Text>
          <Text
            selectable
            style={{
              color: colors.label,
              fontFamily: 'Menlo',
              fontSize: 28,
              fontWeight: '600',
            }}
          >
            {auth.code.user_code}
          </Text>
          <Button onPress={() => void auth.reopen()}>重新打开授权页面</Button>
        </View>
      ) : null}
      {auth.busy ? (
        <View style={{ gap: 12, alignItems: 'center' }}>
          <ActivityIndicator color={colors.accent} />
          <Text style={{ color: colors.secondaryLabel }}>
            {auth.code ? '等待浏览器确认授权…' : '正在连接…'}
          </Text>
          <Button testID="auth-cancel" onPress={auth.cancel}>
            取消
          </Button>
        </View>
      ) : (
        <Pressable
          testID="auth-login"
          accessibilityRole="button"
          onPress={() => void auth.login()}
          style={{
            minHeight: 54,
            backgroundColor: colors.accent,
            borderRadius: 16,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Text
            style={{ color: colors.onAccent, fontSize: 17, fontWeight: '600' }}
          >
            连接 Lody Cloud　→
          </Text>
        </Pressable>
      )}
      <Text
        style={{ color: colors.secondaryLabel, fontSize: 12, lineHeight: 19 }}
      >
        登录将在官方授权页完成。目前使用 lody-cli
        设备授权，页面会显示该客户端名称。
      </Text>
      {auth.error ? (
        <View>
          <Text style={{ color: colors.danger, lineHeight: 22 }}>
            {auth.error}
          </Text>
          <Button onPress={() => void auth.restore()}>重试连接</Button>
        </View>
      ) : null}
    </View>
  );
}
