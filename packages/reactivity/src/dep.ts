import type { ReactiveEffect } from './effect'
import type { ComputedRefImpl } from './computed'

export type Dep = Map<ReactiveEffect, number> & {
  cleanup: () => void
  computed?: ComputedRefImpl<any>
}

/**
 * 创建依赖集合
 * @param cleanup
 * @param computed 是否为计算属性
 * @returns
 */
export const createDep = (
  cleanup: () => void,
  computed?: ComputedRefImpl<any>,
): Dep => {
  const dep = new Map() as Dep
  dep.cleanup = cleanup
  dep.computed = computed
  return dep
}
