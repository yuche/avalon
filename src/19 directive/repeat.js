bindingHandlers.repeat = function (data, vmodels) {
    var type = data.type
    parseExprProxy(data.value, vmodels, data, 0, 1)
    data.proxies = []
    var freturn = false
    try {
        var $repeat = data.$repeat = data.evaluator.apply(0, data.args || [])
        var xtype = avalon.type($repeat)
        if (xtype !== "object" && xtype !== "array") {
            freturn = true
            avalon.log("warning:" + data.value + "只能是对象或数组")
        }
    } catch (e) {
        freturn = true
    }
    var arr = data.value.split(".") || []
    if (arr.length > 1) {
        arr.pop()
        var n = arr[0]
        for (var i = 0, v; v = vmodels[i++]; ) {
            if (v && v.hasOwnProperty(n)) {
                var events = v[n].$events || {}
                events[subscribers] = events[subscribers] || []
                events[subscribers].push(data)
                break
            }
        }
    }

    var elem = data.element
    if (elem.nodeType === 1) {
        elem.removeAttribute(data.name)
        data.sortedCallback = getBindingCallback(elem, "data-with-sorted", vmodels)
        data.renderedCallback = getBindingCallback(elem, "data-" + type + "-rendered", vmodels)
        var signature = generateID(type)
        var start = DOC.createComment(signature)
        var end = DOC.createComment(signature + ":end")
        data.signature = signature
        data.template = avalonFragment.cloneNode(false)
        if (type === "repeat") {
            var parent = elem.parentNode
            parent.replaceChild(end, elem)
            parent.insertBefore(start, end)
            data.template.appendChild(elem)
        } else {
            while (elem.firstChild) {
                data.template.appendChild(elem.firstChild)
            }
            elem.appendChild(start)
            elem.appendChild(end)
        }
        data.element = end
        data.handler = bindingExecutors.repeat
        data.rollback = function () {
            var elem = data.element
            if (!elem)
                return
            data.handler("clear")
        }
    }

    if (freturn) {
        return
    }

    data.$outer = {}
    var check0 = "$key"
    var check1 = "$val"
    if (Array.isArray($repeat)) {
        check0 = "$first"
        check1 = "$last"
    }

    for (i = 0; v = vmodels[i++]; ) {
        if (v.hasOwnProperty(check0) && v.hasOwnProperty(check1)) {
            data.$outer = v
            break
        }
    }
    var $events = $repeat.$events
    var $list = ($events || {})[subscribers]
    injectDependency($list, data)
    if (xtype === "object") {
        data.$with = true
        $repeat.$proxy || ($repeat.$proxy = {})
        data.handler("append", $repeat)
    } else if ($repeat.length) {
        data.handler("add", 0, $repeat.length)
    }
}

