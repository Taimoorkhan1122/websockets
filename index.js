const WebSocketServer = require("websocket").server;

const http = require("http");

const CHANNELS = {
  "NBA": [],
  "NCAAF": [],
  "MLB": [],
  "NHL": [],

};

const server = http.createServer((request, response) => {
  console.log(new Date() + " Received request for " + request.url);
  
  const channelsState = {} 
  Object.keys(CHANNELS).forEach((channel) => {
    channelsState[channel] = CHANNELS[channel].length;
  })

  response.writeHead(200);
  response.end(JSON.stringify(channelsState));
});

server.listen(8080, () => {
  console.log("Server is listening on port 8080");
});

const wsServer = new WebSocketServer({
  httpServer: server,
  /**
   * !WARNING: Never Auto-Accept on production
   */
  autoAcceptConnections: true,
});

const unsubscribeChannel = (channel, socket) => {
  if (channel === "all") {
    for (const c in CHANNELS) {
      unsubscribeChannel(c);
    }
  } else {
    // remove user from the channel list
    CHANNELS[channel] = CHANNELS[channel].filter((conn) => conn !== socket);
   
    console.log(`unsubscribed from ${channel}`);
  }
};

// subscribe to channels [all | specified channels]
const subscribeToChannel = (channel, socket) => {
  if (channel === "all") {
    for (const c in CHANNELS) {
      console.log('all channels ', c)
      subscribeToChannel(c, socket);
    }
  } else {
    if (!CHANNELS[channel]) {
      CHANNELS[channel] = [];
    }

    CHANNELS[channel].push(socket);
    console.log(`subscribed to => ${channel}`);

  }
};

wsServer.on("connect", (wsc) => {
  console.log("someone connected! ");

  let currentChannel = { name: null };

  wsc.on("message", (msg) => {
    // action : subscribe , channel: name of channel
    const { action, channel } = JSON.parse(msg.utf8Data);
    console.log(action, channel);

    if (action === "subscribe") {
      // unsubscribe from the current channel
      if (currentChannel.name) {
        unsubscribeChannel(currentChannel.name, wsc);
      }

      // subscribe to the new channel
      subscribeToChannel(channel, wsc);
      currentChannel.name = channel;
    }
  });

  wsc.on("close", (code, reason) => {
    if (currentChannel.name) unsubscribeChannel(currentChannel.name, wsc);
    currentChannel.name = null;
    console.log("Connection closed", { currentChannel, code, reason });
  });

  wsc.on("error", (err) => {
    console.error("Error: ", err);
  });
});

// emit data to each channel
const emitDataToChannel = (channel, data) => {
  if (CHANNELS[channel]) {
    CHANNELS[channel].forEach((conn) => {
      if (conn.state === "open") {
        conn.send(JSON.stringify(data));
      }
    });
  }
};

let ncaafScore = { home: 4, away: 0 };
let nbaScore = { home: 0, away: 2 };
let mlbScore = { home: 0, away: 2 };
let nhlScore = { home: 0, away: 2 };

// function to Update scores randomly
const updateScores = (game) => {
  game.home = Math.floor(Math.random() * 100);
  game.away = Math.floor(Math.random() * 100);
};

// Example: Emit data every 5 seconds
setInterval(() => {
  console.log("emitting data now");
  updateScores(ncaafScore);
  updateScores(nbaScore);
  updateScores(mlbScore);
  updateScores(nhlScore);

  emitDataToChannel("NBA", { event: "score_update NBA", data: { score: ncaafScore } });
  emitDataToChannel("NCAAF", { event: "score_update NCAAF", data: { score: nbaScore } });
  emitDataToChannel("MLB", { event: "score_update MLB", data: { score: mlbScore } });
  emitDataToChannel("NHL", { event: "score_update NHL", data: { score: nhlScore } });
}, 5000);

console.log("WebSocket server running on ws://localhost:8080");
