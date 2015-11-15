define(["./mmHistory"], function() {

    function Router() {
        var table = {}
        "get,post,delete,put".replace(avalon.rword, function(name) {
            table[name] = []
        })
        this.routingTable = table
    }

    function parseQuery(url) {
        var array = url.split("?"), query = {}, path = array[0], querystring = array[1]
        if (querystring) {
            var seg = querystring.split("&"),
                len = seg.length, i = 0, s;
            for (; i < len; i++) {
                if (!seg[i]) {
                    continue
                }
                s = seg[i].split("=")
                query[decodeURIComponent(s[0])] = decodeURIComponent(s[1])
            }
        }
        return {
            path: path,
            query: query
        }
    }


    function queryToString(obj) {
        if(typeof obj == 'string') return obj
        var str = []
        for(var i in obj) {
            if(i == "query") continue
            str.push(i + '=' + encodeURIComponent(obj[i]))
        }
        return str.length ? '?' + str.join("&") : ''
    }

    var placeholder = /([:*])(\w+)|\{(\w+)(?:\:((?:[^{}\\]+|\\.|\{(?:[^{}\\]+|\\.)*\})+))?\}/g
    Router.prototype = {
        error: function(callback) {
            this.errorback = callback
        },
        _pathToRegExp: function(pattern, opts) {
            var keys = opts.keys = [],
            //      segments = opts.segments = [],
                compiled = '^', last = 0, m, name, regexp, segment;

            while ((m = placeholder.exec(pattern))) {
                name = m[2] || m[3]; // IE[78] returns '' for unmatched groups instead of null
                regexp = m[4] || (m[1] == '*' ? '.*' : 'string')
                segment = pattern.substring(last, m.index);
                var type = this.$types[regexp]
                var key = {
                    name: name
                }
                if (type) {
                    regexp = type.pattern
                    key.decode = type.decode
                }
                keys.push(key)
                compiled += quoteRegExp(segment, regexp, false)
                //  segments.push(segment)
                last = placeholder.lastIndex
            }
            segment = pattern.substring(last);
            compiled += quoteRegExp(segment) + (opts.strict ? opts.last : "\/?") + '$';
            var sensitive = typeof opts.caseInsensitive === "boolean" ? opts.caseInsensitive : true
            //  segments.push(segment);
            opts.regexp = new RegExp(compiled, sensitive ? 'i' : undefined);
            return opts

        },
        //���һ��·�ɹ���
        add: function(method, path, callback, opts) {
            var array = this.routingTable[method.toLowerCase()]
            if (path.charAt(0) !== "/") {
                throw "path������/��ͷ"
            }
            opts = opts || {}
            opts.callback = callback
            if (path.length > 2 && path.charAt(path.length - 1) === "/") {
                path = path.slice(0, -1)
                opts.last = "/"
            }
            avalon.Array.ensure(array, this._pathToRegExp(path, opts))
        },
        //�ж���ǰURL������״̬�����·�ɹ����Ƿ����
        route: function(method, path, query) {
            path = path.trim()
            var states = this.routingTable[method]
            for (var i = 0, el; el = states[i++]; ) {
                var args = path.match(el.regexp)
                if (args) {
                    el.query = query || {}
                    el.path = path
                    el.params = {}
                    var keys = el.keys
                    args.shift()
                    if (keys.length) {
                        this._parseArgs(args, el)
                    }
                    return  el.callback.apply(el, args)
                }
            }
            if (this.errorback) {
                this.errorback()
            }
        },
        _parseArgs: function(match, stateObj) {
            var keys = stateObj.keys
            for (var j = 0, jn = keys.length; j < jn; j++) {
                var key = keys[j]
                var value = match[j] || ""
                if (typeof key.decode === "function") {//�����ﳢ��ת������������
                    var val = key.decode(value)
                } else {
                    try {
                        val = JSON.parse(value)
                    } catch (e) {
                        val = value
                    }
                }
                match[j] = stateObj.params[key.name] = val
            }
        },
        getLastPath: function() {
            return getCookie("msLastPath")
        },
        setLastPath: function(path) {
            setCookie("msLastPath", path)
        },
        /*
         *  @interface avalon.router.redirect
         *  @param hash ���ʵ�url hash
         */
        redirect: function(hash) {
            this.navigate(hash, {replace: true})
        },
        /*
         *  @interface avalon.router.navigate
         *  @param hash ���ʵ�url hash
         *  @param options ��չ����
         *  @param options.replace true�滻history����������һ���µ���ʷ��¼
         *  @param options.silent true��ʾֻͬ��url��������url�仯������
         */
        navigate: function(hash, options) {
            var parsed = parseQuery((hash.charAt(0) !== "/" ? "/" : "") + hash),
                options = options || {}
            if(hash.charAt(0) === "/")
                hash = hash.slice(1)// �������ֶ࿸����� fix http://localhost:8383/index.html#!//
            // ��state֮����дhistory���߼�
            if(!avalon.state || options.silent) avalon.history && avalon.history.updateLocation(hash, avalon.mix({}, options, {silent: true}))
            // ֻ��д��ʷ����
            if(!options.silent) {
                this.route("get", parsed.path, parsed.query, options)
            }
        },
        /*
         *  @interface avalon.router.when �����ض������
         *  @param path ���ض���ı��ʽ���������ַ�����������
         *  @param redirect �ض���ı�ʾʽ����url
         */
        when: function(path, redirect) {
            var me = this,
                path = path instanceof Array ? path : [path]
            avalon.each(path, function(index, p) {
                me.add("get", p, function() {
                    var info = me.urlFormate(redirect, this.params, this.query)
                    me.navigate(info.path + info.query, {replace: true})
                })
            })
            return this
        },
        /*
         *  @interface avalon.router.get ���һ��router����
         *  @param path url���ʽ
         *  @param callback ��Ӧ���url�Ļص�
         */
        get: function(path, callback) {},
        urlFormate: function(url, params, query) {
            var query = query ? queryToString(query) : "",
                hash = url.replace(placeholder, function(mat) {
                    var key = mat.replace(/[\{\}]/g, '').split(":")
                    key = key[0] ? key[0] : key[1]
                    return params[key] !== undefined ? params[key] : ''
                }).replace(/^\//g, '')
            return {
                path: hash,
                query: query
            }
        },
        /* *
         `'/hello/'` - ƥ��'/hello/'��'/hello'
         `'/user/:id'` - ƥ�� '/user/bob' �� '/user/1234!!!' �� '/user/' ����ƥ�� '/user' �� '/user/bob/details'
         `'/user/{id}'` - ͬ��
         `'/user/{id:[^/]*}'` - ͬ��
         `'/user/{id:[0-9a-fA-F]{1,8}}'` - Ҫ��IDƥ��/[0-9a-fA-F]{1,8}/���������
         `'/files/{path:.*}'` - Matches any URL starting with '/files/' and captures the rest of the
         path into the parameter 'path'.
         `'/files/*path'` - ditto.
         */
        // avalon.router.get("/ddd/:dddID/",callback)
        // avalon.router.get("/ddd/{dddID}/",callback)
        // avalon.router.get("/ddd/{dddID:[0-9]{4}}/",callback)
        // avalon.router.get("/ddd/{dddID:int}/",callback)
        // ����������������������µ����ͣ�avalon.router.$type.d4 = { pattern: '[0-9]{4}', decode: Number}
        // avalon.router.get("/ddd/{dddID:d4}/",callback)
        $types: {
            date: {
                pattern: "[0-9]{4}-(?:0[1-9]|1[0-2])-(?:0[1-9]|[1-2][0-9]|3[0-1])",
                decode: function(val) {
                    return new Date(val.replace(/\-/g, "/"))
                }
            },
            string: {
                pattern: "[^\\/]*"
            },
            bool: {
                decode: function(val) {
                    return parseInt(val, 10) === 0 ? false : true;
                },
                pattern: "0|1"
            },
            'int': {
                decode: function(val) {
                    return parseInt(val, 10);
                },
                pattern: "\\d+"
            }
        }
    }

    "get,put,delete,post".replace(avalon.rword, function(method) {
        return  Router.prototype[method] = function(a, b, c) {
            this.add(method, a, b, c)
        }
    })
    function quoteRegExp(string, pattern, isOptional) {
        var result = string.replace(/[\\\[\]\^$*+?.()|{}]/g, "\\$&");
        if (!pattern)
            return result;
        var flag = isOptional ? '?' : '';
        return result + flag + '(' + pattern + ')' + flag;
    }
    function supportLocalStorage() {
        try {
            localStorage.setItem("avalon", 1)
            localStorage.removeItem("avalon")
            return true
        } catch (e) {
            return false
        }
    }

    if (supportLocalStorage()) {
        Router.prototype.getLastPath = function() {
            return localStorage.getItem("msLastPath")
        }
        var cookieID
        Router.prototype.setLastPath = function (path) {
            if (cookieID) {
                clearTimeout(cookieID)
                cookieID = null
            }
            localStorage.setItem("msLastPath", path)
            cookieID = setTimeout(function () {
                localStorage.removItem("msLastPath")
            }, 1000 * 60 * 60 * 24)
        }
    }



    function escapeCookie(value) {
        return String(value).replace(/[,;"\\=\s%]/g, function(character) {
            return encodeURIComponent(character)
        });
    }
    function setCookie(key, value) {
        var date = new Date()//��date����Ϊ1���Ժ��ʱ��
        date.setTime(date.getTime() + 1000 * 60 * 60 * 24)
        document.cookie = escapeCookie(key) + '=' + escapeCookie(value) + ";expires=" + date.toGMTString()
    }
    function getCookie(name) {
        var m = String(document.cookie).match(new RegExp('(?:^| )' + name + '(?:(?:=([^;]*))|;|$)')) || ["", ""]
        return decodeURIComponent(m[1])
    }

    avalon.router = new Router

    return avalon
})
/*
 <!DOCTYPE html>
 <html>
 <head>
 <meta charset="utf-8">
 <title>·��ϵͳ</title>
 <script src="avalon.js"></script>
 <script>
 require(["mmRouter"], function() {
 var model = avalon.define('xxx', function(vm) {
 vm.currPath = ""
 })
 avalon.router.get("/aaa", function(a) {
 model.currPath = this.path
 })
 avalon.router.get("/bbb", function(a) {
 model.currPath = this.path
 })
 avalon.router.get("/ccc", function(a) {
 model.currPath = this.path
 })
 avalon.router.get("/ddd/:ddd", function(a) {//:dddΪ����
 avalon.log(a)
 model.currPath = this.path
 })
 avalon.router.get("/eee", function(a) {
 model.currPath = this.path
 })
 avalon.history.start({
 html5Mode: true,
 basepath: "/avalon"
 })
 avalon.scan()
 })
 </script>
 </head>
 <body >
 <div ms-controller="xxx">
 <ul>
 <li><a href="#!/aaa">aaa</a></li>
 <li><a href="#!/bbb">bbb</a></li>
 <li><a href="#!/ccc">ccc</a></li>
 <li><a href="#!/ddd/222">ddd</a></li>
 <li><a href="#!/eee">eee</a></li>
 </ul>
 <div style="color:red">{{currPath}}</div>
 <div style="height: 600px;width:1px;">

 </div>
 <p id="eee">�ᶨλ������</p>
 </div>

 </body>
 </html>

 *//**
 * Created by Administrator on 2015/11/15 0015.
 */
