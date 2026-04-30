import { IDynamicObject } from '../types/local-cache';

let localCache: IDynamicObject = {};

export const LocalCacheSet = (key: string, value: any): any => {
  localCache[key] = value
}

export const LocalCacheGet = (key: string): any => {
  return localCache[key]
}

export const LocalCacheClear = (): void => {
  localCache = {}
}