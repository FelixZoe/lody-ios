import { uiVerify } from '@/features/debug/uiVerify';
import { Redirect } from 'expo-router';
export default function Index() {
  return <Redirect href={uiVerify ? '/debug' : '/(tabs)/sessions'} />;
}
