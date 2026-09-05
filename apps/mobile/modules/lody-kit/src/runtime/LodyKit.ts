import { NativeModule, requireNativeModule } from 'expo';

export interface RuntimeInfo {
  moduleName: string;
  systemVersion: string;
}
export type DataRuntimeEvent = {
  sessionId?: string;
  session?: string;
  owner: string;
  generation: number;
  state: string;
  reason: string;
  acknowledgements: number;
  lastStartReason?: string;
  catalog?: string;
  revision?: number;
};
type Events = {
  onAppActive: () => void;
  onDataRuntime: (event: DataRuntimeEvent) => void;
};
declare class LodyKitNativeModule extends NativeModule<Events> {
  readonly runtimeInfo: RuntimeInfo;
  watchSession(id: string): Promise<void>;
  unwatchSession(id: string): Promise<void>;
  sendSessionTurn(payload: string): Promise<string>;
  watchCatalog(workspace: string, owner: string): Promise<void>;
  unwatchCatalog(owner: string): Promise<void>;
  dataRuntimeStatus(): Promise<DataRuntimeEvent>;
  debugHangDataRuntime(): Promise<void>;
  debugRestartDataRuntime(): Promise<void>;
  selectionFeedback(): Promise<void>;
  readAuthToken(): Promise<string | null>;
  saveAuthToken(token: string): Promise<void>;
  clearAuthToken(): Promise<void>;
  openAuthBrowser(url: string): Promise<void>;
  closeAuthBrowser(): Promise<void>;
  decodeFlock(
    snapshot: string,
    updates: string[],
    mode: string,
  ): Promise<string>;
}
const native = requireNativeModule<LodyKitNativeModule>('LodyKit');
export const runtimeInfo = native.runtimeInfo;
export function selectionFeedback(): Promise<void> {
  return native.selectionFeedback();
}
export function addAppActiveListener(listener: () => void) {
  return native.addListener('onAppActive', listener);
}

export const readAuthToken = () => native.readAuthToken();
export const saveAuthToken = (token: string) => native.saveAuthToken(token);
export const clearAuthToken = () => native.clearAuthToken();
export const openAuthBrowser = (url: string) => native.openAuthBrowser(url);
export const closeAuthBrowser = () => native.closeAuthBrowser();
export const decodeFlock = (
  snapshot: string,
  updates: string[],
  mode: string,
) => native.decodeFlock(snapshot, updates, mode);

export const watchCatalog = (workspace: string, owner: string) =>
  native.watchCatalog(workspace, owner);
export const unwatchCatalog = (owner: string) => native.unwatchCatalog(owner);
export const addDataRuntimeListener = (
  listener: (event: DataRuntimeEvent) => void,
) => native.addListener('onDataRuntime', listener);
export const dataRuntimeStatus = () => native.dataRuntimeStatus();
export const debugHangDataRuntime = () => native.debugHangDataRuntime();
export const debugRestartDataRuntime = () => native.debugRestartDataRuntime();

export const watchSession = (id: string) => native.watchSession(id);
export const unwatchSession = (id: string) => native.unwatchSession(id);
export const sendSessionTurn = (payload: string) =>
  native.sendSessionTurn(payload);
