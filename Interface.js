/**
 * MIT License

 * Copyright (c) 2018 krunZhang

 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:

 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.

 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

/**
 * author: krun
 * email: krunZhang@gmail.com
 * date: 2018-05-23
 *
 * 这是一个用于在 JS 中提供 "接口" 概念部分能力的工具。
 * 已经实现了
 *    继承 .....（从指定接口处拷贝方法声明和默认实现）
 *    声明方法 ..（指定方法名称、参数列表（可以通过 support 方法做类型检查或更详细细致的调用前检查）、默认实现、方法 id（如果该方法需要重载的话））
 *    实现方法 ..（挂载一个代理函数到对象上，同时依此实现了重载一样的效果，重载效果必须通过 implement 方法显式实现方法）
 *    实现检查 ..（扫描方法注册声明，将所有的默认实现都通过代理挂载到指定对象上，如果是类定义中已经存在，则会找到对应的声明并将其替换为代理函数）
 *    一些日志 ..（创建接口时指定 debug 开启，可以得到一些日志，包括方法注册、接口实现检查、方法调用时匹配实现情况、方法调用前参数检查）
 */
class Interface {

  constructor(config) {
    let {name, debug} = config

    if (name === '') {
      throw new Error('创建接口时必须给定一个名称!')
    }
    this.name = name || ''
    this.debug = debug || false
    this.methods = {}
    this.tag = 'Interface '
  }

  console(type) {
    if (this.debug) {
      return console[type]
    } else {
      return () => {}
    }
  }

  method(config) {
    const self = this
    let {name, args, implement, owner, id} = config

    /* args 比较特殊，当它为 null 时表示接受任何类型（同时也不限制参数数量），为undefined 时视为一个空数组，即无参数.*/
    args = args === undefined ? [] : args

    owner = owner ? [self.name, owner].join(' extends ') : self.name

    if (self.debug) {
      if (typeof name !== 'string') {
        throw new Error(`${self.tag}类型错误: 方法名称 (config.name) 必须为字符串类型!`)
      }

      if (args !== null && !Array.isArray(args)) {
        throw new Error(`${self.tag}类型错误: 方法参数列表 (config.args) 必须为数组类型!`)
      }

      if (implement && (typeof implement !== 'function')) {
        throw new Error(`${self.tag}类型错误: 方法的默认实现必须为函数类型!`)
      }
    }
    self.console('info')(`${self.tag}注册方法: ${(id !== undefined && id !== null) ? `[${id}]` : ''}${owner}.${name}(${args === null ? 'any' : args.map(arg => `${arg.name} :${arg.type}`).join(', ')})`)

    /* 获取签名列表并保存 */
    let signs = self.methods[name]

    if (signs === undefined) {
      signs = (self.methods[name] = [])
    }

    const method = { id, owner, args, implement }
    signs.push(method)
    return self
  }

  implement(config) {
    const self = this

    let {object, name, implement, id} = config
    const useDefaultImplement = implement === undefined || implement === null

    if (self.debug) {
      if (typeof name !== 'string') {
        throw new Error(`${self.tag}类型错误: 方法名必须为字符串类型!`)
      }

      if (!useDefaultImplement && (typeof implement !== 'function')) {
        throw new Error(`${self.tag}类型错误: 方法默认实现必须为函数类型! (${typeof implement})`)
      }
    }

    const prototype = object.__proto__

    /* 如果指定了 id，则需要找到该方法下特定id的签名并覆写其实现 */
    /* id 从 0 开始，因此不能将判断语句简写为 if (id) { ... } */
    let sign;
    if (id !== undefined && id !== null) {
      sign = self.methods[name].filter(method => method.id === id)
      if (sign.length === 0) {
        throw new Error(`${self.tag}实现错误: 找不到 ${id ? '[' + id + ']' : ''}${self.name}.${name} 实现`)
      }
    } else {
      sign = self.methods[name]
      if (sign.length > 1) {
        console.dir(sign)
        throw new Error(`${self.tag}实现错误: 找到多个 ${id ? '[' + id + ']' : ''}${self.name}.${name} 声明`)
      }
    }
    // FIX: 未指定 id 时没有保存实现
    sign = sign[0]
    sign.implement = implement
    self.console('info')(`${self.tag}实现方法: 保存 ${self.name}.${name}(...) 实现:`)
    self.console('dir')(useDefaultImplement ? '默认实现' : implement)

    /* 绑定一个代理函数，内部查找匹配实现并转发 call */
    prototype[name] = function() {
      return (useDefaultImplement ? self.findImplement(name, arguments) : implement).apply(object, arguments)
    }
    return self
  }

