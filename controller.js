function init() {
    const ws = new WebSocket("wss://localhost:3000/"); // SSL cert required

    ws.onopen = () => console.log("[Controller] Connected to WS");
    ws.onclose = () => setTimeout(init, 1000);
    ws.onerror = e => console.error("[Controller] WS error", e);

    ws.onmessage = async (msg) => {
        const cmd = JSON.parse(msg.data);

        const sendResponse = (data) => {
            // Echo the _request_id back
            if (cmd._request_id) data._request_id = cmd._request_id;
            ws.send(JSON.stringify(data));
        };

        switch (cmd.action) {
            case "play": play(); break;
            case "pause": pause(); break;
            case "next": next(); break;
            case "previous": previous(); break;
            case "listPlaylists": sendResponse({ action: "listPlaylists", data: await getPlaylists() }); break;
            case "getPlaylist": sendResponse({ action: "getPlaylist", data: await getPlaylist(cmd.uri) }); break;
            case "getLikedSongs": sendResponse({ action: "getLikedSongs", data: await getLikedSongs() }); break;
            case "getSong": sendResponse({ action: "getSong", data: getSong(cmd.uri) }); break;
            case "playFromUri": Spicetify.Player.playUri(cmd.uri); break;
            case "fetchWithAuth": sendResponse({ action: "fetchWithAuth", data: await fetchWithAuth(cmd.url, cmd.method, cmd.headers, cmd.body) }); break;
            case "getStatus": sendResponse({ action: "getStatus", data: await getStatus() }); break;
            case "setShuffle": setShuffle(cmd.shuffle); break;
            case "setRepeat": setRepeat(cmd.repeat); break;
            case "setVolume": setVolume(cmd.volume); break;
            case "like": like(cmd.like); break;
            case "seek": seek(cmd.position ?? cmd.milliseconds ?? 0); break;
            case "searchSpotify": sendResponse({ action: "searchSpotify", data: await gqlSearch(cmd.query, cmd.limit) }); break;
        }
    };
}

(function waitForSpicetify() {
    if (!window.Spicetify) return setTimeout(waitForSpicetify, 300);
    init();
})();


function play() {
    if (!Spicetify) return;
    Spicetify.Player.play();
}

function pause() {
    if (!Spicetify) return;
    Spicetify.Player.pause();
}

function next() {
    if (!Spicetify) return;
    Spicetify.Player.next();
}

function previous() {
    if (!Spicetify) return;
    Spicetify.Player.back();
}

function setShuffle(shuffle) {
    if (!Spicetify) return;
    Spicetify.Player.setShuffle(shuffle);
}

function setRepeat(repeat) {
    if (!Spicetify) return;
    Spicetify.Player.setRepeat(repeat);
}

function setSmartShuffle(smartShuffle) {
    if (!Spicetify) return;
    Spicetify.Player.setSmartShuffle(smartShuffle);
}

async function getPlaylists() {
    // Get playlists
    const playlistsResponse = await Spicetify.Platform.LibraryAPI.getContents({
        filters: ["2"],
        sortOrder: "0",
        limit: 999,
        offset: 0
    });

    // Get liked songs with track count
    const likedSongsData = await Spicetify.CosmosAsync.get(
        "sp://core-collection/unstable/@/list/tracks/all",
        { policy: { link: true } }
    );

    const likedSongs = {
        type: "collection",
        name: "Liked Songs",
        uri: "spotify:collection:tracks",
        totalLength: likedSongsData.length,
        unfilteredLength: likedSongsData.unfilteredLength,
        images: [],
        coverArtUrl: "https://misc.scdn.co/liked-songs/liked-songs-300.jpg"
    };

    return [likedSongs, ...playlistsResponse.items.map(playlist => ({
        type: playlist.type,
        name: playlist.name,
        uri: playlist.uri,
        totalLength: playlist.totalLength,
        unfilteredLength: playlist.unfilteredLength,
        images: playlist.images,
        coverArtUrl: playlist.images[0] ? "https://mosaic.scdn.co/640/" + playlist.images[0]?.url.split(":").slice(2).join("") : ""
    }))];
}

async function getPlaylist(uri) {
    if (!Spicetify) return null;
    const playlist = await Spicetify.Platform.PlaylistAPI.getPlaylist(uri);
    if (!playlist) return null;
    const cover = playlistDetails.images[0].url
    return {
        name: playlist.name,
        uri: playlist.uri,
        tracks: playlist.tracks.map(track => ({
            name: track.name,
            artists: track.artists.map(artist => artist.name).join(", "),
            uri: track.uri
        })),
        coverArtUrl: cover
    }
}

async function getLikedSongs() {
    if (!Spicetify) return null;
    const likedSongs = await Spicetify.CosmosAsync.get("sp://core-collection/unstable/@/list/tracks/all",
        {policy: { link: true }}
    );
    if (!likedSongs) return null;
    return likedSongs.items.map(item => ({
        name: item.name,
        artists: item.artists.map(artist => artist.name).join(", "),
        uri: item.uri,
        album: item.album.name,
        albumArtUrl: Spicetify.Cdn.getImageUrl(item.album.coverUri),
        duration: item.duration
    }));
}

