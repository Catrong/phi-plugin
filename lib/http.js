

import fetch from 'node-fetch'


// 创建一个HTTP客户端对象
class HttpClient {
    constructor() {
        this.request = new HttpRequest();
    }

    /** 
     * 
     * @param {*} fetch_s_return response 
     * @param {*} unknow 
     * @returns response s json body
     */
    async send(response) {
        return await response.json()
    }

};



class HttpRequest {
    constructor() {
        this.Url = ''
        this.Method = '' //请求使用的方法，如 GET、POST、DELETE
        this.Headers = {} //请求的头信息，形式为 Headers 的对象或包含 ByteString 值的对象字面量
        //this.Body = {} //请求的 body 信息：可能是一个 Blob、BufferSource、FormData、URLSearchParams 或者 USVString 对象。注意 GET 或 HEAD 方法的请求不能包含 body 信息
        this.Mode = '' //请求的模式，如 cors、no-cors 或者 same-origin
        //this.Credentials = '' //请求的 credentials，如 omit、same-origin 或者 include。为了在当前域名内自动发送 cookie，必须提供这个选项，从 Chrome 50 开始，这个属性也可以接受 FederatedCredential (en-US) 实例或是一个 PasswordCredential (en-US) 实例
        //this.Cache = '' //请求的 cache 模式：default、 no-store、 reload 、 no-cache、 force-cache 或者 only-if-cached
        //this.Redirect = 'follow' //可用的 redirect 模式：follow (自动重定向), error (如果产生重定向将自动终止并且抛出一个错误），或者 manual (手动处理重定向)。在 Chrome 中默认使用 follow（Chrome 47 之前的默认值是 manual）
        //this.Referrer = 'client' // 一个 USVString 可以是 no-referrer、client 或一个 URL。默认是 client
        //this.ReferrerPolicy = '' //指定了 HTTP 头部 referer 字段的值。可能为以下值之一：no-referrer、 no-referrer-when-downgrade、origin、origin-when-cross-origin、 unsafe-url
        //this.Integrity = '' // 包括请求的 subresource integrity 值（例如： sha256-BpfBw7ivV8q2jLiT13fxDYAe2tJllusRSZ273h2nFSE=）
    }


    /**
     * @param {*} URL url
     * @returns Builder
     */
    static Builder = class Builder extends HttpRequest {

        constructor(url) {
            super()
            this.Url = url
            return this
        }

        /**
         * 
         * @param {*} String url 
         * @returns Builder
         */
        uri(url) {
            try {
                this.Url = new URL(url)
                return this
            } catch (error) {
                throw new Error("非法URL " + error)
            }
            return this
        }

        header(name, value) {
            this.Headers[name] = String(value)
            return this
        }

        copy() {
            let result = new Builder()
            result = this
            return result
        }

        DELETE() {
            this.Method = 'DELETE'
            return this
        }

        GET() {
            this.Method = 'GET'
            return this
        }

        async build() {
            if (this.Url) {
                return await fetch(this.Url, locase(this))
            } else {
                throw new Error("未设置URL")
            }
        }
    }
}


/**把变量名小写化 */
function locase(data) {
    return {
        method: data.Method,
        headers: data.Headers,
        //body: data.Body,
        mode: data.Mode,
        //credentials: data.Credentials,
        //cache: data.Cache,
        //redirect: data.Redirect,
        //referrer: data.Referrer,
        //referrerPolicy: data.ReferrerPolicy
    }
}

export { HttpClient, HttpRequest }