  extends(otherInterfaces) {
    const self = this
    if (!Array.isArray(otherInterfaces)) {
      otherInterfaces = [otherInterfaces]
    }

    otherInterfaces.forEach(i => {
      Object.keys(i.methods).forEach(method => {
        (i.methods[method] || []).forEach(sign => {
          self.method({
            id: sign.id,
            name: method,
            args: sign.args,
            implement: sign.implement,
            owner: sign.owner
          })
        })
      })
    })

    return this
  }

  findImplement(name, args) {
    const self = this
    const signs = self.methods[name]
    console.dir(self)
    console.dir(signs)
    if (signs === undefined || signs === null) {
      throw new Error(`${self.tag}匹配方法失败: 没有注册方法! ${self.name}.${name}(...)`)
    }

    if (signs.length === 0) {
      throw new Error(`${self.tag}匹配方法失败: 没有实现方法! ${self.name}.${name}(...)`)
    }

    let anyArgsImplement = null
    /* 遍历实现，找到符合条件的那个 */
    for (let i = 0; i < signs.length; i++) {
      let sign = signs[i]
      /* 检查是否有匹配 any 参数列表的实现，如果有先保存下来，优先匹配参数数量、类型对应的实现 */
      let anyArgs = sign.args === null
      if (anyArgs && sign.implement) {
        anyArgsImplement = sign.implement
      } else {
        if (args.length !== sign.args.length) {
          /* 跳过参数数量不匹配的实现 */
          continue
        }
        /* 计数匹配的参数数量 */
        let counter = 0
        for (let i = 0; i < args.length; i++) {
          let arg = args[i]
          let signArg = sign.args[i]
          if (signArg.support === undefined || signArg.support === null) {
            throw new Error(`${self.tag}匹配异常: 接口方法 ${self.getSignDescription(self.name, sign)} 中参数 arg${i} 没有实现 support 方法以供调用检查!`)
          }
          if (self.debug) {
            if (typeof signArg.support !== 'function') {
              throw new Error(`${self.tag}匹配异常: 接口方法 ${self.getSignDescription(self.name, sign)} 中参数 arg${i} 的 support 值必须为一个函数!`)
            }
          }
          if (signArg.support(arg)) {
            counter ++
          } else if (self.debug) {
            /* 因为此时方法的预期参数长度与实际参数长度一致，一般情况下可能只是传入的东西错了，因此可以提出一个警告以帮助修正，在 support 中可以对复杂的对象进行详细检查，视情况抛出异常*/
            self.console('warn')(`${self.tag}匹配方法参数: ${self.getSignDescription(self.name, sign)} Arguments[${i}] 不支持 ${JSON.stringify(arg)}`)
          }
        }
        /* 返回参数整体匹配的方法 */
        if (counter === args.length && sign.implement !== undefined) {
          self.console('info')(`${self.tag}方法匹配: 精准匹配\n${self.name}.${name}(${args ? Array.prototype.map.call(args, (arg, index) => `{ ${sign.args[index].name}: ${JSON.stringify(arg)} } :${sign.args[index].type}`).join(', ') : ''}).`)
          self.console('dir')(sign.implement)
          return sign.implement
        }
      }
    }

    if (anyArgsImplement) {
      self.console('warn')(`${self.tag}方法匹配: 无法精准匹配 ${self.name}.${name}(${args ? Array.prototype.map.call(args, arg => JSON.stringify(arg)).join(', ') : ''})，使用 any 实现匹配:`)
      self.console('dir')(anyArgsImplement)
      return anyArgsImplement
    }

    throw new Error(`${self.tag}方法匹配失败: 无法匹配方法，同时没有 any 实现. ${self.name}.${name}(${args ? Array.prototype.map.call(args, arg => JSON.stringify(arg)).join(', ') : ''})`)
  }

  getSignDescription(name, sign) {
    return `${sign.owner}.${name}(${sign.args === null ? 'any' : (Array.prototype.map.call(sign.args, arg => `${arg.name} :${arg.type}`).join(', '))})`
  }

  ensureImplements(object) {
    const self = this
    const prototype = object.prototype || object.__proto__
    Object.keys(this.methods).forEach(method => {
      if (!prototype[method] && self.methods[method].length === 0) {
        throw new Error(`${self.tag}方法匹配失败: ${self.name}.${method}(...) 没有实例实现，也没用默认实现!`)
      }
      self.implement({
        object,
        name: method,
        // Fix: 使用定义方法或是使用一个默认方法
        implement: prototype[method] || self.methods[method][0].implement
      })
    })
  }
}

export default Interface
