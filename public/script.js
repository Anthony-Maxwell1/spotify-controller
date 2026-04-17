let currentStatus = null;
let playlistsCache = [];
let drawerLoaded = false;

const ESP_CONNECTION = true;
const WEBSOCKET_URL = "ws://192.168.1.127:81";

// esp vars
let button_pressed = false;
let press_processed = true;
let selected_element = null;

const ELEMENT_ORDER = ["like", "previous", "play", "next", "shuffle", "repeat", "discover", "playalbum"]
const DISCOVER_ELEMENT_ORDER = ["__BACK__", "_tab", "search?", "content..."] // ? = skip if not present/tab not selected, ... = multiple, based on autofill, __... = action, to be processed specially, e.g. leave menu, _ = specially processed, e.g. for toggle with two buttons
const SPECIAL_MAPPINGS = {
    "playlists": "_tab",
    "search": "_tab"
}

let last_change = null;

let discover_open = false;

let content_amount = 0;

document.addEventListener("DOMContentLoaded", async () => {
    const root = document.getElementsByClassName("root")[0];

    try {
        const test = await fetch("/health");
        if (!test.ok) throw new Error("backend not running");
    } catch (e) {
        root.innerHTML = "<h1 style='color:red;'>Error: Python backend is not running.</h1><p>Please start DeskOS server.</p>";
        return;
    }

    const bootstrap = await fetch("/proxy", {
        method: "POST",
        body: JSON.stringify({ action: "getStatus" }),
        headers: { "Content-Type": "application/json" }
    });

    if (bootstrap.status === 503) {
        root.innerHTML = "<h1 style='color:red;'>Error: Spotify client not connected.</h1>";
        return;
    }

    wireUI();
    refreshStatus();

    if (!ESP_CONNECTION) return;   

    const ws = new WebSocket(WEBSOCKET_URL);
    ws.addEventListener("open", () => {
        console.log("WebSocket connected");
    });

    ws.addEventListener("error", (err) => {
        console.error("WebSocket error");
        console.log(err);
    });

    ws.addEventListener("message", (event) => {
        console.log("WebSocket message received:", event.data);
        if (event.data == "0") {
            button_pressed = true;
            press_processed = false;
        } else if (event.data.startsWith("1")) {
            button_pressed = false;
        } else if (event.data.startsWith("2")) {
            if (event.data.endsWith("0")) {
                rotate(false);
            } else {
                rotate(true);
            }
        }
    });

    process_controls();
});

function process_controls() {
    element_map = {
        "play": "playPauseBtn",
        "like": "likeBtn",
        "next": "nextBtn",
        "previous": "previousBtn",
        "shuffle": "shuffleBtn",
        "repeat": "repeatBtn",
        "discover": "openDrawer",
        "playalbum": "playAlbum",
    };
    
    if (selected_element && selected_element.startsWith("content")) {
        element_map[selected_element] = selected_element;
    }

    // console.log(element_map[selected_element]);

    if (Date.now() - last_change > 5000) {
        selected_element = null;
    }


    const elemId = element_map[selected_element];
    const elem = document.getElementById(elemId);
    if (elem) {
        if (!elem.classList.contains("CONTROLS_ACTIVE")) {
            elem.classList.add("CONTROLS_ACTIVE");
        }
    }
    const elems = document.getElementsByClassName("CONTROLS_ACTIVE");
    for (let i = 0; i < elems.length; i++) {
        const e = elems[i];
        if (e.id == elemId) continue;
        e.classList.remove("CONTROLS_ACTIVE");
    }

    if (selected_element && selected_element.startsWith("content")) {
        const contentElem = document.getElementById(selected_element);
        if (contentElem) {
            const parent = contentElem.parentElement;
            if (parent) {
                const elemRect = contentElem.getBoundingClientRect();
                const parentRect = parent.getBoundingClientRect();
                
                // Check if element is overflowing vertically
                if (elemRect.bottom > parentRect.bottom || elemRect.top < parentRect.top) {
                    contentElem.scrollIntoView({ behavior: "smooth", block: "nearest" });
                }
                // Check if element is overflowing horizontally
                if (elemRect.right > parentRect.right || elemRect.left < parentRect.left) {
                    contentElem.scrollIntoView({ behavior: "smooth", inline: "nearest" });
                }
            }
        }
    }

    if (!button_pressed && !press_processed) {
        press_processed = true;
        last_change = Date.now();
        if (selected_element == null) {
            action_toggle_play();
        } else {
            if (selected_element == "playlist" || selected_element == "search") {
                switchTab(selected_element == "playlist" ? "playlists" : "search");
            } else {
                const actionMap = {
                    "like": action_like_unlike,
                    "previous": action_previous,
                    "play": action_toggle_play,
                    "next": action_next,
                    "shuffle": action_shuffle,
                    "repeat": action_repeat,
                    "discover": () => {action_pick_from_playlist();selected_element = document.querySelector(".tab-button.active").dataset.tab;},
                    "playalbum": action_go_to_album,
                    "content...": clickContent,
                };
                console.log(selected_element)
                if (actionMap[selected_element]) {
                    actionMap[selected_element]();
                } else if (selected_element.startsWith("content")) {
                    const index = Number(selected_element.slice(7));
                    console.log(index)
                    actionMap["content..."](index);
                }
            }
        };
    }

    setTimeout(process_controls, 50);
}