bindingExecutors.repeat = function (method, pos, el) {
    if (!method && this.$with) {
        method = "append"
        var flag = "update"
    }
    if (method) {
        var data = this, start, fragment
        var end = data.element
        var comments = getComments(data)
        var parent = end.parentNode
        var proxies = data.proxies
        var transation = avalonFragment.cloneNode(false)
        switch (method) {
            case "add": //在pos位置后添加el数组（pos为插入位置,el为要插入的个数）
                var n = pos + el
                var fragments = []
                for (var i = pos; i < n; i++) {
                    var proxy = eachProxyAgent(i, data)
                    proxies.splice(i, 0, proxy)
                    shimController(data, transation, proxy, fragments)
                }
                var now = new Date() - 0
                avalon.optimize = avalon.optimize || now
                for (i = 0; fragment = fragments[i++]; ) {
                    scanNodeArray(fragment.nodes, fragment.vmodels)
                    fragment.nodes = fragment.vmodels = null
                }
                if (avalon.optimize === now) {
                    avalon.optimize = null
                }
                parent.insertBefore(transation, comments[pos] || end)
                avalon.profile("插入操作花费了 " + (new Date - now))
                break
            case "del": //将pos后的el个元素删掉(pos, el都是数字)
                sweepNodes(comments[pos], comments[pos + el] || end)
                var removed = proxies.splice(pos, el)
                recycleProxies(removed, "each")
                break
            case "clear":
                start = comments[0]
                if (start) {
                    sweepNodes(start, end)
                    if (data.$with) {
                        parent.insertBefore(start, end)
                    }
                }
                recycleProxies(proxies, "each")
                break
            case "move":
                start = comments[0]
                if (start) {
                    var signature = start.nodeValue
                    var rooms = []
                    var room = [],
                            node
                    sweepNodes(start, end, function () {
                        room.unshift(this)
                        if (this.nodeValue === signature) {
                            rooms.unshift(room)
                            room = []
                        }
                    })
                    sortByIndex(rooms, pos)
                    sortByIndex(proxies, pos)
                    while (room = rooms.shift()) {
                        while (node = room.shift()) {
                            transation.appendChild(node)
                        }
                    }
                    parent.insertBefore(transation, end)
                }
                break
            case "index": //将proxies中的第pos个起的所有元素重新索引
                var last = proxies.length - 1
                for (; el = proxies[pos]; pos++) {
                    el.$index = pos
                    el.$first = pos === 0
                    el.$last = pos === last
                }
                return
            case "set": //将proxies中的第pos个元素的VM设置为el（pos为数字，el任意）
                proxy = proxies[pos]
                if (proxy) {
                    fireDependencies(proxy.$events[data.param || "el"])
                }
                break
            case "append":
                var object = data.$repeat //原来第2参数， 被循环对象
                var oldProxy = object.$proxy   //代理对象组成的hash
                var keys = []
                now = new Date() - 0
                avalon.optimize = avalon.optimize || now
                if (flag === "update") {
                    if (!data.evaluator) {
                        parseExprProxy(data.value, data.vmodels, data, 0, 1)
                    }
                    object = data.$repeat = data.evaluator.apply(0, data.args || [])
                    object.$proxy = oldProxy 
                }
                var pool = object.$proxy || {}
                removed = []
                var nodes = data.element.parentNode.childNodes
                var add = false
                for (i = 0; node = nodes[i++]; ) {
                    if (node.nodeValue === data.signature) {
                        add = true
                    } else if (node.nodeValue === data.signature + ":end") {
                        add = false
                    }
                    if (add) {
                        removed.push(node)
                    }
                }

                var indexNode = [], item
                var keyIndex = data.keyIndex || (data.keyIndex = {})
                //将现有的节点全部移出DOM树
                for ( i = 0; i < removed.length; i++) {
                    el = removed[i]
                    if (el.nodeValue === data.signature) {
                        item = avalonFragment.cloneNode(false)
                        indexNode.push(item)
                    }
                    item.appendChild(el)
                }


                for (var key in object) { //当前对象的所有键名
                    if (object.hasOwnProperty(key) && key !== "hasOwnProperty" && key !== "$proxy") {
                        keys.push(key)
                    }
                }

                for (var i = 0; key = keys[i++]; ) {
                    if (!pool.hasOwnProperty(key)) {//添加缺失的代理VM
                        pool[key] = withProxyAgent(pool[key], key, data)
                    } else {
                        pool[key].$val = object[key]
                    }
                }

                for ( key in pool) {
                    if (keys.indexOf(key) === -1) {//删除没用的代理VM
                        proxyRecycler(pool[key], withProxyPool) //去掉之前的代理VM
                        delete pool[key]
                    }
                }
                var fragments = []
                var renderKeys = keys //需要渲染到DOM树去的键名
                var end = data.element
                if (data.sortedCallback) { //如果有回调，则让它们排序
                    var keys2 = data.sortedCallback.call(parent, keys)
                    if (keys2 && Array.isArray(keys2)) {
                        renderKeys = keys2
                    }
                }

                for (i = 0; i < renderKeys.length; i++) {
                    key = renderKeys[i]
                    if (typeof keyIndex[key] === "number") {
                        transation.appendChild(indexNode[keyIndex[key]])
                        fragments.push({})
                    } else {
                        shimController(data, transation, pool[key], fragments)
                    }
                }

                for (i = 0; i < renderKeys.length; i++) {
                    keyIndex[renderKeys[i]] = i
                }

                for (i = 0; fragment = fragments[i++]; ) {
                    if (fragment.nodes) {
                        scanNodeArray(fragment.nodes, fragment.vmodels)
                        fragment.nodes = fragment.vmodels = null
                    }
                }
                if (avalon.optimize === now) {
                    avalon.optimize = null
                }
                parent.insertBefore(transation, end)
                avalon.profile("插入操作花费了 " + (new Date - now))
                break
        }
        if (!data.$repeat || data.$repeat.hasOwnProperty("$lock")) //IE6-8 VBScript对象会报错, 有时候data.$repeat不存在
            return
        if (method === "clear")
            method = "del"
        var callback = data.renderedCallback || noop,
                args = arguments
        if (parent.oldValue && parent.tagName === "SELECT") { //fix #503
            avalon(parent).val(parent.oldValue.split(","))
        }
        callback.apply(parent, args)
    }
}
"with,each".replace(rword, function (name) {
    bindingHandlers[name] = bindingHandlers.repeat
})