function getSong(uri) {
    if (!Spicetify) return null;
    const track = Spicetify.Library.getTrack(uri);
    if (!track) return null;
    return {
        name: track.name,
        artists: track.artists.map(artist => artist.name).join(", "),
        uri: track.uri,
        album: track.album.name,
        albumArtUrl: Spicetify.Cdn.getImageUrl(track.album.coverUri),
        duration: track.duration
    }
}

function playFromUri(uri) {
    if (!Spicetify) return;
    Spicetify.Player.playUri(uri);
}

function getPartnerAuthToken() {
    // This is NOT the Web API token
    return Spicetify.Platform.AuthorizationAPI._token?.accessToken;
}

function getClientToken() {
    return Spicetify.Platform.ClientToken?._token?.clientToken;
}

async function gqlSearch(query, limit = 30) {
    if (!Spicetify) return [];
    if (!Spicetify?.GraphQL?.Definitions?.searchDesktop) {
        Spicetify.GraphQL.Definitions.searchDesktop = {
            "name": "searchDesktop",
            "operation": "query",
            "sha256Hash": "fcad5a3e0d5af727fb76966f06971c19cfa2275e6ff7671196753e008611873c",
            "value": null
        }
    }
    console.log(query)
    const res = await Spicetify.GraphQL.Request(
    Spicetify.GraphQL.Definitions.searchDesktop,
    {
        "searchTerm": query,
        "offset": 0,
        "limit": limit,
        "numberOfTopResults": 5,
        "includeAudiobooks": true,
        "includeArtistHasConcertsField": false,
        "includePreReleases": true,
        "includeAuthors": true
    });

    function flattenResults(data) {
        const tracks = data.searchV2?.tracksV2?.items || [];
        const albums = data.searchV2?.albumsV2?.items || [];
        const artists = data.searchV2?.artists?.items || [];
        
        return { tracks, albums, artists };
    }

    function formatResults({ tracks, albums, artists }) {
        const t = tracks.map(t => ({
            kind: "track",
            uri: t.item.data?.uri,
            name: t.item.data?.name,
            subtitle: t.item.data?.artists?.items.map(a => a.profile?.name).join(", "),
            image: t.item.data?.albumOfTrack?.coverArt?.sources?.[0]?.url || ""
        }));

        const a = albums.map(a => ({
            kind: "album",
            uri: a.data?.uri,
            name: a.data?.name,
            subtitle: a.data?.artists?.items?.map(x => x.profile?.name).join(", "),
            image: a.data?.coverArt?.sources?.[0]?.url || ""
        }));

        const ar = artists.map(ar => ({
            kind: "artist",
            uri: ar.data?.uri,
            name: ar.data?.profile?.name,
            image: ar.data?.visuals?.avatarImage?.sources?.[0]?.url || ""
        }));

        return [...t, ...a, ...ar];
    }


    return formatResults(flattenResults(res?.data));
}


async function fetchWithAuth(url, method = "GET", headers = {}, body = null) {
    if (!Spicetify) return null;

    if (method === "GET") {
        const data = await Spicetify.CosmosAsync.get(url, headers);
        return data;
    }
    const data = await Spicetify.CosmosAsync.post(url, body, headers);
    return data;
}

function setVolume(volume) {
    if (!Spicetify) return;
    Spicetify.Player.setVolume(volume);
}

async function getStatus() {
    if (!window.Spicetify || !Spicetify.Player) return { isPlaying: false };

    const state = Spicetify.Player.data;
    if (!state || !state.item) return { isPlaying: false };

    const current = state.item;

    const isPlaying = !state.isPaused;
    const volume = Spicetify.Player.getVolume();
    const position = Spicetify.Player.getProgress();
    const duration = state.duration ?? current.duration_ms ?? 0;

    const songName = current.name ?? "";
    const artistName = current.artists?.map(a => a.name).join(", ") ?? "";
    const albumName = current.album?.name ?? "";
    const albumArtUrl = current.album?.images?.[0]?.url
        ? "https://i.scdn.co/image/" + current.album.images[0].url.split(":").pop()
        : "";

    const upNext = state.nextItems?.map(track => ({
        name: track.name,
        artists: track.artists.map(a => a.name).join(", "),
        uri: track.uri,
        album:  track.album?.name ?? "",
        albumArtUrl: track.album?.images?.[0]?.url
            ? "https://i.scdn.co/image/" + track.album.images[0].url.split(":").pop()
            : "",
        duration: track.duration_ms ?? 0
    })) ?? [];

    const playlistUri = state.context?.uri ?? "";
    let playlistName = "";

    if (playlistUri.startsWith("spotify:playlist:")) {
        try {
            const playlist = await Spicetify.Platform.PlaylistAPI.getPlaylist(playlistUri);
            playlistName = playlist?.name ?? "";
        } catch {}
    }

    const isSongLiked = current.uri
        ? Spicetify.Player.getHeart()
        : false;

    return {
        isPlaying,
        current,
        volume,
        position,
        duration,
        songName,
        artistName,
        albumName,
        albumArtUrl,
        upNext,
        playlistName,
        playlistUri,
        isSongLiked,
        shuffle: Spicetify.Player.getShuffle(),
        repeat: Spicetify.Player.getRepeat()
    };
}


function like(like) {
    if (!Spicetify) return;
    Spicetify.Player.setHeart(like);
}

function seek(milliseconds) {
    if (!Spicetify) return;
    Spicetify.Player.seek(milliseconds);
}