function clickContent(index) {
    const activeTab = document.querySelector(".tab-button.active").dataset.tab;
    console.log(activeTab);
    if (activeTab == "playlists") {
        const item = document.querySelectorAll("#playlistsList .list-item")[index];
        action_play_from_uri(item.dataset.uri);
    } else {
        const item = document.querySelectorAll("#searchResults .list-item")[index]; 
        action_play_from_uri(item.dataset.uri);        
    }
}

function rotate(clockwise) {
    console.log(selected_element)
    last_change = Date.now();
    if (selected_element == null) {
        selected_element = "play";
        return;
    }
    const curr_order = discover_open ? DISCOVER_ELEMENT_ORDER : ELEMENT_ORDER;
    if (SPECIAL_MAPPINGS[selected_element]) {
        selected_element = SPECIAL_MAPPINGS[selected_element];
    }
    if (selected_element.startsWith("content")) {
        if (clockwise) {
            selected_element = "content" + (Number(selected_element.slice(7)) + 1);
            console.log(selected_element)
            if (Number(selected_element.slice(7)) >= content_amount) {
                selected_element = "content" + (content_amount - 1);
            }
            return;
        } else {
            selected_element = "content" + (Number(selected_element.slice(7)) - 1);
            console.log(selected_element)
            if (Number(selected_element.slice(7)) < 0) {
                const selected_tab = document.querySelector(".tab-button.active").dataset.tab;
                if (selected_tab == "search") {
                    selected_element = "search?";
                    return;
                }
                selected_element = "playlists";
            }
            return;
        }
    }
    const curr_index = curr_order.indexOf(selected_element);
    let new_index = curr_index + (clockwise ? 1 : -1);
    if (new_index < 0) new_index = curr_order.length - 1;
    if (new_index >= curr_order.length) new_index = curr_order.length - 1;
    if (curr_order[new_index].startsWith("__")) {
        if (curr_order[new_index] === "__BACK__") {
            setDrawer(false);
            selected_element = "discover";
            return;
        }
    } else if (curr_order[new_index].startsWith("_")) {
        if (curr_order[new_index] === "_tab") {
            const activeTab = document.querySelector(".tab-button.active").dataset.tab;
            selected_element = activeTab;
            return;
        }
        
    } else if (curr_order[new_index].endsWith("?")) {
        if (curr_order[new_index] === "search?") {
            // skip if not in search tab
            const activeTab = document.querySelector(".tab-button.active").dataset.tab;
            if (activeTab !== "search") {
                new_index += (clockwise ? 1 : -1);
            }
        }
    } 
    
    if (curr_order[new_index].endsWith("...")) {
        console.log("content...", content_amount);
        if (curr_order[new_index] === "content...") {
            if (content_amount == 0) return;
            selected_element = "content0";
            return;
        }
    }
    console.log("new_index", new_index, curr_order[new_index]);
    selected_element = curr_order[new_index];
}

