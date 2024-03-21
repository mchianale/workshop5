"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.node = void 0;
const body_parser_1 = __importDefault(require("body-parser"));
const express_1 = __importDefault(require("express"));
const config_1 = require("../config");
const http_1 = __importDefault(require("http"));
async function node(nodeId, // the ID of the node
N, // total number of nodes in the network
F, // number of faulty nodes in the network
initialValue, // initial value of the node
isFaulty, // true if the node is faulty, false otherwise
nodesAreReady, // used to know if all nodes are ready to receive requests
setNodeIsReady // this should be called when the node is started and ready to receive requests
) {
    const node = (0, express_1.default)();
    node.use(express_1.default.json());
    node.use(body_parser_1.default.json());
    const nodes_ids = [...Array(N)].map((_, index) => index);
    ;
    const initialState = {
        killed: false,
        x: isFaulty ? null : initialValue,
        decided: isFaulty ? null : false,
        k: isFaulty ? null : 0,
    };
    const currentState = initialState;
    const getMessages = [];
    const propositions = new Map();
    let decisions = new Map();
    // 1
    node.get("/status", (req, res) => {
        if (!isFaulty) {
            res.status(200).send("live");
        }
        else {
            res.status(500).send("faulty");
        }
    });
    node.get('/getState', (req, res) => {
        res.status(201).json(currentState);
    });
    // this route allows the node to receive messages from other nodes
    node.post("/message", (req, res) => {
        let { k, x, messageType } = req.body;
        if (isFaulty) {
            currentState.k = null;
            currentState.x = null;
            currentState.decided = null;
            return res.status(500).json({ message: `Node ${nodeId} is faulty` });
        }
        if (currentState.killed) {
            return res.status(500).json({ message: `Node ${nodeId} is killed` });
        }
        if (messageType == "decision") {
            if (!propositions.has(k)) {
                propositions.set(k, []);
            }
            propositions.get(k).push(x);
            let proposition = propositions.get(k);
            if (proposition.length >= (N - F)) {
                let n0 = proposition.filter((el) => el == 0).length;
                let n1 = proposition.filter((el) => el == 1).length;
                if (n0 > (N / 2)) {
                    x = 0;
                }
                else if (n1 > (N / 2)) {
                    x = 1;
                }
                else {
                    x = "?";
                }
                for (let i = 0; i < N; i++) {
                    postDecision(`http://localhost:${config_1.BASE_NODE_PORT + i}/message`, { k: k, x: x, messageType: "final" });
                }
                return res.status(200).json({ message: "Phase 0 completed" });
            }
        }
        if (!decisions.has(k)) {
            decisions.set(k, []);
        }
        else if (messageType == "final") {
            decisions.get(k).push(x);
            let decision = decisions.get(k);
            if (decision.length >= (N - F)) {
                let n0 = decision.filter((el) => el == 0).length;
                let n1 = decision.filter((el) => el == 1).length;
                if (n1 >= F + 1 || n0 >= F + 1) {
                    if (n1 >= n0) {
                        currentState.x = 1;
                    }
                    else {
                        currentState.x = 0;
                    }
                    currentState.decided = true;
                }
                else {
                    if (n0 + n1 !== 0 && n0 > n1) {
                        currentState.x = 0;
                    }
                    else if (n0 + n1 !== 0 && n0 < n1) {
                        currentState.x = 1;
                    }
                    else {
                        currentState.x = Math.random() > 0.5 ? 0 : 1;
                    }
                    currentState.k = k + 1;
                    for (let i = 0; i < N; i++) {
                        postDecision(`http://localhost:${config_1.BASE_NODE_PORT + i}/message`, { k: currentState.k, x: currentState.x, messageType: "decision" });
                    }
                    return res.status(200).json({ message: "Phase 1 completed" });
                }
            }
        }
        return res.status(500).json({ message: `Issue with Node ${nodeId}` });
    });
    function postDecision(url, body) {
        const options = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        };
        const req = http_1.default.request(url, options, (res) => {
            let data = '';
            res.on('data', (chunk) => {
                data += chunk;
            });
            res.on('end', () => {
                try {
                    const contentType = res.headers['content-type'];
                    if (contentType && contentType.includes('application/json')) {
                        const jsonData = JSON.parse(data);
                    }
                }
                catch (error) { }
            });
        });
        req.on('error', (error) => { });
        req.write(JSON.stringify(body));
        req.end();
    }
    // this route is used to start the consensus algorithm
    node.get("/start", async (req, res) => {
        // Implement Ben-Or consensus algorithm here
        // This involves sending messages to other nodes and updating the node's state
        // based on the messages received
        // You'll also need to handle the termination condition and set 'decided' accordingly
        let try_counter = 0;
        while (!nodesAreReady()) {
            try_counter += 1;
        }
        if (isFaulty) {
            currentState.k = null;
            currentState.x = null;
            currentState.decided = null;
            return res.status(500).json({ message: `Node ${nodeId} is faulty` });
        }
        currentState.k = 1;
        currentState.x = initialValue;
        currentState.decided = false;
        for (let i = 0; i < N; i++) {
            postDecision(`http://localhost:${config_1.BASE_NODE_PORT + i}/message`, { k: currentState.k, x: currentState.x, messageType: "decision" });
        }
        return res.status(200).send("Consensus algorithm started.");
    });
    // this route is used to stop the consensus algorithm
    node.get("/stop", async (req, res) => {
        currentState.killed = true;
        res.status(200).send(`Stop Node ${nodeId}`);
    });
    // start the server
    const server = node.listen(config_1.BASE_NODE_PORT + nodeId, async () => {
        console.log(`Node ${nodeId} is listening on port ${config_1.BASE_NODE_PORT + nodeId}`);
        // the node is ready
        setNodeIsReady(nodeId);
    });
    return server;
}
exports.node = node;
