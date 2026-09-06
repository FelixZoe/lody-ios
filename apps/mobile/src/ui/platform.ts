import { Platform } from 'react-native';

/** iOS 26 introduced the glass material behind sheets and bars. */
export const isIOS26 = Number.parseInt(String(Platform.Version), 10) >= 26;