function wireUI() {
    const seekBar = document.getElementById("seekBar");
    const openDrawerBtn = document.getElementById("openDrawer");
    const closeDrawerBtn = document.getElementById("closeDrawer");
    const backdrop = document.getElementById("backdrop");
    const tabButtons = document.querySelectorAll(".tab-button");
    const searchForm = document.getElementById("searchForm");

    seekBar.addEventListener("input", () => {
        document.getElementById("currentTime").textContent = formatMs(seekBar.value);
    });

    seekBar.addEventListener("change", () => {
        action_seek(Number(seekBar.value));
    });

    openDrawerBtn.addEventListener("click", () => setDrawer(true));
    closeDrawerBtn.addEventListener("click", () => setDrawer(false));
    backdrop.addEventListener("click", () => setDrawer(false));

    tabButtons.forEach(btn => {
        btn.addEventListener("click", () => switchTab(btn.dataset.tab));
    });

    searchForm.addEventListener("submit", async e => {
        e.preventDefault();
        const query = document.getElementById("searchInput").value.trim();
        if (query.length < 2) return;
        await runSearch(query);
    });

    document.getElementById("playlistsList").addEventListener("click", e => {
        const item = e.target.closest(".list-item");
        if (!item) return;
        action_play_from_uri(item.dataset.uri);
    });

    document.getElementById("searchResults").addEventListener("click", e => {
        const item = e.target.closest(".list-item");
        if (!item) return;
        action_play_from_uri(item.dataset.uri);
    });
}

async function callProxy(action, payload = {}) {
    const res = await fetch("/proxy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, ...payload })
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
        const msg = data.error || res.statusText || "Proxy error";
        throw new Error(msg);
    }
    return data;
}

async function refreshStatus() {
    try {
        const data = await callProxy("getStatus");
        if (!data || !data.data) throw new Error("Invalid status response");
        currentStatus = data.data;
        updatePlayerUI(currentStatus);
    } catch (err) {
        console.error("Failed to refresh status", err);
    } finally {
        setTimeout(refreshStatus, 1000);
    }
}

function updatePlayerUI(status) {
    if (!status) return;

    const art = document.getElementById("albumArt");
    if (status.albumArtUrl && art.src !== status.albumArtUrl) {
        art.src = status.albumArtUrl;
    }

    document.getElementById("songtitle").textContent = status.songName || "";
    document.getElementById("songinfo").textContent = `${status.artistName || ""} – ${status.albumName || ""}`;
    document.getElementById("playlistname").textContent = status.playlistName || "Library";

    if (status.upNext && status.upNext.length) {
        const upNext = status.upNext[0];
        const upArt = document.getElementById("upnext_art");
        if (upNext.albumArtUrl && upArt.src !== upNext.albumArtUrl) {
            upArt.src = upNext.albumArtUrl;
        }
        document.getElementById("upnext_songtitle").textContent = upNext.name || "";
        document.getElementById("upnext_info").textContent = `${upNext.artists || ""} – ${upNext.album || ""}`;
    }

    const seekBar = document.getElementById("seekBar");
    const duration = Number(status.duration) || 0;
    const position = Number(status.position) || 0;
    seekBar.max = duration;
    seekBar.value = position;
    const progress = duration ? Math.min(100, Math.max(0, (position / duration) * 100)) : 0;
    seekBar.style.setProperty("--progress", `${progress}%`);
    document.getElementById("currentTime").textContent = formatMs(position);
    document.getElementById("totalTime").textContent = formatMs(duration);

    const likeBtn = document.getElementById("likeBtn");
    likeBtn.classList.toggle("active", !!status.isSongLiked);
    likeBtn.textContent = status.isSongLiked ? "favorite" : "favorite_border";
    likeBtn.setAttribute("aria-pressed", status.isSongLiked ? "true" : "false");

    const playToggleBtn = document.getElementById("playPauseBtn");
    if (playToggleBtn) {
        playToggleBtn.textContent = status.isPlaying ? "pause" : "play_arrow";
    }

    document.getElementById("shuffleBtn").classList.toggle("active", !!status.shuffle);
    const repeatBtn = document.getElementById("repeatBtn");
    repeatBtn.classList.toggle("active", status.repeat && status.repeat > 0);
    repeatBtn.textContent = status.repeat === 2 ? "repeat_one" : "repeat";
}