function shimController(data, transation, proxy, fragments) {
    var content = data.template.cloneNode(true)
    var nodes = avalon.slice(content.childNodes)
    content.insertBefore(DOC.createComment(data.signature), content.firstChild)
    transation.appendChild(content)
    var nv = [proxy].concat(data.vmodels)
    var fragment = {
        nodes: nodes,
        vmodels: nv
    }
    fragments.push(fragment)
}

function getComments(data) {
    var ret = []
    var nodes = data.element.parentNode.childNodes
    for(var i= 0, node; node = nodes[i++];){
        if(node.nodeValue === data.signature){
            ret.push( node )
        }else if(node.nodeValue === data.signature+":end"){
            break
        }
    }
    return ret
}


//移除掉start与end之间的节点(保留end)
function sweepNodes(start, end, callback) {
    while (true) {
        var node = end.previousSibling
        if (!node)
            break
        node.parentNode.removeChild(node)
        callback && callback.call(node)
        if (node === start) {
            break
        }
    }
}

// 为ms-each,ms-with, ms-repeat会创建一个代理VM，
// 通过它们保持一个下上文，让用户能调用$index,$first,$last,$remove,$key,$val,$outer等属性与方法
// 所有代理VM的产生,消费,收集,存放通过xxxProxyFactory,xxxProxyAgent, recycleProxies,xxxProxyPool实现
var withProxyPool = []
function withProxyFactory() {
    var proxy = modelFactory({
        $key: "",
        $outer: {},
        $host: {},
        $val: {
            get: function () {
                return this.$host[this.$key]
            },
            set: function (val) {
                this.$host[this.$key] = val
            }
        }
    }, {
        $val: 1
    })
    proxy.$id = generateID("$proxy$with")
    return proxy
}

function withProxyAgent(proxy, key, data) {
    proxy = proxy || withProxyPool.pop()
    if (!proxy) {
        proxy = withProxyFactory()
    } else {
        proxy.$reinitialize()
    }
    var host = data.$repeat
    proxy.$key = key
    proxy.$host = host
    proxy.$outer = data.$outer
    if (host.$events) {
        proxy.$events.$val = host.$events[key]
    } else {
        proxy.$events = {}
    }
    return proxy
}


function  recycleProxies(proxies) {
    eachProxyRecycler(proxies)
}
function eachProxyRecycler(proxies) {
    proxies.forEach(function (proxy) {
        proxyRecycler(proxy, eachProxyPool)
    })
    proxies.length = 0
}


var eachProxyPool = []
function eachProxyFactory(name) {
    var source = {
        $host: [],
        $outer: {},
        $index: 0,
        $first: false,
        $last: false,
        $remove: avalon.noop
    }
    source[name] = {
        get: function () {
            var e = this.$events
            var array = e.$index
            e.$index = e[name] //#817 通过$index为el收集依赖
            try {
                return this.$host[this.$index]
            } finally {
                e.$index = array
            }
        },
        set: function (val) {
            try {
                var e = this.$events
                var array = e.$index
                e.$index = []
                this.$host.set(this.$index, val)
            } finally {
                e.$index = array
            }
        }
    }
    var second = {
        $last: 1,
        $first: 1,
        $index: 1
    }
    var proxy = modelFactory(source, second)
    proxy.$id = generateID("$proxy$each")
    return proxy
}

function eachProxyAgent(index, data) {
    var param = data.param || "el",
            proxy
    for (var i = 0, n = eachProxyPool.length; i < n; i++) {
        var candidate = eachProxyPool[i]
        if (candidate && candidate.hasOwnProperty(param)) {
            proxy = candidate
            eachProxyPool.splice(i, 1)
        }
    }
    if (!proxy) {
        proxy = eachProxyFactory(param)
    }
    var host = data.$repeat
    var last = host.length - 1
    proxy.$index = index
    proxy.$first = index === 0
    proxy.$last = index === last
    proxy.$host = host
    proxy.$outer = data.$outer
    proxy.$remove = function () {
        return host.removeAt(proxy.$index)
    }
    return proxy
}


function proxyRecycler(proxy, proxyPool) {
    for (var i in proxy.$events) {
        if (Array.isArray(proxy.$events[i])) {
            proxy.$events[i].forEach(function (data) {
                if (typeof data === "object")
                    disposeData(data)
            })// jshint ignore:line
            proxy.$events[i].length = 0
        }
    }
    proxy.$host = proxy.$outer = {}
    if (proxyPool.unshift(proxy) > kernel.maxRepeatSize) {
        proxyPool.pop()
    }
}