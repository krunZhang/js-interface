# js-interface

## 介绍

在做一个前后分离的项目时，有些头疼 Api 之类的东西要怎么管理，在阅读 [《JavaScript 设计模式》](https://www.amazon.cn/gp/product/B00D6MT3LG) 一书时，第二章提到了在 *JavaScript* 中模拟接口 (*interface*) 的概念，以方便使用众多设计模式，因此尝试着做一个接口的模拟。由于我本职是一名后端 *Java* 开发，因此希望在这个模拟层可以加入 **接口默认实现**、**接口继承**、**方法重载** 等能力，虽然这些东西加上之后不可避免得会在性能上有所牺牲，但对我来说可以提升一些开发体验（我知道 *TypeScript*，只是想搞个轮子试试 ：P）。

## 使用

既然初衷是为了方便管理 Api，那么就做一个关于 Api 的 demo。

### 创建一个接口

```javascript
const config = {
    // 接口的名字
    name: 'IApi', 
    // 是否打开此接口的 debug 开关
    // 开发时必须打开，否则不会启动 （方法声明、方法实现等）入参的类型检查。
    // 打开这个的情况下，还会获得一些调试用的信息。
    debug: true，		  
}
let IApi = new Interface(config)
```

### 声明方法

最简单的声明方式：

```javascript
IApi.method({name: 'getName'})
// 等价于
IApi.method({name: 'getName', args: undefined})
```

这样就声明了 `IApi` 接口含有一个 `getName` 方法，它没有任何参数，也没有默认实现，这就要求在后面任何 `IApi` 的子接口或实现类必须实现该方法，否则会抛出一个异常。

---

如果想指定方法的参数列表：

```javascript
IApi.method({ name: 'getName', args: null })
```

**注意！**

`args` 为 `null` 时表示该方法可以接受任意数量的任意参数，如果重载了一个方法（详细的请参阅后面关于重载的说明）：

```javascript
// 声明一个空参方法
IApi.method({ id: 0, name: 'getName', args: null })
// 重载上面的方法，使其有且只有一个 'string' 类型，名为 name 的参数
IApi.method({ id: 1, name: 'getName', args: [
    {name: 'name', type: 'string', support: val => typeof val === 'string'}
] })
```

**注意！**

在参数描述中，`type` 属性**只是一个字符串值，它并不真的代表参数的实际类型。**它跟 `name` 属性一样只是提供用于调试的信息，因此你可以填入任何你认为合适的、足以标记该参数一些信息的字符串值。

真正决定方法是否接受该参数的是 `support` 属性，当它返回 `true` 时会检查下一个参数直到所有参数检查完毕或某个位置的参数不被接受。

如果需要，可以在 `support` 中对实际入参进行特殊处理、比如转换对象、特定属性检查等等。

---

如果想为方法提供默认实现：

```javascript
IApi.method({ 
    name: 'getName', 
    // 默认实现
    implement: function() {
    	return "IApi"   
    }
})
```

---

回到我们的 demo，综合运用一下：

```javascript
// 声明两个方法，它们都没有参数，也不需要重载因此这样就可以了
IApi
  .method({ name: 'getName'  })
  // 项目中使用 Axios，因此这里需要一个方法来获取 axios 实例
  .method({ name: 'getAxios' })

// 声明四个请求方式对应的方法
const methods = ['get', 'post', 'put', 'delete']

methods.forEach(method => {
  IApi.method({
    name: method,
    args: null,
    implement: function() {
      // 处理了 this 指向问题，放心用吧
      return this.getAxios()[method].apply(this, arguments)
        .then(responseHandler)
        .catch(errorHandler)
    }
  })
})
```

### 继承接口

假定我们要创建接口 A，要继承 B、C、D、E 等接口，使用如下语句：

```javascript
const A = new Interface({
    name: 'A',
    debug: true
}).extends([B, C, D, E])
```

`extends` 方法会将传入的接口所持有的所有方法声明（即通过 `Interface.method(config)` 所声明的那些方法 ）拷贝至接口 A，包括那些方法声明的默认实现。

**注意！**

一般来说，不会在多个接口中重载同一个方法签名，但如果真的有这样的需求，可以自行设置 `id` 的规则，比如：

```javascript
const B = new Interface(...)
  .method({ id: 'B00', name: 'getName', args = [...] })
  .method({ id: 'B01', name: 'getName', args = [...] })
				
const C = new Interface(...)
  .method({ id: 'C00', name: 'getName', args = [...] })
```

然后实现该方法时指定要实现哪一个声明：

```javascript
// 注意！如果一个方法被重载，则不能在 class 中声明该方法。
class AImpl { ... } 

const AInstance = new AImpl(...)
B.implement({
	object: AInstance,
    id: 'B00', // 指定要实现的方法声明
    name: 'getName'
})
```

---

再次回到我们的 demo，综合运用一下：

```javascript
const IAuthenticationApi = new Interface({
  name: 'IAuthentication',
  debug: true
})
   // 指明 IAuthenticationApi 继承自 IApi 接口
   .extends(IApi)

IAuthenticationApi
  // 重载方法 login
  // loin (username :string, password :string)
  .method({
    id: 0,
    name: 'login',
    args: [
      {name: 'username', type: 'string', support: val => typeof val === 'string'},
      {name: 'password', type: 'string', support: val => typeof val === 'string'}
    ]
  })
  // login()
  .method({
    id: 1,
    name: 'login'
  })
```

### 实现接口

```javascript
// 编写一个实现类
class AuthenticationApi {
  constructor(axios) { this.axios = axios }
  // 直接实现 getName 方法  
  getName() { return "AuthenticationApi" }
  // 直接实现 getAxios 方法
  getAxios() { return this.axios }
}

// 实现重载方法
IAuthenticationApi
  .implement({
    // 指定挂载实现到 AuthenticationApi 上
    object: AuthenticationApi,
    // 指定此实现是对应 id 为 0 的方法声明
    id: 0,
    name: 'login',
    implement: function(username, password) {
      console.log('带参数的 login')
      // 还记得我们在 IApi 接口中定义了 get 方法（包括默认实现）吗？
      this.get('https://www.baidu.com')
      return Promise.resolve('hello')
    }
  })
  .implement({
    object: AuthenticationApi,
    id: 1,
    name: 'login',
    implement: function () {
      console.log('无参数的 login')
    },
  })

IAuthenticationApi.ensureImplements(AuthenticationApi)
```

### 使用接口实现类

```javascript
    let authenticationService = new AuthenticationApi(axios)
    // 挂载代理函数到实例上，否则会提示
    // Uncaught TypeError: authenticationService.login is not a function
    IAuthenticationApi.ensureImplements(authenticationService)
    authenticationService
        .login('sitdownload', '1498696873')
		// login(string, string) 会返回一个 Promise 还记得吗 ：P
		.then(str => alert(`${str} world!`))
    authenticationService.login()
```

### 关于日志

首先确保在创建接口时打开了 debug 开关（`{ debug: true }`）。

上面的 demo 运行正常的话你将会得到下面的日志：

```text
// 注册方法
Interface 注册方法: IApi.getName()
Interface 注册方法: IApi.getAxios()
Interface 注册方法: IApi.get(any)
Interface 注册方法: IApi.post(any)
Interface 注册方法: IApi.put(any)
Interface 注册方法: IApi.delete(any)
Interface 注册方法: IAuthentication extends IApi.getName()
Interface 注册方法: IAuthentication extends IApi.getAxios()
Interface 注册方法: IAuthentication extends IApi.get(any)
Interface 注册方法: IAuthentication extends IApi.post(any)
Interface 注册方法: IAuthentication extends IApi.put(any)
Interface 注册方法: IAuthentication extends IApi.delete(any)
Interface 注册方法: [0]IAuthentication.login(username :string, password :string)
Interface 注册方法: [1]IAuthentication.login()

// 实现方法
Interface 实现方法: 保存 [0]IAuthentication.login(...) 实现:
ƒ implement(username, password)
Interface 实现方法: 保存 [1]IAuthentication.login(...) 实现:
ƒ implement()

// 匹配方法
Interface 方法匹配: 精准匹配
IAuthentication.login({ username: "sitdownload" } :string, { password: "1498696873" } :string).
// 在控制台这行是可以打开实现的具体位置的
ƒ implement(username, password)
// 方法输出
AuthenticationApi.js?7b55:25 带参数的 login

// 匹配方法
Interface 方法匹配: 无法精准匹配 IAuthentication.get("https://www.baidu.com")，使用 any 实现匹配:
ƒ implement()
Interface 方法匹配: 精准匹配 IAuthentication.login().
ƒ implement()
// 方法输出
AuthenticationApi.js?7b55:35 无参数的 login

// AuthenticationApi.login(username, password) 中请求了 'https://www.baidu.com'
Failed to load https://www.baidu.com/: No 'Access-Control-Allow-Origin' header is present on the requested resource. Origin 'http://127.0.0.1' is therefore not allowed access.

// IApi.get(any) 中将异常直接向下抛了
Uncaught (in promise) {type: "network", payload: Error: Network Error
    at createError (webpack-internal:///./node_modules/_axios@0.18.0@axios/lib/…}
```

### 后续

如果要发版了，确认所有的接口方法都正确实现后，就可以把 debug 关掉，这样就不会有 `Interface` 内部的一些入参检查和调试输出。