function setDrawer(open) {
    const drawer = document.getElementById("drawer");
    const backdrop = document.getElementById("backdrop");
    drawer.classList.toggle("open", open);
    backdrop.classList.toggle("visible", open);
    
    discover_open = open;

    if (open && !drawerLoaded) {
        drawerLoaded = true;
        loadPlaylists();
    }
}

function switchTab(tab) {
    document.querySelectorAll(".tab-button").forEach(btn => {
        btn.classList.toggle("active", btn.dataset.tab === tab);
    });

    document.querySelectorAll(".tab-pane").forEach(pane => {
        pane.classList.toggle("active", pane.id === `tab-${tab}`);
    });
    if (tab === "playlists") {
        content_amount = playlistsCache.length;
    } else {
        content_amount = document.getElementById("searchResults").children.length;
    }
}

async function loadPlaylists() {
    try {
        const res = await callProxy("listPlaylists");
        playlistsCache = res.data || [];
        renderPlaylists(playlistsCache);
    } catch (err) {
        console.error("Failed to load playlists", err);
    }
}

function renderPlaylists(list) {
    const container = document.getElementById("playlistsList");
    if (!list || !list.length) {
        container.innerHTML = "<p class='muted'>No playlists found.</p>";
        return;
    }

    container.innerHTML = list.map(p => `
        <div class="list-item" data-uri="${p.uri}" id="content${list.indexOf(p)}">
            <img src="${p.coverArtUrl || ""}" alt="${p.name}" />
            <div>
                <div class="title">${p.name}</div>
                <div class="subtitle">Playlist</div>
            </div>
            <span class="pill">Play</span>
        </div>
    `).join("");
}
// ----------------------
// 2. UI handler
// ----------------------
async function runSearch(query) {
    const resultsContainer = document.getElementById("searchResults");
    resultsContainer.innerHTML = "<p class='muted'>Searching...</p>";

    try {
        const res = await callProxy("searchSpotify", { query, limit: 20 });
        const results = res.data || [];

        console.log(results);

        if (!results.length) {
            content_amount = 0;
            resultsContainer.innerHTML = "<p class='muted'>No results.</p>";
            return;
        }

        content_amount = results.length;

        resultsContainer.innerHTML = results.map(r => `
            <div class="list-item" data-uri="${r.uri}" id="content${results.indexOf(r)}">
                <img src="${r.image}" />
                <div>
                    <div class="title">${r.name}</div>
                    ${r.kind == "artist" ? `<div class="subtitle">${r.kind}</div>` : `<div class="subtitle">${r.subtitle} · ${r.kind}</div>`}
                </div>
                <span class="pill">Play</span>
            </div>
        `).join("");

    } catch (err) {
        console.error(err);
        resultsContainer.innerHTML = "<p class='muted'>Search failed.</p>";
    }
}



function formatMs(ms) {
    const total = Math.floor(ms / 1000);
    const m = Math.floor(total / 60);
    const s = total % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
}

// ACTIONS
async function action_toggle_play() {
    const action = currentStatus?.isPlaying ? "pause" : "play";
    await callProxy(action).catch(err => console.error(err));
}

async function action_previous() {
    await callProxy("previous").catch(err => console.error(err));
}

async function action_next() {
    await callProxy("next").catch(err => console.error(err));
}

async function action_shuffle() {
    const shuffle = !(currentStatus?.shuffle);
    await callProxy("setShuffle", { shuffle }).catch(err => console.error(err));
}

async function action_repeat() {
    const next = ((currentStatus?.repeat ?? 0) + 1) % 3;
    await callProxy("setRepeat", { repeat: next }).catch(err => console.error(err));
}

async function action_like_unlike() {
    const like = !(currentStatus?.isSongLiked);
    await callProxy("like", { like }).catch(err => console.error(err));
}

async function action_seek(positionMs) {
    await callProxy("seek", { position: positionMs }).catch(err => console.error(err));
}

async function action_play_from_uri(uri) {
    await callProxy("playFromUri", { uri }).catch(err => console.error(err));
}

function action_pick_from_playlist() {
    setDrawer(true);
    switchTab("playlists");
}

function action_search() {
    setDrawer(true);
    switchTab("search");
}

function action_go_to_album() {
    if (currentStatus?.current?.album?.uri) {
        action_play_from_uri(currentStatus.current.album.uri);
    }
}

function action_home() {
    action_play_from_uri("spotify:home");
}
