/**
 * Created by Administrator on 2015/11/15 0015.
 */
/*
 *
 * version 0.7
 * built in 2015.10.12
 */

define(["avalon"], function(avalon) {
    var anchorElement = document.createElement('a')

    var History = avalon.History = function() {
        this.location = location
    }

    History.started = false
    //ȡ�õ�ǰIE����ʵ���л���
    History.IEVersion = (function() {
        var mode = document.documentMode
        return mode ? mode : window.XMLHttpRequest ? 7 : 6
    })()

    History.defaults = {
        basepath: "/",
        html5Mode: false,
        hashPrefix: "!",
        iframeID: null, //IE6-7���������ҳ��д����һ��iframe�������ƺ�ˢ�µ�ʱ�򲻻ᶪ��֮ǰ����ʷ
        interval: 50, //IE6-7,ʹ����ѯ��������ʱ��ʱ��
        fireAnchor: true,//�����Ƿ񽫹�������λ����hashͬID��Ԫ����
        routeElementJudger: avalon.noop // �ж�aԪ���Ƿ��Ǵ���router�л�������
    }

    var oldIE = window.VBArray && History.IEVersion <= 7
    var supportPushState = !!(window.history.pushState)
    var supportHashChange = !!("onhashchange" in window && (!window.VBArray || !oldIE))
    History.prototype = {
        constructor: History,
        getFragment: function(fragment) {
            if (fragment == null) {
                if (this.monitorMode === "popstate") {
                    fragment = this.getPath()
                } else {
                    fragment = this.getHash()
                }
            }
            return fragment.replace(/^[#\/]|\s+$/g, "")
        },
        getHash: function(window) {
            // IE6ֱ����location.hashȡhash�����ܻ�ȡ��һ��������
            // ���� http://www.cnblogs.com/rubylouvre#stream/xxxxx?lang=zh_c
            // ie6 => location.hash = #stream/xxxxx
            // ��������� => location.hash = #stream/xxxxx?lang=zh_c
            // firefox �����������hash����decodeURIComponent
            // �ֱ��� http://www.cnblogs.com/rubylouvre/#!/home/q={%22thedate%22:%2220121010~20121010%22}
            // firefox 15 => #!/home/q={"thedate":"20121010~20121010"}
            // ��������� => #!/home/q={%22thedate%22:%2220121010~20121010%22}
            var path = (window || this).location.href
            return this._getHash(path.slice(path.indexOf("#")))
        },
        _getHash: function(path) {
            if (path.indexOf("#/") === 0) {
                return decodeURIComponent(path.slice(2))
            }
            if (path.indexOf("#!/") === 0) {
                return decodeURIComponent(path.slice(3))
            }
            return ""
        },
        getPath: function() {
            var path = decodeURIComponent(this.location.pathname + this.location.search)
            var root = this.basepath.slice(0, -1)
            if (!path.indexOf(root))
                path = path.slice(root.length)
            return path.slice(1)
        },
        _getAbsolutePath: function(a) {
            return !a.hasAttribute ? a.getAttribute("href", 4) : a.href
        },
        /*
         * @interface avalon.history.start ��ʼ������ʷ�仯
         * @param options ���ò���
         * @param options.hashPrefix hash��ʲô�ַ�����ͷ��Ĭ���� "!"����Ӧʵ��Ч������"#!"
         * @param options.routeElementJudger �ж�aԪ���Ƿ��Ǵ���router�л������ӵĺ�����return true�򴥷��л���Ĭ��Ϊavalon.noop��history�ڲ���һ���ж��߼��������ж�aԪ�ص�href�����Ƿ���hashPrefix��ͷ�����������router�л�Ԫ�أ�����ۺ��ж������� href.indexOf(hashPrefix) == 0 || routeElementJudger(ele, ele.href)�����routeElementJudger����true����ת��href��������ص����ַ���������ת�����ص��ַ������������false�򷵻������Ĭ����Ϊ
         * @param options.html5Mode �Ƿ����html5ģʽ������ʹ��hash����¼��ʷ��Ĭ��false
         * @param options.fireAnchor �����Ƿ񽫹�������λ����hashͬID��Ԫ���ϣ�Ĭ��Ϊtrue
         * @param options.basepath ��Ŀ¼��Ĭ��Ϊ"/"
         */
        start: function(options) {
            if (History.started)
                throw new Error("avalon.history has already been started")
            History.started = true
            this.options = avalon.mix({}, History.defaults, options)
            //IE6��֧��maxHeight, IE7֧��XMLHttpRequest, IE8֧��window.Element��querySelector,
            //IE9֧��window.Node, window.HTMLElement, IE10��֧������ע��
            //ȷ��html5Mode���Դ���,������һ������
            this.html5Mode = !!this.options.html5Mode
            //����ģʽ
            this.monitorMode = this.html5Mode ? "popstate" : "hashchange"
            if (!supportPushState) {
                if (this.html5Mode) {
                    avalon.log("����������֧��HTML5 pushState��ǿ��ʹ��hash hack!")
                    this.html5Mode = false
                }
                this.monitorMode = "hashchange"
            }
            if (!supportHashChange) {
                this.monitorMode = "iframepoll"
            }
            this.prefix = "#" + this.options.hashPrefix + "/"
            //ȷ��ǰ�󶼴���б�ߣ� ��"aaa/ --> /aaa/" , "/aaa --> /aaa/", "aaa --> /aaa/", "/ --> /"
            this.basepath = ("/" + this.options.basepath + "/").replace(/^\/+|\/+$/g, "/")  // ȥ���������ߵ�б��

            this.fragment = this.getFragment()

            anchorElement.href = this.basepath
            this.rootpath = this._getAbsolutePath(anchorElement)
            var that = this

            var html = '<!doctype html><html><body>@</body></html>'
            if (this.options.domain) {
                html = html.replace("<body>", "<script>document.domain =" + this.options.domain + "</script><body>")
            }
            this.iframeHTML = html
            if (this.monitorMode === "iframepoll") {
                //IE6,7��hash�ı�ʱ���������ʷ����Ҫ��һ��iframe��������ʷ
                avalon.ready(function() {
                    if(that.iframe) return
                    var iframe = that.iframe || document.getElementById(that.iframeID) || document.createElement('iframe')
                    iframe.src = 'javascript:0'
                    iframe.style.display = 'none'
                    iframe.tabIndex = -1
                    document.body.appendChild(iframe)
                    that.iframe = iframe.contentWindow
                    that._setIframeHistory(that.prefix + that.fragment)
                })

            }

            // ֧��popstate �ͼ���popstate
            // ֧��hashchange �ͼ���hashchange
            // ����Ļ�ֻ��ÿ��һ��ʱ����м����
            function checkUrl(e) {
                var iframe = that.iframe
                if (that.monitorMode === "iframepoll" && !iframe) {
                    return false
                }
                var pageHash = that.getFragment(), hash, lastHash = avalon.router.getLastPath()
                if (iframe) {//IE67
                    var iframeHash = that.getHash(iframe)
                    //�뵱ǰҳ��hash������֮ǰ��ҳ��hash������Ҫ���û�ͨ���������������
                    if (pageHash !== lastHash) {
                        that._setIframeHistory(that.prefix + pageHash)
                        hash = pageHash
                        //����Ǻ��˰�ť����hash��һ��
                    } else if (iframeHash !== lastHash) {
                        that.location.hash = that.prefix + iframeHash
                        hash = iframeHash
                    }

                } else if (pageHash !== lastHash) {
                    hash = pageHash
                }
                if (hash !== void 0) {
                    that.fragment = hash
                    that.fireRouteChange(hash, {fromHistory: true})
                }
            }

            //thanks https://github.com/browserstate/history.js/blob/master/scripts/uncompressed/history.html4.js#L272

            // ֧��popstate �ͼ���popstate
            // ֧��hashchange �ͼ���hashchange(IE8,IE9,FF3)
            // ����Ļ�ֻ��ÿ��һ��ʱ����м����(IE6, IE7)
            switch (this.monitorMode) {
                case "popstate":
                    this.checkUrl = avalon.bind(window, "popstate", checkUrl)
                    this._fireLocationChange = checkUrl
                    break
                case  "hashchange":
                    this.checkUrl = avalon.bind(window, "hashchange", checkUrl)
                    break;
                case  "iframepoll":
                    this.checkUrl = setInterval(checkUrl, this.options.interval)
                    break;
            }
            //���ݵ�ǰ��location�������벻ͬ��·�ɻص�
            avalon.ready(function() {
                that.fireRouteChange(that.fragment || "/", {replace: true})
            })
        },
        fireRouteChange: function(hash, options) {
            var router = avalon.router
            if (router && router.navigate) {
                router.setLastPath(hash)
                router.navigate(hash === "/" ? hash : "/" + hash, options)
            }
            if (this.options.fireAnchor) {
                scrollToAnchorId(hash.replace(/\?.*/g,""))
            }
        },
        // �ж�URL�ļ���
        stop: function() {
            avalon.unbind(window, "popstate", this.checkUrl)
            avalon.unbind(window, "hashchange", this.checkUrl)
            clearInterval(this.checkUrl)
            History.started = false
        },
        updateLocation: function(hash, options, urlHash) {
            var options = options || {},
                rp = options.replace,
                st =    options.silent
            if (this.monitorMode === "popstate") {
                // html5 mode ��һ�μ��ص�ʱ����֮ǰ��hash
                var path = this.rootpath + hash + (urlHash || "")
                // html5 model����query
                if(path != this.location.href.split("#")[0]) history[rp ? "replaceState" : "pushState"]({path: path}, document.title, path)
                if(!st) this._fireLocationChange()
            } else {
                var newHash = this.prefix + hash
                if(st && hash != this.getHash()) {
                    this._setIframeHistory(newHash, rp)
                    if(this.fragment) avalon.router.setLastPath(this.fragment)
                    this.fragment = this._getHash(newHash)
                }
                this._setHash(this.location, newHash, rp)
            }
        },
        _setHash: function(location, hash, replace){
            var href = location.href.replace(/(javascript:|#).*$/, '')
            if (replace){
                location.replace(href + hash)
            }
            else location.hash = hash
        },
        _setIframeHistory: function(hash, replace) {
            if(!this.iframe) return
            var idoc = this.iframe.document
            idoc.open()
            idoc.write(this.iframeHTML)
            idoc.close()
            this._setHash(idoc.location, hash, replace)
        }
    }

    avalon.history = new History

    //https://github.com/asual/jquery-address/blob/master/src/jquery.address.js

    //�ٳ�ҳ�������е���¼�������¼�Դ�������ӻ����ڲ���
    //����������������ҳ��������"#/"��"#!/"��ͷ����ô����updateLocation����
    avalon.bind(document, "click", function(event) {
        var defaultPrevented = "defaultPrevented" in event ? event['defaultPrevented'] : event.returnValue === false

        if (!History.started || defaultPrevented || event.ctrlKey || event.metaKey || event.which === 2)
            return
        var target = event.target
        while (target.nodeName !== "A") {
            target = target.parentNode
            if (!target || target.tagName === "BODY") {
                return
            }
        }

        if (targetIsThisWindow(target.target)) {
            var href = oldIE ? target.getAttribute("href", 2) : target.getAttribute("href") || target.getAttribute("xlink:href")
            var prefix = avalon.history.prefix
            if (href === null) { // href is null if the attribute is not present
                return
            }
            var hash = href.replace(prefix, "").trim()
            if(!(href.indexOf(prefix) === 0 && hash !== "")) {
                var routeElementJudger = avalon.history.options.routeElementJudger
                hash = routeElementJudger(target, href)
                if(hash === true) hash = href
            }
            if (hash) {
                event.preventDefault()
                avalon.router && avalon.router.navigate(hash)
            }
        }
    })

    //�ж�A��ǩ��target�����Ƿ�ָ������
    //thanks https://github.com/quirkey/sammy/blob/master/lib/sammy.js#L219
    function targetIsThisWindow(targetWindow) {
        if (!targetWindow || targetWindow === window.name || targetWindow === '_self' || (targetWindow === 'top' && window == window.top)) {
            return true
        }
        return false
    }
    //�õ�ҳ���һ������������A��ǩ
    function getFirstAnchor(list) {
        for (var i = 0, el; el = list[i++]; ) {
            if (el.nodeName === "A") {
                return el
            }
        }
    }

    function scrollToAnchorId(hash, el) {
        if ((el = document.getElementById(hash))) {
            el.scrollIntoView()
        } else if ((el = getFirstAnchor(document.getElementsByName(hash)))) {
            el.scrollIntoView()
        } else {
            window.scrollTo(0, 0)
        }
    }
    return avalon
})

// ��Ҫ������ basepath  html5Mode  hashPrefix  interval domain fireAnchor