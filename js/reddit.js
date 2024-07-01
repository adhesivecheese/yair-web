class Reddit {
    constructor(redirect_uri, client_id, client_secret, duration, scope) {
        this.redirect_uri = redirect_uri
        this.client_id = client_id
        this.client_secret = client_secret
        this.state = "changeme"
        this.duration = duration
        this.scope = scope
        this.access_token = null
        this.refresh_token = null
        this.username = null

        this.auth_string = btoa(`${this.client_id}:${this.client_secret}`)

    }

    get_endpoint(endpoint) {
        let endpoints = {
            me: "api/v1/me"
            , messages: "message/messages?limit=100&raw_json=1"
            , sent: "message/sent?limit=100&raw_json=1"
            , unread: "message/unread"
            , comment_replies: "message/comments"
            , post_replies: "message/selfreply"
            , mentions: "message/mentions"
            , compose: "message/compose"
        }
        return endpoints[endpoint]
    }


    generate_auth_link() {
        return `https://www.reddit.com/api/v1/authorize?client_id=${client_id}&response_type=code&state=${this.state}&redirect_uri=${this.redirect_uri}&duration=${this.duration}&scope=${this.scope}`
    }

    async get_token_from_code() {
        const queryString = window.location.search;
        const urlParams = new URLSearchParams(queryString);
        const code = urlParams.get('code');
        var body = new URLSearchParams();
        body.append('grant_type', 'authorization_code');
        body.append('code', code);
        body.append('redirect_uri', redirect_uri);
        fetch(
            "https://www.reddit.com/api/v1/access_token"
            , {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                    , 'Authorization': `Basic ${this.auth_string}`
                }
                , body: body
            }
        ).then(response => {
            if (response.ok) { return response.json(); }
            else { throw new Error('Request failed:', response.status); }
        }).then(result => {
            this.access_token = result.access_token;
            this.refresh_token = result.refresh_token;
            return this.makeAPIGetRequest('api/v1/me', this.access_token);
        }).then(result => {
                this.username = result.name;
        }).catch((error) => { console.error('Error:', error); });
    }

    async makeAPIGetRequest(endpoint, token, params = null) {
        const myHeaders = new Headers();
        myHeaders.append('Content-Type', 'application/json');
        myHeaders.append('Authorization', "bearer " + token);
        let url = `https://oauth.reddit.com/${endpoint}`
        if (params) { url += params }
        return fetch(url, { headers: myHeaders }).then((response) => {
            if (response.ok) {
                console.log("response.headers =", response.headers); 
                return response.json();
            }
            else { throw new Error('Request failed:', response.status); }
        }).catch((error) => { console.error('Error:', error); });
    }

    async initialFetch() {
        let conversations = []
        let after = null
        do {
            let endpoint = this.get_endpoint("messages")
            if (after) { endpoint += `&after=${after}`}
            await this.makeAPIGetRequest(endpoint, this.access_token).then((batch) => {
                console.log(`messages: got ${batch.data.children.length} conversations after ${after}`)
                batch.data.children.forEach((message) => {
                        message = message.data
                        let authorized_user = this.username
                        if (message.subreddit != null) {
                            if (message.distinguished == "moderator" && message.dest != authorized_user) { return }
                            if (message.dest != authorized_user && message.author.name != authorized_user) { return }
                        }
                        if (message.distinguished == "admin" || message.distinguished == "yes") {
                            message.distinguished = "admin"
                        }
                        conversations = [...new Set([...conversations, message])];
                    })
                after = batch.data.after
            })
        } while (after != null);
        return conversations
    }
}

// All this belongs elsewhere
r = null
const redirect_uri = 'https://adhesivecheese.github.io/yair-web/callback.html'
const client_id = "UBmFQRdzisR5CANmMfzAjw"
const client_secret = "MAJ7oNMMaNVAComGy2AIQfMRaLlDgQ"
const duration = "permanent"
const scope = "identity,privatemessages"
document.addEventListener('DOMContentLoaded', function() {
    r = new Reddit(redirect_uri,client_id,client_secret,duration,scope)
   set_user()
}, false);

async function set_user() {
    await r.get_token_from_code().then(()=>{
        document.querySelector('#user_info').innerHTML = `You've now connected YAIR-WEB to Reddit for 
            <a href="https://reddit.com/user/${r.username}">/u/${r.username}</a>!</div><div><button id="fetchButton" class="button" onclick="fetchAll()">Fetch PMs</button>`;
    })
}

async function fetchAll() {
    button = document.querySelector("#fetchButton")
    button.disabled = true
    await r.initialFetch().then((conversations) => {
        console.log(conversations)
        html = ""
        conversations.forEach((message) =>{
            if (message.author == r.username) { other_user = message.dest }
            else {other_user = message.author}
            html += `<div><a href=https://reddit.com/message/messages/${message.id}>${message.subject}</a> with ${other_user}</div>`
        })
        document.querySelector("#user_info").innerHTML=html
    })
}