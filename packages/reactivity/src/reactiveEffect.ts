import { isArray, isIntegerKey, isMap, isSymbol } from '@vue/shared'
import { DirtyLevels, type TrackOpTypes, TriggerOpTypes } from './constants'
import { type Dep, createDep } from './dep'
import {
  activeEffect,
  pauseScheduling,
  resetScheduling,
  shouldTrack,
  trackEffect,
  triggerEffects,
} from './effect'

type KeyToDepMap = Map<any, Dep>
/**
 * 主 WeakMap，用于存储 { target -> key -> dep } 连接。
 *
 * 从概念上讲，将依赖项视为一个维护订阅者集合的 Dep 类会更容易理解，
 * 但我们选择将其简单地存储为原始 Map，以减少内存开销。
 */
const targetMap = new WeakMap<object, KeyToDepMap>()

export const ITERATE_KEY = Symbol(__DEV__ ? 'iterate' : '')
export const MAP_KEY_ITERATE_KEY = Symbol(__DEV__ ? 'Map key iterate' : '')

/**
 * 跟踪对响应式属性的访问。
 *
 * 这将检查当前运行的是哪个效应，并将其记录为依赖项（dep），该依赖项记录了所有依赖于该响应式属性的效应。
 *
 * @param target - 持有响应式属性的对象。
 * @param type - 定义对响应式属性的访问类型。
 * @param key - 要跟踪的响应式属性的标识符。
 */
export function track(target: object, type: TrackOpTypes, key: unknown) {
  if (shouldTrack && activeEffect) {
    // 获取目标对象对应的依赖项,
    let depsMap = targetMap.get(target)
    // 当前无记录
    if (!depsMap) {
      // 建立新记录,键为target,值为 { key => 依赖项 } 集合
      targetMap.set(target, (depsMap = new Map()))
    }

    // 获取键对应的依赖项
    let dep = depsMap.get(key)
    // 当前无记录
    if (!dep) {
      // 建立新纪录
      depsMap.set(key, (dep = createDep(() => depsMap!.delete(key))))
    }

    /**
     * targetMap: [[target, depsMap]]
     * depsMap: [[key, dep]]
     * dep: [[]]
     */

    trackEffect(activeEffect, dep, void 0)
  }
}

/**
 * Finds all deps associated with the target (or a specific property) and
 * triggers the effects stored within.
 *
 * @param target - The reactive object.
 * @param type - Defines the type of the operation that needs to trigger effects.
 * @param key - Can be used to target a specific reactive property in the target object.
 */
export function trigger(
  target: object,
  type: TriggerOpTypes,
  key?: unknown,
  newValue?: unknown,
  oldValue?: unknown,
  oldTarget?: Map<unknown, unknown> | Set<unknown>,
) {
  const depsMap = targetMap.get(target)
  if (!depsMap) {
    // never been tracked
    return
  }

  let deps: (Dep | undefined)[] = []
  if (type === TriggerOpTypes.CLEAR) {
    // collection being cleared
    // trigger all effects for target
    deps = [...depsMap.values()]
  } else if (key === 'length' && isArray(target)) {
    const newLength = Number(newValue)
    depsMap.forEach((dep, key) => {
      if (key === 'length' || (!isSymbol(key) && key >= newLength)) {
        deps.push(dep)
      }
    })
  } else {
    // schedule runs for SET | ADD | DELETE
    if (key !== void 0) {
      deps.push(depsMap.get(key))
    }

    // also run for iteration key on ADD | DELETE | Map.SET
    switch (type) {
      case TriggerOpTypes.ADD:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        } else if (isIntegerKey(key)) {
          // new index added to array -> length changes
          deps.push(depsMap.get('length'))
        }
        break
      case TriggerOpTypes.DELETE:
        if (!isArray(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
          if (isMap(target)) {
            deps.push(depsMap.get(MAP_KEY_ITERATE_KEY))
          }
        }
        break
      case TriggerOpTypes.SET:
        if (isMap(target)) {
          deps.push(depsMap.get(ITERATE_KEY))
        }
        break
    }
  }

  pauseScheduling()
  for (const dep of deps) {
    if (dep) {
      triggerEffects(
        dep,
        DirtyLevels.Dirty,
        __DEV__
          ? {
              target,
              type,
              key,
              newValue,
              oldValue,
              oldTarget,
            }
          : void 0,
      )
    }
  }
  resetScheduling()
}

export function getDepFromReactive(object: any, key: string | number | symbol) {
  return targetMap.get(object)?.get(key)
}
